import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isAxiosError } from "axios";
import axios from "../../api/axios";
import { useNavigate } from "react-router-dom";
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
import SimulationControls from "../../features/signal-simulation/components/SimulationControls";
import SpectrumChart from "../../features/signal-simulation/components/SpectrumChart";
import WaveformChart from "../../features/signal-simulation/components/WaveformChart";
import CanvasWaterfall from "../../components/operator-dashboard/CanvasWaterfall";
import DirectionIndicator from "../../features/signal-simulation/components/DirectionIndicator";
import EventPanel from "../../features/signal-simulation/components/EventPanel";
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
import { useSignalSimulation } from "../../features/signal-simulation/state/useSignalSimulation";
import {
  startDashboardSimulation,
} from "../../features/signal-simulation/state/dashboardSimulationBridge";
import type { DfSensorConfig, SimulationConfig } from "../../features/signal-simulation/model/types";

const WS_RECONNECT_BASE_MS = 1200;
const WS_RECONNECT_MAX_MS = 10000;
const WS_FALLBACK_REFRESH_MS = 20000;

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

function parseApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim().length > 0) return detail;
    if (typeof error.message === "string" && error.message.trim().length > 0) return error.message;
  }
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
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
  if (typeof window === "undefined") return "ws://localhost:8000/ws/alerts";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:8000/ws/alerts`;
}

function dfAssetsToSensors(dfAssets: AssetRecord[]): DfSensorConfig[] {
  return dfAssets.map((asset, index) => ({
    id: asset.id,
    label: asset.name,
    location: { latitude: Number(asset.latitude), longitude: Number(asset.longitude) },
    bearingNoiseStdDeg: [1.8, 2.2, 1.6, 2.0][index % 4],
    bearingBiasDeg: [0.4, -0.6, 0.2, 0.0][index % 4],
    confidence: [0.95, 0.9, 0.94, 0.92][index % 4],
  }));
}

type TabType = "operations" | "simulation";

// ─── Inline style constants ──────────────────────────────────────────────────
const SIDEBAR_WIDTH = 260;
const RIGHT_PANEL_WIDTH = 360;

const css = {
  shell: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100vh",
    background: "#090d14",
    color: "#c8d6e5",
    fontFamily: "'Rajdhani', 'Share Tech Mono', monospace",
    overflow: "hidden",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
    padding: "0 16px",
    background: "#0b1220",
    borderBottom: "1px solid #1a2840",
    flexShrink: 0,
    gap: 12,
  },
  topBarTitle: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.18em",
    color: "#5bc8f5",
    textTransform: "uppercase" as const,
  },
  tabRow: {
    display: "flex",
    gap: 2,
    alignItems: "center",
  },
  statusDot: (online: boolean) => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: online ? "#2ddc6e" : "#f5a623",
    boxShadow: online ? "0 0 6px #2ddc6e" : "0 0 6px #f5a623",
    display: "inline-block",
    marginRight: 6,
  }),
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  // LEFT SIDEBAR
  sidebar: {
    width: SIDEBAR_WIDTH,
    flexShrink: 0,
    background: "#0b1220",
    borderRight: "1px solid #1a2840",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },
  sidebarHeader: {
    padding: "10px 14px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.2em",
    color: "#3d6080",
    textTransform: "uppercase" as const,
    borderBottom: "1px solid #1a2840",
    background: "#0d1828",
  },
  sidebarScroll: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "8px 0",
  },
  deviceGroup: {
    padding: "6px 14px 2px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.14em",
    color: "#3d6080",
    textTransform: "uppercase" as const,
  },
  deviceItem: (active: boolean) => ({
    padding: "8px 14px",
    cursor: "pointer",
    background: active ? "rgba(91,200,245,0.07)" : "transparent",
    borderLeft: active ? "2px solid #5bc8f5" : "2px solid transparent",
    transition: "all 0.15s",
  }),
  deviceName: {
    fontSize: 12,
    fontWeight: 600,
    color: "#c8d6e5",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  deviceMeta: {
    fontSize: 10,
    color: "#3d6080",
    marginTop: 2,
    lineHeight: 1.5,
  },
  // CENTER MAP
  center: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    position: "relative" as const,
  },
  mapHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 14px",
    background: "#0b1220",
    borderBottom: "1px solid #1a2840",
    fontSize: 11,
    flexShrink: 0,
  },
  mapLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.12em",
    color: "#8aaabf",
    textTransform: "uppercase" as const,
  },
  activeBadge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.1em",
    color: "#2ddc6e",
    border: "1px solid #2ddc6e",
    borderRadius: 3,
    padding: "1px 7px",
    textTransform: "uppercase" as const,
  },
  mapArea: {
    flex: 1,
    overflow: "hidden",
    position: "relative" as const,
  },
  bottomStrip: {
    flexShrink: 0,
    background: "#0b1220",
    borderTop: "1px solid #1a2840",
  },
  bottomStripHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 14px",
    borderBottom: "1px solid #1a2840",
  },
  freqTableWrap: {
    overflowX: "auto" as const,
    maxHeight: 160,
    overflowY: "auto" as const,
  },
  freqTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 11,
  },
  freqTh: {
    padding: "5px 12px",
    textAlign: "left" as const,
    color: "#3d6080",
    fontWeight: 600,
    letterSpacing: "0.08em",
    borderBottom: "1px solid #1a2840",
    whiteSpace: "nowrap" as const,
    fontSize: 10,
  },
  freqTd: {
    padding: "5px 12px",
    borderBottom: "1px solid #111e2e",
    whiteSpace: "nowrap" as const,
    color: "#c8d6e5",
  },
  // RIGHT PANEL
  rightPanel: {
    width: RIGHT_PANEL_WIDTH,
    flexShrink: 0,
    background: "#0b1220",
    borderLeft: "1px solid #1a2840",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },
  rpHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 14px",
    background: "#0d1828",
    borderBottom: "1px solid #1a2840",
    fontSize: 11,
    flexShrink: 0,
  },
  rpTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.14em",
    color: "#8aaabf",
    textTransform: "uppercase" as const,
  },
  rpScroll: {
    flex: 1,
    overflowY: "auto" as const,
    display: "flex",
    flexDirection: "column" as const,
  },
  rpSection: {
    borderBottom: "1px solid #1a2840",
    flexShrink: 0,
  },
  rpSectionHeader: {
    padding: "6px 14px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.14em",
    color: "#3d6080",
    textTransform: "uppercase" as const,
    background: "#0d1828",
  },
  rpContent: {
    padding: "10px 14px",
  },
  // Tab button
  tabBtn: (active: boolean) => ({
    padding: "4px 14px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    background: active ? "rgba(91,200,245,0.12)" : "transparent",
    color: active ? "#5bc8f5" : "#3d6080",
    border: active ? "1px solid rgba(91,200,245,0.3)" : "1px solid transparent",
    borderRadius: 3,
    cursor: "pointer",
    transition: "all 0.15s",
  }),
  // Simulation full-width layout
  simBody: {
    flex: 1,
    overflow: "auto",
    padding: 16,
    display: "grid",
    gap: 14,
  },
};

// ─── Small reusable sub-components ───────────────────────────────────────────

function SidebarDevice({
  asset,
  isSelected,
  onClick,
}: {
  asset: AssetRecord;
  isSelected: boolean;
  onClick: () => void;
}) {
  const online = true; // derive from asset if you have a status field
  return (
    <div style={css.deviceItem(isSelected)} onClick={onClick}>
      <div style={css.deviceName}>
        <span style={css.statusDot(online)} />
        {asset.name}
      </div>
      <div style={css.deviceMeta}>
        Location: {asset.latitude?.toFixed(4)}, {asset.longitude?.toFixed(4)}
        <br />
        Type: {asset.type ?? "DF"}
      </div>
    </div>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        color: connected ? "#2ddc6e" : "#f5a623",
        textTransform: "uppercase",
      }}
    >
      <span style={css.statusDot(connected)} />
      {connected ? "Connected" : "Reconnecting"}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OperatorUnifiedDashboardPage() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("operations");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // === STATE (unchanged from original) ===
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

  // === SIMULATION STATE ===
  const [centerFrequencyMhz, setCenterFrequencyMhz] = useState(433.92);
  const [noiseFloorDbm, setNoiseFloorDbm] = useState(-102);
  const [realDfAssets, setRealDfAssets] = useState<AssetRecord[]>([]);

  useEffect(() => {
    getAssets()
      .then((res) => {
        const dfA = res.data.filter(
          (a) =>
            (a.type ?? "").toUpperCase() === "DIRECTION_FINDER" &&
            typeof a.latitude === "number" &&
            typeof a.longitude === "number"
        );
        setRealDfAssets(dfA);
      })
      .catch(() => {});
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

  // === PERMISSION HELPERS ===
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

  // === HELPERS (unchanged from original) ===
  const updateSpectrumBinsWithDetection = useCallback(
    (d: { freq?: number | null; power?: number | null }) => {
      if (typeof d.freq !== "number" || Number.isNaN(d.freq)) return;
      const incomingHz = Math.round(d.freq * 1_000_000);
      if (!Number.isFinite(incomingHz) || incomingHz <= 0) return;
      const incomingPower =
        typeof d.power === "number" && Number.isFinite(d.power) ? d.power : undefined;
      setSpectrumBins((previous) => {
        const freqTolerance = 500_000;
        const binIndex = previous.findIndex(
          (bin) => Math.abs(bin.frequency_hz - incomingHz) <= freqTolerance
        );
        if (binIndex === -1) {
          const newBin = {
            frequency_hz: incomingHz,
            detection_count: 1,
            max_power_dbm: incomingPower ?? null,
          };
          return [...previous, newBin]
            .sort((a, b) => a.frequency_hz - b.frequency_hz)
            .slice(-800);
        }
        const currentBin = previous[binIndex];
        const nextBin = {
          ...currentBin,
          detection_count: currentBin.detection_count + 1,
          max_power_dbm:
            incomingPower !== undefined
              ? Math.max(currentBin.max_power_dbm ?? Number.NEGATIVE_INFINITY, incomingPower)
              : currentBin.max_power_dbm,
        };
        const next = [...previous];
        next[binIndex] = nextBin;
        return next;
      });
    },
    []
  );

  const applyIngestStatus = useCallback(
    (
      payload: {
        accepted: number;
        rejected: number;
        errors: string[];
        node_health: { source_node: string; online: boolean };
      },
      mode: "file" | "stream",
      options: { fileName?: string; streamUrl?: string; message: string }
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
    setTriangulations(
      snapshot.triangulations.length > 0
        ? snapshot.triangulations
        : snapshot.triangulation
        ? [snapshot.triangulation]
        : []
    );
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

  const refreshTelemetry = useCallback(
    async (silent = false) => {
      if (isDashboardSimulationActive()) {
        setTelemetryLoading(false);
        return;
      }
      if (!canReadSms) {
        setTelemetryLoading(false);
        return;
      }
      try {
        if (!silent) setTelemetryLoading(true);
        setTelemetryError(null);
        const [
          binsResponse,
          detectionsResponse,
          assetsResponse,
          alertsResponse,
          heatResponse,
          triangulationResponse,
        ] = await Promise.all([
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
    },
    [canReadSms]
  );

  // === EFFECTS (unchanged from original) ===
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
      if (snapshot) applySimulationSnapshot(snapshot);
    }
    return () => unsubscribe();
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
        if (!first) return;
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
      } catch {}
    };
    void loadExistingSession();
  }, [canReadSms, simulationMode, refreshTelemetry]);

  useEffect(() => {
    if (!canReadSms || simulationMode) return;
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
        if (!payload || typeof payload.type !== "string") return;
        const eventType = payload.type;
        if (eventType.startsWith("sms_")) void refreshTelemetry(true);
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
        if (eventType === "sms_ingest") {
          const accepted = typeof payload.accepted === "number" ? payload.accepted : 0;
          const rejected = typeof payload.rejected === "number" ? payload.rejected : 0;
          const sourceNode = typeof payload.source_node === "string" ? payload.source_node : "";
          setStatus((previous) => ({
            ...previous,
            sourceNode: sourceNode || previous.sourceNode,
            accepted,
            rejected,
            updatedAt: new Date().toISOString(),
            message: `Live ingest update: accepted ${accepted}, rejected ${rejected}.`,
          }));
          if (payload.data && typeof payload.data === "object") {
            const d = payload.data as any;
            updateSpectrumBinsWithDetection(d);
            const newDetection = {
              id: d.id ?? `sms-${Date.now()}`,
              source_node: sourceNode || "tcp_node_01",
              frequency_hz: d.freq ?? 0,
              power_dbm: d.power ?? 0,
              doa_azimuth_deg: d.DOA ?? 0,
              timestamp_utc: d.timestamp ?? new Date().toISOString(),
            };
            setDetections((prev) => [newDetection, ...prev].slice(0, 200));
          }
        }
      };
      websocket.onclose = () => {
        if (liveSocketRef.current === websocket) liveSocketRef.current = null;
        setWsConnected(false);
        if (!canReadSms) return;
        const attempt = reconnectAttemptRef.current + 1;
        reconnectAttemptRef.current = attempt;
        const delay = Math.min(WS_RECONNECT_MAX_MS, WS_RECONNECT_BASE_MS * 2 ** (attempt - 1));
        reconnectTimerRef.current = window.setTimeout(() => connectLiveSocket(), delay);
      };
      websocket.onerror = () => websocket.close();
    };
    connectLiveSocket();
    return () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const activeSocket = liveSocketRef.current;
      liveSocketRef.current = null;
      if (activeSocket) activeSocket.close();
    };
  }, [canReadSms, simulationMode, refreshTelemetry]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws/rf");
    ws.onopen = () => console.log("✅ RF WebSocket Connected");
    ws.onmessage = (event) => {
      try {
        const lines = event.data.split("\n").filter(Boolean);
        const parsed = lines.map((line: string) => JSON.parse(line));
        setDetections((prev) => {
          let updated = [...prev];
          parsed.forEach((d: any) => {
            const newDetection = {
              id: d.id,
              source_node: "DF Node",
              frequency_hz: d.freq * 1_000_000,
              power_dbm: d.power,
              doa_azimuth_deg: d.doa,
              timestamp_utc: d.timestamp,
            };
            const index = updated.findIndex((p) => p.id === d.id);
            if (d.status === "OBSOLETE") {
              updated = updated.filter((p) => p.id !== d.id);
            } else if (index !== -1) {
              updated[index] = newDetection;
            } else {
              updated.unshift(newDetection);
            }
          });
          return updated.slice(0, 200);
        });
      } catch (err) {
        console.error("❌ RF WS parse error:", err);
      }
    };
    ws.onerror = (err) => console.error("❌ RF WS error:", err);
    ws.onclose = () => console.log("🔌 RF WS disconnected");
    return () => ws.close();
  }, []);

  useEffect(() => {
    if (!canReadSms || wsConnected || simulationMode) return;
    const timer = window.setInterval(() => void refreshTelemetry(true), WS_FALLBACK_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [canReadSms, wsConnected, simulationMode, refreshTelemetry]);

  useEffect(() => {
    if (!canReadSms || simulationMode) return;
    const websocket = new WebSocket(resolveAlertsWsUrl());
    websocket.onmessage = () => void refreshTelemetry(true);
    return () => websocket.close();
  }, [canReadSms, simulationMode, refreshTelemetry]);

  // === ACTION HANDLERS (unchanged from original) ===
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

  const handlePublishToDashboard = useCallback(() => {
    startDashboardSimulation(simulationConfig);
    setSimulationMode(true);
    setActiveTab("operations");
  }, [simulationConfig]);

  const handlePublishToOperatorMap = useCallback(() => {
    startDashboardSimulation(simulationConfig);
    navigate("/operator/map");
  }, [simulationConfig, navigate]);

  const handleStopDashboardSimulation = useCallback(() => {
    stopDashboardSimulation();
  }, []);

  const recentDetections = useMemo(() => detections.slice(0, 12), [detections]);

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div style={css.shell}>
      {/* ── TOP BAR ── */}
      <div style={css.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={css.topBarTitle}>Direction Finder Dashboard</span>
          <div style={css.tabRow}>
            <button
              type="button"
              style={css.tabBtn(activeTab === "operations")}
              onClick={() => setActiveTab("operations")}
            >
              RF Operations
            </button>
            <button
              type="button"
              style={css.tabBtn(activeTab === "simulation")}
              onClick={() => setActiveTab("simulation")}
            >
              Simulation Lab
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {simulationMode && (
            <>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: "#f5a623",
                  border: "1px solid #f5a623",
                  borderRadius: 3,
                  padding: "1px 7px",
                  textTransform: "uppercase",
                }}
              >
                Sim Feed Active
              </span>
              <button
                type="button"
                onClick={handleStopSimulationMode}
                style={{
                  ...css.tabBtn(false),
                  border: "1px solid #3d6080",
                  color: "#8aaabf",
                }}
              >
                Stop Sim
              </button>
            </>
          )}
          <ConnectionBadge connected={wsConnected} />
          <button
            type="button"
            onClick={() => void refreshTelemetry(false)}
            disabled={telemetryLoading}
            style={{
              ...css.tabBtn(false),
              background: "rgba(91,200,245,0.1)",
              border: "1px solid rgba(91,200,245,0.25)",
              color: "#5bc8f5",
              opacity: telemetryLoading ? 0.6 : 1,
              cursor: telemetryLoading ? "not-allowed" : "pointer",
            }}
          >
            {telemetryLoading ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      {activeTab === "operations" && (
        <div style={css.body}>
          {/* ── LEFT SIDEBAR: DF Devices ── */}
          <div style={css.sidebar}>
            <div style={css.sidebarHeader}>Direction Finder Devices</div>
            <div style={css.sidebarScroll}>
              {!canRenderTelemetry ? (
                <div style={{ padding: "14px", fontSize: 11, color: "#3d6080" }}>
                  sms:read permission required.
                </div>
              ) : dfAssets.length === 0 ? (
                <div style={{ padding: "14px", fontSize: 11, color: "#3d6080" }}>
                  No DF devices available.
                </div>
              ) : (
                <>
                  <div style={css.deviceGroup}>Devices</div>
                  {dfAssets.map((asset) => (
                    <SidebarDevice
                      key={asset.id}
                      asset={asset}
                      isSelected={selectedDeviceId === asset.id}
                      onClick={() =>
                        setSelectedDeviceId((prev) => (prev === asset.id ? null : asset.id))
                      }
                    />
                  ))}
                </>
              )}

              {/* RSSI + Alerts summary below devices */}
              {canRenderTelemetry && (
                <>
                  <div style={{ ...css.sidebarHeader, marginTop: 8 }}>RSSI Monitor</div>
                  <div style={{ padding: "8px 0" }}>
                    <RssiMonitorPanel detections={detections} />
                  </div>
                  <div style={{ ...css.sidebarHeader, marginTop: 4 }}>Alerts</div>
                  <div style={{ padding: "8px 0" }}>
                    <AlertsEventPanel alerts={alerts} detections={detections} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── CENTER: Map + Frequency Table ── */}
          <div style={css.center}>
            <div style={css.mapHeader}>
              <span style={css.mapLabel}>Map View</span>
              {streamActive && <span style={css.activeBadge}>Active Scan</span>}
              {simulationMode && <span style={css.activeBadge}>Simulation</span>}
            </div>

            {/* Map fills the remaining vertical space */}
            <div style={css.mapArea}>
              {canRenderTelemetry ? (
                <DirectionFinderPanel
                  directionFinderAssets={dfAssets}
                  detections={detections}
                  triangulation={triangulation}
                  triangulations={triangulations}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "#3d6080",
                    fontSize: 13,
                  }}
                >
                  Access denied: sms:read required.
                </div>
              )}
            </div>

            {/* ── Bottom strip: Frequency Finder Details ── */}
            {canRenderTelemetry && (
              <div style={css.bottomStrip}>
                <div style={css.bottomStripHeader}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      color: "#8aaabf",
                      textTransform: "uppercase",
                    }}
                  >
                    Frequency Finder Details
                  </span>
                  <span style={{ fontSize: 10, color: "#3d6080" }}>
                    Active Frequencies: {recentDetections.length}
                  </span>
                </div>
                <div style={css.freqTableWrap}>
                  <table style={css.freqTable}>
                    <thead>
                      <tr>
                        {["Frequency", "Mode", "Time Detected", "Signal Strength", "Bearing", "Confidence", "Source", "Lat/Long"].map(
                          (h) => (
                            <th key={h} style={css.freqTh}>
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {recentDetections.map((d) => (
                        <tr
                          key={d.id}
                          style={{
                            background:
                              selectedDeviceId === d.source_node
                                ? "rgba(91,200,245,0.06)"
                                : "transparent",
                          }}
                        >
                          <td style={{ ...css.freqTd, color: "#5bc8f5" }}>
                            {(d.frequency_hz / 1_000_000).toFixed(3)} MHz
                          </td>
                          <td style={css.freqTd}>—</td>
                          <td style={css.freqTd}>
                            {new Date(d.timestamp_utc).toLocaleString()}
                          </td>
                          <td style={css.freqTd}>
                            {typeof d.power_dbm === "number"
                              ? `${d.power_dbm.toFixed(1)} dBm`
                              : "—"}
                          </td>
                          <td style={css.freqTd}>
                            {typeof d.doa_azimuth_deg === "number"
                              ? `${d.doa_azimuth_deg.toFixed(1)}°`
                              : "—"}
                          </td>
                          <td style={css.freqTd}>—</td>
                          <td style={css.freqTd}>{d.source_node}</td>
                          <td style={css.freqTd}>—</td>
                        </tr>
                      ))}
                      {recentDetections.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ ...css.freqTd, color: "#3d6080" }}>
                            No detections available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL: RF Spectrum Analyser + Waterfall + Additional Panels ── */}
          <div style={css.rightPanel}>
            <div style={css.rpHeader}>
              <span style={css.rpTitle}>RF Spectrum Analyser</span>
              {lastTelemetryUpdate && (
                <span style={{ fontSize: 9, color: "#3d6080" }}>
                  {new Date(lastTelemetryUpdate).toLocaleTimeString()}
                </span>
              )}
            </div>

            <div style={css.rpScroll}>
              {/* Spectrum */}
              <div style={css.rpSection}>
                <div style={css.rpSectionHeader}>Spectrum</div>
                <div style={{ ...css.rpContent, padding: "10px 10px 4px" }}>
                  <SpectrumViewer
                    bins={spectrumBins}
                    loading={telemetryLoading}
                    lastUpdatedAt={lastTelemetryUpdate}
                  />
                </div>
              </div>

              {/* Waterfall */}
              <div style={css.rpSection}>
                <div style={css.rpSectionHeader}>Waterfall</div>
                <div style={{ ...css.rpContent, padding: "8px 10px" }}>
                  <WaterfallHistoryView loading={telemetryLoading} />
                </div>
              </div>

              {/* Device Identification */}
              <div style={css.rpSection}>
                <div style={css.rpSectionHeader}>Device Identification</div>
                <div style={css.rpContent}>
                  <DeviceIdentificationPanel detections={detections} />
                </div>
              </div>

             

              {/* Historical Analytics */}
              <div style={css.rpSection}>
                <div style={css.rpSectionHeader}>Historical Analytics</div>
                <div style={css.rpContent}>
                  <HistoricalAnalyticsPanel detections={detections} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SIMULATION TAB ── */}
      {activeTab === "simulation" && (
        <div style={css.simBody}>
          {/* Controls row */}
          <div
            style={{
              background: "#0b1220",
              border: "1px solid #1a2840",
              borderRadius: 4,
              padding: 16,
            }}
          >
            <div style={{ marginBottom: 10 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  color: "#5bc8f5",
                  textTransform: "uppercase",
                }}
              >
                RF and DF Signal Simulation Lab
              </h2>
              <div style={{ color: "#3d6080", marginTop: 4, fontSize: 11 }}>
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {[
                {
                  label: "Show on Operations Tab",
                  bg: "#1a4a6b",
                  color: "#5bc8f5",
                  border: "1px solid #5bc8f5",
                  onClick: handlePublishToDashboard,
                },
                {
                  label: "Show on Operator Map",
                  bg: "#1a3a2a",
                  color: "#2ddc6e",
                  border: "1px solid #2ddc6e",
                  onClick: handlePublishToOperatorMap,
                },
                {
                  label: "Stop Simulation Feed",
                  bg: "transparent",
                  color: "#8aaabf",
                  border: "1px solid #1a2840",
                  onClick: handleStopDashboardSimulation,
                },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={btn.onClick}
                  style={{
                    padding: "6px 16px",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    background: btn.bg,
                    color: btn.color,
                    border: btn.border,
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              {
                title: "Spectrum View",
                children: (
                  <>
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
                  </>
                ),
              },
              {
                title: "Time-Series Waveform",
                children: <WaveformChart points={latestFrame?.waveform ?? []} />,
              },
            ].map((card) => (
              <div
                key={card.title}
                style={{
                  background: "#0b1220",
                  border: "1px solid #1a2840",
                  borderRadius: 4,
                  padding: 14,
                }}
              >
                <h3
                  style={{
                    margin: "0 0 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    color: "#8aaabf",
                    textTransform: "uppercase",
                  }}
                >
                  {card.title}
                </h3>
                {card.children}
              </div>
            ))}
          </div>

          {/* Direction + Events row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              {
                title: "Direction / Angle Indicator",
                children: <DirectionIndicator vectors={latestFrame?.dfVectors ?? []} />,
              },
              {
                title: "Simulation Events",
                children: <EventPanel events={latestFrame?.events ?? []} />,
              },
            ].map((card) => (
              <div
                key={card.title}
                style={{
                  background: "#0b1220",
                  border: "1px solid #1a2840",
                  borderRadius: 4,
                  padding: 14,
                }}
              >
                <h3
                  style={{
                    margin: "0 0 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    color: "#8aaabf",
                    textTransform: "uppercase",
                  }}
                >
                  {card.title}
                </h3>
                {card.children}
              </div>
            ))}
          </div>

          {/* Signal snapshot table */}
          <div
            style={{
              background: "#0b1220",
              border: "1px solid #1a2840",
              borderRadius: 4,
              padding: 14,
            }}
          >
            <h3
              style={{
                margin: "0 0 10px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: "#8aaabf",
                textTransform: "uppercase",
              }}
            >
              Active Signal Snapshot
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr>
                    {["Emitter", "Frequency", "Power", "Location", "Track"].map((h) => (
                      <th key={h} style={css.freqTh}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(latestFrame?.activeSignals ?? []).map((signal) => (
                    <tr key={signal.emitterId}>
                      <td style={css.freqTd}>{signal.label}</td>
                      <td style={{ ...css.freqTd, color: "#5bc8f5" }}>
                        {(signal.frequencyHz / 1_000_000).toFixed(4)} MHz
                      </td>
                      <td style={css.freqTd}>{signal.powerDbm.toFixed(1)} dBm</td>
                      <td style={css.freqTd}>
                        {signal.location.latitude.toFixed(4)}, {signal.location.longitude.toFixed(4)}
                      </td>
                      <td style={css.freqTd}>
                        {signal.isTrackedTarget
                          ? "Triangulated target"
                          : `${signal.headingDeg.toFixed(0)}° @ ${signal.speedMps.toFixed(1)} m/s`}
                      </td>
                    </tr>
                  ))}
                  {(latestFrame?.activeSignals ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ ...css.freqTd, color: "#3d6080" }}>
                        No frame available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}