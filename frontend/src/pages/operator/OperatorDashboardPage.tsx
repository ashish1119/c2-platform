import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";
import RFUploader from "../../components/operator-dashboard/RFUploader";
import StreamInput from "../../components/operator-dashboard/StreamInput";
import { SpectrumViewer } from "../../components/operator-dashboard";
import WaterfallHistoryView from "../../components/operator-dashboard/WaterfallHistoryView";
import DeviceIdentificationPanel from "../../components/operator-dashboard/DeviceIdentificationPanel";
import RssiMonitorPanel from "../../components/operator-dashboard/RssiMonitorPanel";
import RfGeolocationPanel from "../../components/operator-dashboard/RfGeolocationPanel";
import AlertsEventPanel from "../../components/operator-dashboard/AlertsEventPanel";
import HistoricalAnalyticsPanel from "../../components/operator-dashboard/HistoricalAnalyticsPanel";
import DirectionFinderPanel from "../../components/operator-dashboard/DirectionFinderPanel";
import StatusPanel, { type DashboardStatus } from "../../components/operator-dashboard/StatusPanel";
import { getAssets, type AssetRecord } from "../../api/assets";
import { getAlerts, type AlertRecord } from "../../api/alerts";
import { getHeatMap, getTriangulation, type HeatCell, type TriangulationResult } from "../../api/rf";
import {
  getSmsDetections,
  getStreamSessions,
  getSpectrumOccupancy,
  resolveSmsLiveWsUrl,
  startStreamSession,
  stopStreamSession,
  uploadRfFile,
  type SmsLiveEvent,
  type SmsDetectionRecord,
  type SmsSpectrumOccupancyBin,
  type SmsStreamSession,
} from "../../api/operatorDashboard";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import {
  getDashboardSimulationSnapshot,
  isDashboardSimulationActive,
  stopDashboardSimulation,
  subscribeDashboardSimulation,
  type DashboardSimulationSnapshot,
} from "../../features/signal-simulation/state/dashboardSimulationBridge";

const WS_RECONNECT_BASE_MS = 1200;
const WS_RECONNECT_MAX_MS = 10000;
const WS_FALLBACK_REFRESH_MS = 20000;

function parseApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim().length > 0) {
      return detail;
    }
    if (typeof error.message === "string" && error.message.trim().length > 0) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isDirectionFinderAsset(asset: AssetRecord): boolean {
  const normalized = (asset.type ?? "").trim().toUpperCase();
  return normalized === "DIRECTION_FINDER" || normalized === "DF";
}

function resolveAlertsWsUrl(): string {
  if (typeof window === "undefined") {
    return "ws://localhost:8000/ws/alerts";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:8000/ws/alerts`;
}

export default function OperatorDashboardPage() {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [fileSourceNode, setFileSourceNode] = useState("operator_rf_file_01");
  const [streamSourceNode, setStreamSourceNode] = useState("operator_rf_stream_01");
  const [streamUrl, setStreamUrl] = useState("");
  const [streamActive, setStreamActive] = useState(false);
  const [streamSessionId, setStreamSessionId] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);

  const [uploadingFile, setUploadingFile] = useState(false);
  const [streamBusy, setStreamBusy] = useState(false);
  const [telemetryLoading, setTelemetryLoading] = useState(true);

  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const [spectrumBins, setSpectrumBins] = useState<SmsSpectrumOccupancyBin[]>([]);
  const [detections, setDetections] = useState<SmsDetectionRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [dfAssets, setDfAssets] = useState<AssetRecord[]>([]);
  const [heatCells, setHeatCells] = useState<HeatCell[]>([]);
  const [triangulation, setTriangulation] = useState<TriangulationResult | null>(null);
  const [triangulations, setTriangulations] = useState<TriangulationResult[]>([]);
  const [lastTelemetryUpdate, setLastTelemetryUpdate] = useState<string | null>(null);

  const [status, setStatus] = useState<DashboardStatus>({
    mode: "idle",
    sourceNode: "",
    accepted: 0,
    rejected: 0,
    errors: [],
    streamActive: false,
    nodeOnline: undefined,
    updatedAt: null,
    message: "Waiting for file upload or stream connection.",
    fileName: null,
    streamUrl: null,
  });

  const liveSocketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);

  const hasPermission = useCallback(
    (requiredPermission: string) => {
      const permissions = user?.permissions ?? [];
      const [requiredResource, requiredAction] = requiredPermission.split(":");

      return (
        permissions.includes(requiredPermission) ||
        permissions.includes(`${requiredResource}:*`) ||
        permissions.includes(`*:${requiredAction}`) ||
        permissions.includes("*:*")
      );
    },
    [user?.permissions]
  );

  const canReadSms = hasPermission("sms:read");
  const canWriteSms = hasPermission("sms:write");
  const canRenderTelemetry = canReadSms || simulationMode;

  const applyIngestStatus = useCallback(
    (
      payload: {
        accepted: number;
        rejected: number;
        errors: string[];
        node_health: { source_node: string; online: boolean };
      },
      mode: "file" | "stream",
      options: {
        fileName?: string;
        streamUrl?: string;
        message: string;
      }
    ) => {
      setStatus((previous) => ({
        ...previous,
        mode,
        sourceNode: payload.node_health?.source_node ?? previous.sourceNode,
        accepted: payload.accepted,
        rejected: payload.rejected,
        errors: payload.errors ?? [],
        streamActive: mode === "stream" ? true : previous.streamActive,
        nodeOnline: payload.node_health?.online,
        updatedAt: new Date().toISOString(),
        fileName: options.fileName ?? previous.fileName,
        streamUrl: options.streamUrl ?? previous.streamUrl,
        message: options.message,
      }));
    },
    []
  );

  const applySimulationSnapshot = useCallback((snapshot: DashboardSimulationSnapshot) => {
    setSpectrumBins(snapshot.spectrumBins);
    setDetections(snapshot.detections);
    setAlerts(snapshot.alerts);
    setDfAssets(snapshot.directionFinderAssets);
    setHeatCells(snapshot.heatCells);
    setTriangulation(snapshot.triangulation);
    setTriangulations(snapshot.triangulations.length > 0 ? snapshot.triangulations : snapshot.triangulation ? [snapshot.triangulation] : []);
    setLastTelemetryUpdate(snapshot.lastUpdatedAt);
    setTelemetryError(null);
    setTelemetryLoading(false);
    setStreamSessionId(null);
    setStreamActive(false);

    setStatus((previous) => ({
      ...previous,
      mode: "idle",
      sourceNode: "simulation_engine",
      accepted: snapshot.detections.length,
      rejected: 0,
      errors: [],
      streamActive: false,
      nodeOnline: true,
      updatedAt: snapshot.lastUpdatedAt,
      streamUrl: "sim://rf-df-dashboard-feed",
      message: "Simulation feed is active on Operator Dashboard.",
    }));
  }, []);

  const refreshTelemetry = useCallback(async (silent = false) => {
    if (isDashboardSimulationActive()) {
      setTelemetryLoading(false);
      return;
    }

    if (!canReadSms) {
      setTelemetryLoading(false);
      return;
    }

    try {
      if (!silent) {
        setTelemetryLoading(true);
      }
      setTelemetryError(null);
      const [binsResponse, detectionsResponse, assetsResponse, alertsResponse, heatResponse, triangulationResponse] = await Promise.all([
        getSpectrumOccupancy(120, 240),
        getSmsDetections({ limit: 250 }),
        getAssets(),
        getAlerts().catch(() => ({ data: [] as AlertRecord[] })),
        getHeatMap().catch(() => ({ data: [] as HeatCell[] })),
        getTriangulation().catch(() => ({ data: null as TriangulationResult | null })),
      ]);

      setSpectrumBins(binsResponse.data);
      setDetections(detectionsResponse.data);
      setDfAssets(assetsResponse.data.filter(isDirectionFinderAsset));
      setAlerts(alertsResponse.data);
      setHeatCells(heatResponse.data);
      setTriangulation(triangulationResponse.data);
      setTriangulations(triangulationResponse.data ? [triangulationResponse.data] : []);
      setLastTelemetryUpdate(new Date().toISOString());
    } catch (error) {
      setTelemetryError(parseApiErrorMessage(error, "Failed to load RF/DF telemetry."));
    } finally {
      setTelemetryLoading(false);
    }
  }, [canReadSms]);

  useEffect(() => {
    const unsubscribe = subscribeDashboardSimulation((snapshot) => {
      if (!snapshot) {
        setSimulationMode(false);
        void refreshTelemetry(false);
        return;
      }

      setSimulationMode(true);
      applySimulationSnapshot(snapshot);
    });

    if (isDashboardSimulationActive()) {
      setSimulationMode(true);
      const snapshot = getDashboardSimulationSnapshot();
      if (snapshot) {
        applySimulationSnapshot(snapshot);
      }
    }

    return () => {
      unsubscribe();
    };
  }, [applySimulationSnapshot, refreshTelemetry]);

  useEffect(() => {
    if (!canReadSms || simulationMode) {
      setTelemetryLoading(false);
      return;
    }

    void refreshTelemetry(false);

    const loadExistingSession = async () => {
      try {
        const response = await getStreamSessions();
        const first = response.data[0];
        if (!first) {
          return;
        }

        setStreamSessionId(first.session_id);
        setStreamActive(true);
        setStreamUrl(first.stream_url);
        setStreamSourceNode(first.source_node);
        setStatus((previous) => ({
          ...previous,
          mode: "stream",
          streamActive: true,
          sourceNode: first.source_node,
          streamUrl: first.stream_url,
          message: `Recovered active stream session ${first.session_id.slice(0, 8)}.`,
          updatedAt: new Date().toISOString(),
        }));
      } catch {
        // Ignore session restore failures and keep dashboard usable.
      }
    };

    void loadExistingSession();
  }, [canReadSms, simulationMode, refreshTelemetry]);

  useEffect(() => {
    if (!canReadSms || simulationMode) {
      return;
    }

    const connectLiveSocket = () => {
      const websocket = new WebSocket(resolveSmsLiveWsUrl());
      liveSocketRef.current = websocket;

      websocket.onopen = () => {
        reconnectAttemptRef.current = 0;
        setWsConnected(true);
      };

      websocket.onmessage = (event) => {
        let payload: SmsLiveEvent | null = null;
        try {
          payload = JSON.parse(event.data) as SmsLiveEvent;
        } catch {
          return;
        }

        if (!payload || typeof payload.type !== "string") {
          return;
        }

        const eventType = payload.type;
        if (eventType.startsWith("sms_")) {
          void refreshTelemetry(true);
        }

        const eventSession = (payload.session ?? null) as Partial<SmsStreamSession> | null;

        if (eventType === "sms_stream_session_started" && eventSession?.session_id) {
          setStreamSessionId(eventSession.session_id);
          setStreamActive(true);
          setStatus((previous) => ({
            ...previous,
            mode: "stream",
            streamActive: true,
            sourceNode: eventSession.source_node ?? previous.sourceNode,
            streamUrl: eventSession.stream_url ?? previous.streamUrl,
            message: "Persistent stream worker session started.",
            updatedAt: new Date().toISOString(),
          }));
        }

        if (eventType === "sms_stream_session_stopped") {
          setStreamSessionId(null);
          setStreamActive(false);
          setStatus((previous) => ({
            ...previous,
            streamActive: false,
            message: "Persistent stream worker session stopped.",
            updatedAt: new Date().toISOString(),
          }));
        }

        if (eventType === "sms_stream_session_error") {
          const errorText =
            typeof eventSession?.last_error === "string" && eventSession.last_error.trim().length > 0
              ? eventSession.last_error
              : "Stream worker encountered an error.";
          setStatus((previous) => ({
            ...previous,
            mode: "stream",
            streamActive: true,
            errors: [errorText],
            message: errorText,
            updatedAt: new Date().toISOString(),
          }));
        }

        // if (eventType === "sms_ingest") {
        //   const accepted = typeof payload.accepted === "number" ? payload.accepted : 0;
        //   const rejected = typeof payload.rejected === "number" ? payload.rejected : 0;
        //   const sourceNode = typeof payload.source_node === "string" ? payload.source_node : "";

        //   setStatus((previous) => ({
        //     ...previous,
        //     sourceNode: sourceNode || previous.sourceNode,
        //     accepted,
        //     rejected,
        //     updatedAt: new Date().toISOString(),
        //     message: `Live ingest update: accepted ${accepted}, rejected ${rejected}.`,
        //   }));
        // }

        if (eventType === "sms_ingest") {
            const accepted = typeof payload.accepted === "number" ? payload.accepted : 0;
            const rejected = typeof payload.rejected === "number" ? payload.rejected : 0;
            const sourceNode = typeof payload.source_node === "string" ? payload.source_node : "";

  // ✅ UPDATE STATUS
  setStatus((previous) => ({
    ...previous,
    sourceNode: sourceNode || previous.sourceNode,
    accepted,
    rejected,
    updatedAt: new Date().toISOString(),
    message: `Live ingest update: accepted ${accepted}, rejected ${rejected}.`,
  }));

  // ============================================
  // 🔥 NEW: PUSH TCP DATA INTO UI
  // ============================================
  if (payload.data) {
    const d = payload.data;

    const newDetection = {
      id: d.id,
      source_node: sourceNode || "tcp_node_01",
      frequency_hz: d.freq,
      power_dbm: d.power,
      doa_azimuth_deg: d.DOA,
      timestamp_utc: d.timestamp,
    };

    setDetections((prev) => [newDetection, ...prev].slice(0, 200));
  }
}
      };

      websocket.onclose = () => {
        if (liveSocketRef.current === websocket) {
          liveSocketRef.current = null;
        }

        setWsConnected(false);
        if (!canReadSms) {
          return;
        }

        const attempt = reconnectAttemptRef.current + 1;
        reconnectAttemptRef.current = attempt;
        const delay = Math.min(WS_RECONNECT_MAX_MS, WS_RECONNECT_BASE_MS * 2 ** (attempt - 1));

        reconnectTimerRef.current = window.setTimeout(() => {
          connectLiveSocket();
        }, delay);
      };

      websocket.onerror = () => {
        websocket.close();
      };
    };

    connectLiveSocket();

    return () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      const activeSocket = liveSocketRef.current;
      liveSocketRef.current = null;
      if (activeSocket) {
        activeSocket.close();
      }
    };
  }, [canReadSms, simulationMode, refreshTelemetry]);

  useEffect(() => {
    if (!canReadSms || wsConnected || simulationMode) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshTelemetry(true);
    }, WS_FALLBACK_REFRESH_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [canReadSms, wsConnected, simulationMode, refreshTelemetry]);

  useEffect(() => {
    if (!canReadSms || simulationMode) {
      return;
    }

    const websocket = new WebSocket(resolveAlertsWsUrl());
    websocket.onmessage = () => {
      void refreshTelemetry(true);
    };

    return () => {
      websocket.close();
    };
  }, [canReadSms, simulationMode, refreshTelemetry]);

  const handleStopSimulationMode = useCallback(() => {
    stopDashboardSimulation();
    setSimulationMode(false);
    setHeatCells([]);
    setTriangulation(null);
    setTriangulations([]);
    setStatus((previous) => ({
      ...previous,
      streamUrl: null,
      message: "Simulation feed stopped. Restoring live telemetry.",
      updatedAt: new Date().toISOString(),
    }));
    void refreshTelemetry(false);
  }, [refreshTelemetry]);

  const handleUpload = useCallback(
    async (file: File, sourceNode: string) => {
      if (!canWriteSms) {
        setStatus((previous) => ({
          ...previous,
          errors: ["You do not have permission to ingest SMS data."],
          message: "Write permission required for file ingestion.",
          updatedAt: new Date().toISOString(),
        }));
        return;
      }

      try {
        setUploadingFile(true);
        const response = await uploadRfFile(file, sourceNode || undefined);
        const payload = response.data;

        applyIngestStatus(payload, "file", {
          fileName: payload.filename,
          message: `File ingest complete: accepted ${payload.accepted}, rejected ${payload.rejected}.`,
        });

        await refreshTelemetry(true);
      } catch (error) {
        const message = parseApiErrorMessage(error, "RF file upload failed.");
        setStatus((previous) => ({
          ...previous,
          mode: "file",
          fileName: file.name,
          errors: [message],
          message,
          updatedAt: new Date().toISOString(),
        }));
      } finally {
        setUploadingFile(false);
      }
    },
    [canWriteSms, applyIngestStatus, refreshTelemetry]
  );

  const handleConnectStream = useCallback(async () => {
    if (!canWriteSms) {
      setStatus((previous) => ({
        ...previous,
        errors: ["You do not have permission to ingest SMS data."],
        message: "Write permission required for stream ingestion.",
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    const normalizedUrl = streamUrl.trim();
    if (!isHttpUrl(normalizedUrl)) {
      setStatus((previous) => ({
        ...previous,
        errors: ["Stream URL must be a valid http/https endpoint."],
        message: "Invalid stream URL.",
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    try {
      setStreamBusy(true);
      const response = await startStreamSession({
        stream_url: normalizedUrl,
        source_node: streamSourceNode.trim() || undefined,
        pull_interval_seconds: 2.0,
        timeout_seconds: 10,
      });

      const session = response.data;
      setStreamSessionId(session.session_id);
      setStreamActive(true);

      setStatus((previous) => ({
        ...previous,
        mode: "stream",
        streamActive: true,
        streamUrl: session.stream_url,
        sourceNode: session.source_node,
        errors: [],
        message: `Stream worker session started (${session.session_id.slice(0, 8)}).`,
        updatedAt: new Date().toISOString(),
      }));
      await refreshTelemetry(true);
    } catch (error) {
      const message = parseApiErrorMessage(error, "Failed to start stream worker session.");
      setStatus((previous) => ({
        ...previous,
        mode: "stream",
        streamActive: false,
        errors: [message],
        message,
        updatedAt: new Date().toISOString(),
      }));
    } finally {
      setStreamBusy(false);
    }
  }, [canWriteSms, streamUrl, streamSourceNode]);

  const handleDisconnectStream = useCallback(async () => {
    if (!streamSessionId) {
      setStreamActive(false);
      setStatus((previous) => ({
        ...previous,
        streamActive: false,
        message: "Stream disconnected.",
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    try {
      setStreamBusy(true);
      await stopStreamSession(streamSessionId);
      setStreamSessionId(null);
      setStreamActive(false);
      setStatus((previous) => ({
        ...previous,
        streamActive: false,
        message: "Stream worker session stopped.",
        updatedAt: new Date().toISOString(),
      }));
      await refreshTelemetry(true);
    } catch (error) {
      const message = parseApiErrorMessage(error, "Failed to stop stream worker session.");
      setStatus((previous) => ({
        ...previous,
        errors: [message],
        message,
        updatedAt: new Date().toISOString(),
      }));
    } finally {
      setStreamBusy(false);
    }
  }, [streamSessionId, refreshTelemetry]);

  const recentDetections = useMemo(() => detections.slice(0, 12), [detections]);

  return (
    <AppLayout>
      <PageContainer title="Operator Dashboard">
        <div style={{ display: "grid", gap: theme.spacing.lg }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>Operator RF + DF Dashboard</h2>
            <div style={{ display: "flex", gap: theme.spacing.sm, alignItems: "center" }}>
              <span
                style={{
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  borderRadius: theme.radius.md,
                  border: `1px solid ${wsConnected ? theme.colors.success : theme.colors.warning}`,
                  background: theme.colors.surfaceAlt,
                  color: wsConnected ? theme.colors.success : theme.colors.warning,
                  fontSize: theme.typography.body.fontSize,
                }}
              >
                {wsConnected ? "WebSocket Live" : "WebSocket Reconnecting"}
              </span>

              {simulationMode && (
                <span
                  style={{
                    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                    borderRadius: theme.radius.md,
                    border: `1px solid ${theme.colors.warning}`,
                    background: theme.colors.surfaceAlt,
                    color: theme.colors.warning,
                    fontSize: theme.typography.body.fontSize,
                  }}
                >
                  Simulation Feed Active
                </span>
              )}

              {simulationMode && (
                <button
                  type="button"
                  onClick={handleStopSimulationMode}
                  style={{
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radius.md,
                    background: theme.colors.surfaceAlt,
                    color: theme.colors.textPrimary,
                    cursor: "pointer",
                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  }}
                >
                  Stop Simulation
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  void refreshTelemetry(false);
                }}
                disabled={telemetryLoading}
                style={{
                  border: "none",
                  borderRadius: theme.radius.md,
                  background: theme.colors.primary,
                  color: "#ffffff",
                  cursor: telemetryLoading ? "not-allowed" : "pointer",
                  opacity: telemetryLoading ? 0.75 : 1,
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                }}
              >
                {telemetryLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: theme.spacing.lg,
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            }}
          >
            {/* <RFUploader
              sourceNode={fileSourceNode}
              uploading={uploadingFile}
              disabled={!canWriteSms || simulationMode}
              lastUploadedFile={status.fileName ?? null}
              onSourceNodeChange={setFileSourceNode}
              onUpload={handleUpload}
            /> */}

            <StreamInput
              streamUrl={streamUrl}
              sourceNode={streamSourceNode}
              active={streamActive}
              busy={streamBusy}
              disabled={!canWriteSms || simulationMode}
              onStreamUrlChange={setStreamUrl}
              onSourceNodeChange={setStreamSourceNode}
              onConnect={handleConnectStream}
              onDisconnect={handleDisconnectStream}
            />

            <StatusPanel status={{ ...status, streamActive }} />
          </div>

          {telemetryError && (
            <Card>
              <div style={{ color: theme.colors.danger }}>{telemetryError}</div>
            </Card>
          )}

          {!canRenderTelemetry && (
            <Card>
              <div style={{ color: theme.colors.danger, marginBottom: theme.spacing.sm }}>
                Access denied: sms:read permission is required to view RF telemetry.
              </div>
              <div style={{ color: theme.colors.textSecondary }}>
                Contact an administrator to grant SMS read access for this operator account.
              </div>
            </Card>
          )}

          {canRenderTelemetry && (
            <>
              <div
                style={{
                  display: "grid",
                  gap: theme.spacing.lg,
                  gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
                }}
              >
                <SpectrumViewer bins={spectrumBins} loading={telemetryLoading} lastUpdatedAt={lastTelemetryUpdate} />
                <WaterfallHistoryView detections={detections} spectrumBins={spectrumBins} loading={telemetryLoading} />
              </div>

              <div
                style={{
                  display: "grid",
                  gap: theme.spacing.lg,
                  gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
                }}
              >
                <DeviceIdentificationPanel detections={detections} />
                <RssiMonitorPanel detections={detections} />
              </div>

              <div
                style={{
                  display: "grid",
                  gap: theme.spacing.lg,
                  gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
                }}
              >
                <RfGeolocationPanel
                  detections={detections}
                  alerts={alerts}
                  directionFinderAssets={dfAssets}
                  heatCells={heatCells}
                  triangulation={triangulation}
                  triangulations={triangulations}
                />
                <DirectionFinderPanel
                  directionFinderAssets={dfAssets}
                  detections={detections}
                  triangulation={triangulation}
                  triangulations={triangulations}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gap: theme.spacing.lg,
                  gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
                }}
              >
                <AlertsEventPanel alerts={alerts} detections={detections} />
                <HistoricalAnalyticsPanel detections={detections} />
              </div>

              <Card>
                <div style={{ display: "grid", gap: theme.spacing.md }}>
                  <h3 style={{ margin: 0 }}>Recent RF Detections</h3>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Time</th>
                          <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Source</th>
                          <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Frequency</th>
                          <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Power</th>
                          <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>DOA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentDetections.map((detection) => (
                          <tr key={detection.id}>
                            <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                              {new Date(detection.timestamp_utc).toLocaleTimeString()}
                            </td>
                            <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{detection.source_node}</td>
                            <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                              {detection.frequency_hz.toLocaleString()} Hz
                            </td>
                            <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                              {typeof detection.power_dbm === "number" ? `${detection.power_dbm.toFixed(1)} dBm` : "-"}
                            </td>
                            <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                              {typeof detection.doa_azimuth_deg === "number" ? `${detection.doa_azimuth_deg.toFixed(1)} deg` : "-"}
                            </td>
                          </tr>
                        ))}
                        {recentDetections.length === 0 && (
                          <tr>
                            <td style={{ padding: theme.spacing.sm }} colSpan={5}>
                              No detections available.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      </PageContainer>
    </AppLayout>
  );
}
