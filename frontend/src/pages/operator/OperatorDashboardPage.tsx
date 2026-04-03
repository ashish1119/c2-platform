import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";
import { SpectrumViewer } from "../../components/operator-dashboard";
import WaterfallHistoryView from "../../components/operator-dashboard/WaterfallHistoryView";
import DeviceIdentificationPanel from "../../components/operator-dashboard/DeviceIdentificationPanel";
import RssiMonitorPanel from "../../components/operator-dashboard/RssiMonitorPanel";
import DFMonitoringConsole from "../../components/operator-dashboard/DFMonitoringConsole";
import SimulationControls from "../../features/signal-simulation/components/SimulationControls";
import SpectrumChart from "../../features/signal-simulation/components/SpectrumChart";
import WaveformChart from "../../features/signal-simulation/components/WaveformChart";
import CanvasWaterfall from "../../components/operator-dashboard/CanvasWaterfall";
import DirectionIndicator from "../../features/signal-simulation/components/DirectionIndicator";
import EventPanel from "../../features/signal-simulation/components/EventPanel";
import { getAssets, type AssetRecord } from "../../api/assets";
import {
  getStreamSessions,
  startStreamSession,
  stopStreamSession,
  uploadRfFile,
  type SmsLiveEvent,
  type SmsStreamSession,
} from "../../api/operatorDashboard";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import {
  getDashboardSimulationSnapshot,
  isDashboardSimulationActive,
  stopDashboardSimulation,
  subscribeDashboardSimulation,
  startDashboardSimulation,
} from "../../features/signal-simulation/state/dashboardSimulationBridge";
import { useSignalSimulation } from "../../features/signal-simulation/state/useSignalSimulation";
import type { DfSensorConfig, SimulationConfig } from "../../features/signal-simulation/model/types";

import SystemStatusBar from "../../features/operator-dashboard/components/SystemStatusBar";
import DashboardMetricsRow from "../../features/operator-dashboard/components/DashboardMetricsRow";
import AlertFeed from "../../features/operator-dashboard/components/AlertFeed";
import DetectionTable from "../../features/operator-dashboard/components/DetectionTable";
import IngestControlDrawer from "../../features/operator-dashboard/components/IngestControlDrawer";
import { PanelErrorBoundary } from "../../features/operator-dashboard/components/PanelErrorBoundary";
import { useDashboardTelemetry } from "../../features/operator-dashboard/hooks/useDashboardTelemetry";
import { useWsHealth } from "../../features/operator-dashboard/hooks/useWsHealth";

const DirectionFinderPanel = lazy(() => import("../../components/operator-dashboard/DirectionFinderPanel"));
const HistoricalAnalyticsPanel = lazy(() => import("../../components/operator-dashboard/HistoricalAnalyticsPanel"));

const WS_FALLBACK_REFRESH_MS = 20000;
const WS_REFRESH_MIN_INTERVAL_MS = 2500;

type TabType = "operations" | "simulation";

const FALLBACK_SENSORS: DfSensorConfig[] = [
  {
    id: "sim-df-1",
    label: "SIM DF North",
    location: { latitude: 12.984, longitude: 77.586 },
    bearingNoiseStdDeg: 1.8,
    bearingBiasDeg: 0.4,
    confidence: 0.95,
  },
  {
    id: "sim-df-2",
    label: "SIM DF East",
    location: { latitude: 12.973, longitude: 77.613 },
    bearingNoiseStdDeg: 2.2,
    bearingBiasDeg: -0.6,
    confidence: 0.9,
  },
  {
    id: "sim-df-3",
    label: "SIM DF South",
    location: { latitude: 12.956, longitude: 77.596 },
    bearingNoiseStdDeg: 1.6,
    bearingBiasDeg: 0.2,
    confidence: 0.94,
  },
];

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function dfAssetsToSensors(assets: AssetRecord[]): DfSensorConfig[] {
  return assets.map((a, i) => ({
    id: a.id,
    label: a.name,
    location: { latitude: Number(a.latitude), longitude: Number(a.longitude) },
    bearingNoiseStdDeg: [1.8, 2.2, 1.6, 2.0][i % 4],
    bearingBiasDeg: [0.4, -0.6, 0.2, 0.0][i % 4],
    confidence: [0.95, 0.9, 0.94, 0.92][i % 4],
  }));
}

function PanelSkeleton({ height = 300 }: { height?: number }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        height,
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: "10px",
        opacity: 0.6,
      }}
    />
  );
}

export default function OperatorDashboardPage() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<TabType>(
    location.pathname === "/operator/simulation" ? "simulation" : "operations"
  );
  const [ingestDrawerOpen, setIngestDrawerOpen] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);

  useEffect(() => {
    setActiveTab(location.pathname === "/operator/simulation" ? "simulation" : "operations");
  }, [location.pathname]);

  const hasPermission = useCallback(
    (perm: string) => {
      const perms = user?.permissions ?? [];
      const [res, act] = perm.split(":");
      return perms.includes(perm) || perms.includes(`${res}:*`) || perms.includes(`*:${act}`) || perms.includes("*:*");
    },
    [user?.permissions]
  );

  const canReadSms = hasPermission("sms:read");
  const canWriteSms = hasPermission("sms:write");
  const canRenderTelemetry = canReadSms || simulationMode;

  const telemetry = useDashboardTelemetry(canReadSms);
  const { refresh, setStatus, pushDetection, applySimulationSnapshot } = telemetry;

  const [fileSourceNode, setFileSourceNode] = useState("operator_rf_file_01");
  const [streamSourceNode, setStreamSourceNode] = useState("operator_rf_stream_01");
  const [streamUrl, setStreamUrl] = useState("");
  const [streamActive, setStreamActive] = useState(false);
  const [streamSessionId, setStreamSessionId] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [streamBusy, setStreamBusy] = useState(false);
  const wsRefreshLastRunRef = useRef(0);

  const requestWsRefresh = useCallback(() => {
    const now = Date.now();
    if (now - wsRefreshLastRunRef.current < WS_REFRESH_MIN_INTERVAL_MS) {
      return;
    }
    wsRefreshLastRunRef.current = now;
    void refresh(true);
  }, [refresh]);

  const handleUpload = useCallback(
    async (file: File, sourceNode: string) => {
      if (!canWriteSms) return;
      try {
        setUploadingFile(true);
        const res = await uploadRfFile(file, sourceNode.trim() || undefined);
        const payload = res.data;
        setStatus((prev) => ({
          ...prev,
          mode: "file",
          sourceNode: payload.node_health?.source_node ?? prev.sourceNode,
          accepted: payload.accepted,
          rejected: payload.rejected,
          errors: payload.errors ?? [],
          nodeOnline: payload.node_health?.online,
          updatedAt: new Date().toISOString(),
          fileName: payload.filename,
          message: `File ingest complete: accepted ${payload.accepted}, rejected ${payload.rejected}.`,
        }));
        await refresh(true, true);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "RF file upload failed.";
        setStatus((prev) => ({
          ...prev,
          mode: "file",
          errors: [message],
          message,
          updatedAt: new Date().toISOString(),
        }));
      } finally {
        setUploadingFile(false);
      }
    },
    [canWriteSms, refresh, setStatus]
  );

  const handleConnectStream = useCallback(async () => {
    if (!canWriteSms) return;

    const url = streamUrl.trim();
    if (!isHttpUrl(url)) {
      setStatus((prev) => ({
        ...prev,
        errors: ["Stream URL must be a valid http(s) endpoint."],
        message: "Invalid stream URL.",
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    try {
      setStreamBusy(true);
      const res = await startStreamSession({
        stream_url: url,
        source_node: streamSourceNode.trim() || undefined,
        pull_interval_seconds: 2.0,
        timeout_seconds: 10,
      });
      const session = res.data;
      setStreamSessionId(session.session_id);
      setStreamActive(true);
      setStatus((prev) => ({
        ...prev,
        mode: "stream",
        streamActive: true,
        streamUrl: session.stream_url,
        sourceNode: session.source_node,
        errors: [],
        message: `Stream session started (${session.session_id.slice(0, 8)}).`,
        updatedAt: new Date().toISOString(),
      }));
      await refresh(true, true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to start stream session.";
      setStatus((prev) => ({
        ...prev,
        mode: "stream",
        streamActive: false,
        errors: [message],
        message,
        updatedAt: new Date().toISOString(),
      }));
    } finally {
      setStreamBusy(false);
    }
  }, [canWriteSms, refresh, setStatus, streamUrl, streamSourceNode]);

  const handleDisconnectStream = useCallback(async () => {
    if (!streamSessionId) {
      setStreamActive(false);
      return;
    }

    try {
      setStreamBusy(true);
      await stopStreamSession(streamSessionId);
      setStreamSessionId(null);
      setStreamActive(false);
      setStatus((prev) => ({
        ...prev,
        streamActive: false,
        message: "Stream session stopped.",
        updatedAt: new Date().toISOString(),
      }));
      await refresh(true, true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to stop stream session.";
      setStatus((prev) => ({
        ...prev,
        errors: [message],
        message,
        updatedAt: new Date().toISOString(),
      }));
    } finally {
      setStreamBusy(false);
    }
  }, [refresh, setStatus, streamSessionId]);

  const handleSmsMessage = useCallback(
    (ev: MessageEvent) => {
      let payload: SmsLiveEvent | null = null;
      try {
        payload = JSON.parse(ev.data) as SmsLiveEvent;
      } catch {
        return;
      }
      if (!payload || typeof payload.type !== "string") return;

      if (payload.type.startsWith("sms_")) {
        requestWsRefresh();
      }

      const session = (payload.session ?? null) as Partial<SmsStreamSession> | null;

      if (payload.type === "sms_stream_session_started" && session?.session_id) {
        setStreamSessionId(session.session_id);
        setStreamActive(true);
        setStatus((prev) => ({
          ...prev,
          mode: "stream",
          streamActive: true,
          sourceNode: session.source_node ?? prev.sourceNode,
          streamUrl: session.stream_url ?? prev.streamUrl,
          message: "Persistent stream worker session started.",
          updatedAt: new Date().toISOString(),
        }));
      }

      if (payload.type === "sms_stream_session_stopped") {
        setStreamSessionId(null);
        setStreamActive(false);
        setStatus((prev) => ({
          ...prev,
          streamActive: false,
          message: "Stream worker session stopped.",
          updatedAt: new Date().toISOString(),
        }));
      }

      if (payload.type === "sms_stream_session_error") {
        const message =
          typeof session?.last_error === "string" ? session.last_error : "Stream worker error.";
        setStatus((prev) => ({
          ...prev,
          mode: "stream",
          streamActive: true,
          errors: [message],
          message,
          updatedAt: new Date().toISOString(),
        }));
      }

      if (payload.type === "sms_ingest") {
        const accepted = typeof payload.accepted === "number" ? payload.accepted : 0;
        const rejected = typeof payload.rejected === "number" ? payload.rejected : 0;
        const sourceNode = typeof payload.source_node === "string" ? payload.source_node : "";

        setStatus((prev) => ({
          ...prev,
          sourceNode: sourceNode || prev.sourceNode,
          accepted,
          rejected,
          updatedAt: new Date().toISOString(),
          message: `Live ingest: accepted ${accepted}, rejected ${rejected}.`,
        }));

        if (payload.data && typeof payload.data === "object") {
          pushDetection(payload.data as Parameters<typeof pushDetection>[0]);
        }
      }
    },
    [pushDetection, requestWsRefresh, setStatus]
  );

  const handleRfMessage = useCallback(
    (ev: MessageEvent) => {
      try {
        const lines = (ev.data as string).split("\n").filter(Boolean);
        lines.forEach((line) => {
          pushDetection(JSON.parse(line));
        });
      } catch {
        // Ignore malformed RF lines.
      }
    },
    [pushDetection]
  );

  const handleAlertsMessage = useCallback(() => {
    requestWsRefresh();
  }, [requestWsRefresh]);

  const wsEnabled = (canReadSms || simulationMode) && activeTab === "operations";

  const wsHealth = useWsHealth({
    enabled: wsEnabled,
    onSmsMessage: handleSmsMessage,
    onRfMessage: handleRfMessage,
    onAlertsMessage: handleAlertsMessage,
  });

  const anyWsLive = wsHealth.smsLive === "live" || wsHealth.rfLive === "live";

  useEffect(() => {
    if (!canReadSms || anyWsLive || simulationMode) return;
    const timer = window.setInterval(() => {
      void refresh(true);
    }, WS_FALLBACK_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [canReadSms, anyWsLive, simulationMode, refresh]);

  useEffect(() => {
    const unsubscribe = subscribeDashboardSimulation((snapshot) => {
      if (!snapshot) {
        setSimulationMode(false);
        void refresh(false, true);
        return;
      }

      setSimulationMode(true);
      applySimulationSnapshot(snapshot);
    });

    if (isDashboardSimulationActive()) {
      setSimulationMode(true);
      const snapshot = getDashboardSimulationSnapshot();
      if (snapshot) applySimulationSnapshot(snapshot);
    }

    return () => unsubscribe();
  }, [applySimulationSnapshot, refresh]);

  useEffect(() => {
    if (!canReadSms || simulationMode) return;

    void refresh(false, true);

    const restoreSession = async () => {
      try {
        const response = await getStreamSessions();
        const first = response.data[0];
        if (!first) return;

        setStreamSessionId(first.session_id);
        setStreamActive(true);
        setStreamUrl(first.stream_url);
        setStreamSourceNode(first.source_node);

        setStatus((prev) => ({
          ...prev,
          mode: "stream",
          streamActive: true,
          sourceNode: first.source_node,
          streamUrl: first.stream_url,
          message: `Recovered active stream session ${first.session_id.slice(0, 8)}.`,
          updatedAt: new Date().toISOString(),
        }));
      } catch {
        // No active sessions.
      }
    };

    void restoreSession();
  }, [canReadSms, simulationMode, refresh, setStatus]);

  const [centerFrequencyMhz, setCenterFrequencyMhz] = useState(433.92);
  const [noiseFloorDbm, setNoiseFloorDbm] = useState(-102);
  const [realDfAssets, setRealDfAssets] = useState<AssetRecord[]>([]);

  useEffect(() => {
    getAssets()
      .then((response) => {
        setRealDfAssets(
          response.data.filter(
            (asset) =>
              (asset.type ?? "").toUpperCase() === "DIRECTION_FINDER" &&
              typeof asset.latitude === "number" &&
              typeof asset.longitude === "number"
          )
        );
      })
      .catch(() => {
        // Fallback sensors will be used.
      });
  }, []);

  const simulationConfig = useMemo<SimulationConfig>(
    () => ({
      seed: 1337,
      updateIntervalMs: 180,
      waveformSampleRateHz: 500_000,
      waveformSamples: 320,
      spectrumMinHz: (centerFrequencyMhz - 20) * 1_000_000,
      spectrumMaxHz: (centerFrequencyMhz + 20) * 1_000_000,
      spectrumBins: 220,
      noiseFloorDbm,
      historyLimit: 240,
      trackingEmitterId: "rf-link-a",
      bearingRayLengthM: 10_000,
      parallelAngleThresholdDeg: 6,
      maxIntersectionDistanceM: 25_000,
      heatmapGridSize: 13,
      heatmapCellSizeM: 180,
      sensors: realDfAssets.length >= 2 ? dfAssetsToSensors(realDfAssets) : FALLBACK_SENSORS,
      emitters: [
        {
          id: "rf-link-a",
          label: "Tracked Emitter",
          baseFrequencyHz: 433_920_000,
          bandwidthHz: 220_000,
          basePowerDbm: -58,
          fadeDepthDb: 7,
          fadeRateHz: 0.2,
          driftHz: 65_000,
          driftRateHz: 0.08,
          initialLocation: { latitude: 12.9724, longitude: 77.5982 },
          headingDeg: 118,
          speedMps: 2.6,
          turnRateDegPerSec: 0.35,
        },
        {
          id: "rf-link-b",
          label: "Relay Interferer",
          baseFrequencyHz: 434_250_000,
          bandwidthHz: 180_000,
          basePowerDbm: -66,
          fadeDepthDb: 5,
          fadeRateHz: 0.16,
          driftHz: 48_000,
          driftRateHz: 0.05,
          initialLocation: { latitude: 12.9688, longitude: 77.6066 },
          headingDeg: 212,
          speedMps: 0.9,
          turnRateDegPerSec: -0.15,
        },
        {
          id: "rf-link-c",
          label: "Telemetry Spur",
          baseFrequencyHz: 432_700_000,
          bandwidthHz: 140_000,
          basePowerDbm: -73,
          fadeDepthDb: 4,
          fadeRateHz: 0.11,
          driftHz: 35_000,
          driftRateHz: 0.03,
          initialLocation: { latitude: 12.9612, longitude: 77.5885 },
          headingDeg: 36,
          speedMps: 0.5,
          turnRateDegPerSec: 0.08,
        },
      ],
    }),
    [centerFrequencyMhz, noiseFloorDbm, realDfAssets]
  );

  const simulation = useSignalSimulation(simulationConfig);
  const latestFrame = simulation.state.latestFrame;

  const handlePublishToDashboard = useCallback(() => {
    startDashboardSimulation(simulationConfig);
    setSimulationMode(true);
    setActiveTab("operations");
  }, [simulationConfig]);

  const handlePublishToOperatorMap = useCallback(() => {
    startDashboardSimulation(simulationConfig);
    navigate("/operator/map");
  }, [simulationConfig, navigate]);

  const handleStopSimulationMode = useCallback(() => {
    stopDashboardSimulation();
    setSimulationMode(false);
    setStatus((prev) => ({
      ...prev,
      streamUrl: null,
      message: "Simulation feed stopped. Restoring live telemetry.",
      updatedAt: new Date().toISOString(),
    }));
    void refresh(false, true);
  }, [refresh, setStatus]);

  const tabButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    border: "none",
    borderBottom: active ? `3px solid ${theme.colors.primary}` : "3px solid transparent",
    background: "transparent",
    color: active ? theme.colors.primary : theme.colors.textSecondary,
    cursor: "pointer",
    fontSize: theme.typography.body.fontSize,
    fontWeight: active ? 600 : 400,
  });

  const twoColStyle: React.CSSProperties = {
    display: "grid",
    gap: theme.spacing.lg,
    gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
  };

  return (
    <AppLayout>
      {activeTab === "operations" && (
        <SystemStatusBar
          wsHealth={wsHealth}
          lastUpdatedAt={telemetry.lastTelemetryUpdate}
          simulationMode={simulationMode}
          onOpenIngestDrawer={() => setIngestDrawerOpen(true)}
        />
      )}

      <PageContainer title="Operator Dashboard">
        <div
          style={{
            display: "flex",
            borderBottom: `1px solid ${theme.colors.border}`,
            marginBottom: theme.spacing.lg,
          }}
        >
          <button type="button" onClick={() => setActiveTab("operations")} style={tabButtonStyle(activeTab === "operations")}>
            RF Operations
          </button>
          <button type="button" onClick={() => setActiveTab("simulation")} style={tabButtonStyle(activeTab === "simulation")}>
            Simulation Lab
          </button>
        </div>

        {activeTab === "operations" && (
          <div style={{ display: "grid", gap: theme.spacing.lg }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: theme.spacing.sm,
              }}
            >
              <h2 style={{ margin: 0, fontSize: "18px" }}>RF + DF Operations</h2>
              <div style={{ display: "flex", gap: theme.spacing.sm }}>
                {simulationMode && (
                  <button
                    type="button"
                    onClick={handleStopSimulationMode}
                    style={{
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: "8px",
                      background: theme.colors.surfaceAlt,
                      color: theme.colors.textPrimary,
                      cursor: "pointer",
                      padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                    }}
                  >
                    Stop Simulation
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void telemetry.refresh(false, true)}
                  disabled={telemetry.loading}
                  style={{
                    border: "none",
                    borderRadius: "8px",
                    background: theme.colors.primary,
                    color: "#fff",
                    cursor: telemetry.loading ? "not-allowed" : "pointer",
                    opacity: telemetry.loading ? 0.75 : 1,
                    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                  }}
                >
                  {telemetry.loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>

            {!canRenderTelemetry && (
              <Card>
                <div style={{ color: theme.colors.danger, marginBottom: theme.spacing.sm }}>
                  Access denied: sms:read permission required to view RF telemetry.
                </div>
                <div style={{ color: theme.colors.textSecondary }}>
                  Contact an administrator to grant SMS read access for this account.
                </div>
              </Card>
            )}

            {telemetry.error && (
              <Card>
                <div style={{ color: theme.colors.danger }}>{telemetry.error}</div>
              </Card>
            )}

            {canRenderTelemetry && (
              <>
                <DashboardMetricsRow
                  alerts={telemetry.alerts}
                  detections={telemetry.detections}
                  triangulations={telemetry.triangulations}
                />

                <div style={twoColStyle}>
                  <PanelErrorBoundary title="Alert Feed">
                    <AlertFeed alerts={telemetry.alerts} detections={telemetry.detections} />
                  </PanelErrorBoundary>

                  <div style={{ display: "grid", gap: theme.spacing.lg }}>
                    <PanelErrorBoundary title="Spectrum Viewer">
                      <SpectrumViewer
                        bins={telemetry.spectrumBins}
                        loading={telemetry.loading}
                        lastUpdatedAt={telemetry.lastTelemetryUpdate}
                      />
                    </PanelErrorBoundary>
                    <PanelErrorBoundary title="Waterfall History">
                      <WaterfallHistoryView loading={telemetry.loading} />
                    </PanelErrorBoundary>
                  </div>
                </div>

                <PanelErrorBoundary title="Direction Finder Map">
                  <Suspense fallback={<PanelSkeleton height={420} />}>
                    <DirectionFinderPanel
                      directionFinderAssets={telemetry.dfAssets}
                      detections={telemetry.detections}
                      triangulation={telemetry.triangulation}
                      triangulations={telemetry.triangulations}
                    />
                  </Suspense>
                </PanelErrorBoundary>

                <div style={twoColStyle}>
                  <PanelErrorBoundary title="Device Identification">
                    <DeviceIdentificationPanel detections={telemetry.detections} />
                  </PanelErrorBoundary>
                  <PanelErrorBoundary title="RSSI Monitor">
                    <RssiMonitorPanel detections={telemetry.detections} />
                  </PanelErrorBoundary>
                </div>

                <PanelErrorBoundary title="Detection Table">
                  <DetectionTable detections={telemetry.detections} maxRows={20} />
                </PanelErrorBoundary>

                <PanelErrorBoundary title="Historical Analytics">
                  <Suspense fallback={<PanelSkeleton height={300} />}>
                    <HistoricalAnalyticsPanel detections={telemetry.detections} />
                  </Suspense>
                </PanelErrorBoundary>

                <Card>
                  <h3 style={{ marginTop: 0 }}>DF Monitoring Console</h3>
                  <div style={{ height: "480px" }}>
                    <PanelErrorBoundary title="DF Monitoring Console">
                      <DFMonitoringConsole />
                    </PanelErrorBoundary>
                  </div>
                </Card>
              </>
            )}
          </div>
        )}

        {activeTab === "simulation" && (
          <div style={{ display: "grid", gap: theme.spacing.lg }}>
            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                <div>
                  <h2 style={{ margin: 0 }}>RF and DF Signal Simulation Lab</h2>
                  <div style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
                    Multi-sensor DF scenario with noisy AOA bearings, triangulation, centroid estimation, and uncertainty heatmap output.
                  </div>
                </div>

                <SimulationControls
                  running={simulation.state.running}
                  centerFrequencyMhz={centerFrequencyMhz}
                  noiseFloorDbm={noiseFloorDbm}
                  onCenterFrequencyMhzChange={setCenterFrequencyMhz}
                  onNoiseFloorDbmChange={setNoiseFloorDbm}
                  onStart={simulation.controls.start}
                  onStop={simulation.controls.stop}
                  onReset={simulation.controls.reset}
                />

                <div style={{ display: "flex", flexWrap: "wrap", gap: theme.spacing.sm }}>
                  <button
                    type="button"
                    onClick={handlePublishToDashboard}
                    style={{
                      border: "none",
                      borderRadius: "8px",
                      background: theme.colors.primary,
                      color: "#fff",
                      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                      cursor: "pointer",
                    }}
                  >
                    Show on Operations Tab
                  </button>
                  <button
                    type="button"
                    onClick={handlePublishToOperatorMap}
                    style={{
                      border: "none",
                      borderRadius: "8px",
                      background: theme.colors.success,
                      color: "#fff",
                      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                      cursor: "pointer",
                    }}
                  >
                    Show on Operator Map
                  </button>
                  <button
                    type="button"
                    onClick={() => stopDashboardSimulation()}
                    style={{
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: "8px",
                      background: theme.colors.surfaceAlt,
                      color: theme.colors.textPrimary,
                      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                      cursor: "pointer",
                    }}
                  >
                    Stop Simulation Feed
                  </button>
                </div>
              </div>
            </Card>

            <div style={twoColStyle}>
              <Card>
                <h3 style={{ marginTop: 0 }}>Spectrum View</h3>
                <SpectrumChart bins={latestFrame?.spectrum ?? []} />
                <div style={{ marginTop: 8 }}>
                  <CanvasWaterfall
                    sweep={latestFrame?.spectrum ?? null}
                    noiseFloorDbm={noiseFloorDbm}
                    ceilingDbm={noiseFloorDbm + 80}
                    maxRows={200}
                    height={260}
                    title="Waterfall History"
                  />
                </div>
              </Card>

              <Card>
                <h3 style={{ marginTop: 0 }}>Time-Series Waveform</h3>
                <WaveformChart points={latestFrame?.waveform ?? []} />
              </Card>
            </div>

            <div style={twoColStyle}>
              <Card>
                <h3 style={{ marginTop: 0 }}>Direction / Angle Indicator</h3>
                <DirectionIndicator vectors={latestFrame?.dfVectors ?? []} />
              </Card>
              <Card>
                <h3 style={{ marginTop: 0 }}>Simulation Events</h3>
                <EventPanel events={latestFrame?.events ?? []} />
              </Card>
            </div>
          </div>
        )}
      </PageContainer>

      <IngestControlDrawer
        open={ingestDrawerOpen}
        onClose={() => setIngestDrawerOpen(false)}
        fileSourceNode={fileSourceNode}
        uploadingFile={uploadingFile}
        canWriteSms={canWriteSms}
        simulationMode={simulationMode}
        status={{ ...telemetry.status, streamActive }}
        onFileSourceNodeChange={setFileSourceNode}
        onUpload={handleUpload}
        streamUrl={streamUrl}
        streamSourceNode={streamSourceNode}
        streamActive={streamActive}
        streamBusy={streamBusy}
        onStreamUrlChange={setStreamUrl}
        onStreamSourceNodeChange={setStreamSourceNode}
        onConnectStream={handleConnectStream}
        onDisconnectStream={handleDisconnectStream}
      />
    </AppLayout>
  );
}
