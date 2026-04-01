import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import DFMonitoringConsole from "../../components/operator-dashboard/DFMonitoringConsole";
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

export default function OperatorUnifiedDashboardPage() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("operations");

  // === OPERATIONS TAB STATE ===
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

  const updateSpectrumBinsWithDetection = useCallback((d: { freq?: number | null; power?: number | null }) => {
    if (typeof d.freq !== "number" || Number.isNaN(d.freq)) {
      return;
    }

    const incomingHz = Math.round(d.freq * 1_000_000);
    if (!Number.isFinite(incomingHz) || incomingHz <= 0) {
      return;
    }

    const incomingPower = typeof d.power === "number" && Number.isFinite(d.power) ? d.power : undefined;

    setSpectrumBins((previous) => {
      const freqTolerance = 500_000; // 0.5 MHz tolerance to match nearby bins
      const binIndex = previous.findIndex((bin) => Math.abs(bin.frequency_hz - incomingHz) <= freqTolerance);

      if (binIndex === -1) {
        const newBin = {
          frequency_hz: incomingHz,
          detection_count: 1,
          max_power_dbm: incomingPower ?? null,
        };
        return [...previous, newBin].sort((a, b) => a.frequency_hz - b.frequency_hz).slice(-800);
      }

      const currentBin = previous[binIndex];
      const nextBin = {
        ...currentBin,
        detection_count: currentBin.detection_count + 1,
        max_power_dbm: incomingPower !== undefined
          ? Math.max(currentBin.max_power_dbm ?? Number.NEGATIVE_INFINITY, incomingPower)
          : currentBin.max_power_dbm,
      };

      const next = [...previous];
      next[binIndex] = nextBin;
      return next;
    });
  }, []);

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

  // === SIMULATION TAB STATE ===
  const [centerFrequencyMhz, setCenterFrequencyMhz] = useState(433.92);
  const [noiseFloorDbm, setNoiseFloorDbm] = useState(-102);
  const [realDfAssets, setRealDfAssets] = useState<AssetRecord[]>([]);

  useEffect(() => {
    getAssets()
      .then((res) => {
        const dfAssets = res.data.filter(
          (a) => (a.type ?? "").toUpperCase() === "DIRECTION_FINDER" &&
            typeof a.latitude === "number" && typeof a.longitude === "number"
        );
        setRealDfAssets(dfAssets);
      })
      .catch(() => { /* keep empty → fallback sensors used */ });
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
          fadeRateHz: 0.20,
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

  // === OPERATIONS TAB HANDLERS ===
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

  // ✅ EXISTING WS (DO NOT TOUCH)
// useEffect(() => {
//   if (!canReadSms || simulationMode) {
//     return;
//   }

//   const connectLiveSocket = () => {
//     ...
//   };

//   connectLiveSocket();

//   return () => {
//     ...
//   };
// }, [canReadSms, simulationMode, refreshTelemetry]);


// 🔥🔥 ADD YOUR NEW WEBSOCKET HERE 🔥🔥
useEffect(() => {
  const ws = new WebSocket("ws://localhost:8000/ws/rf");

  ws.onopen = () => {
    console.log("✅ RF WebSocket Connected");
  };

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

  ws.onerror = (err) => {
    console.error("❌ RF WS error:", err);
  };

  ws.onclose = () => {
    console.log("🔌 RF WS disconnected");
  };

  return () => {
    ws.close();
  };
}, []);


// ✅ EXISTING FALLBACK (leave as it is)
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

  // === SIMULATION TAB HANDLERS ===
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

  // === TAB STYLING ===
  const tabButtonStyle = (isActive: boolean) => ({
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    border: "none",
    borderBottom: isActive ? `3px solid ${theme.colors.primary}` : "none",
    background: isActive ? theme.colors.surfaceAlt : "transparent",
    color: isActive ? theme.colors.primary : theme.colors.textSecondary,
    cursor: "pointer" as const,
    fontSize: theme.typography.body.fontSize,
    fontWeight: isActive ? 600 : 400,
    transition: "all 0.2s ease",
  });

  return (
    <AppLayout>
      <PageContainer title="Operator Dashboard">
        <div style={{ display: "grid", gap: theme.spacing.lg }}>
          {/* TAB HEADER */}
          <div
            style={{
              display: "flex",
              borderBottom: `1px solid ${theme.colors.border}`,
              gap: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("operations")}
              style={tabButtonStyle(activeTab === "operations")}
            >
              RF Operations
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("simulation")}
              style={tabButtonStyle(activeTab === "simulation")}
            >
              Simulation Lab
            </button>
          </div>

          {/* OPERATIONS TAB CONTENT */}
          {activeTab === "operations" && (
            <div style={{ display: "grid", gap: theme.spacing.lg }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ margin: 0 }}>RF + DF Operations Dashboard</h2>
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

                {/* <StreamInput
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

                <StatusPanel status={{ ...status, streamActive }} /> */}
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
                    {/* <RfGeolocationPanel
                      detections={detections}
                      alerts={alerts}
                      directionFinderAssets={dfAssets}
                      heatCells={heatCells}
                      triangulation={triangulation}
                      triangulations={triangulations}
                    /> */}
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

                  <div
  style={{
    display: "grid",
    gap: theme.spacing.lg,
    gridTemplateColumns: "1fr",
  }}
>
  <Card title="DF Monitoring Console">
    <div style={{ height: "500px" }}>
      <DFMonitoringConsole />
    </div>
  </Card>
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
          )}

          {/* SIMULATION TAB CONTENT */}
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
                        borderRadius: theme.radius.md,
                        background: theme.colors.primary,
                        color: "#ffffff",
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
                        borderRadius: theme.radius.md,
                        background: theme.colors.success,
                        color: "#ffffff",
                        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                        cursor: "pointer",
                      }}
                    >
                      Show on Operator Map
                    </button>

                    <button
                      type="button"
                      onClick={handleStopDashboardSimulation}
                      style={{
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.radius.md,
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

              <div
                style={{
                  display: "grid",
                  gap: theme.spacing.lg,
                  gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
                }}
              >
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

              <div
                style={{
                  display: "grid",
                  gap: theme.spacing.lg,
                  gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
                }}
              >
                <Card>
                  <h3 style={{ marginTop: 0 }}>Direction / Angle Indicator</h3>
                  <DirectionIndicator vectors={latestFrame?.dfVectors ?? []} />
                </Card>

                <Card>
                  <h3 style={{ marginTop: 0 }}>Simulation Events</h3>
                  <EventPanel events={latestFrame?.events ?? []} />
                </Card>
              </div>

              <Card>
                <h3 style={{ marginTop: 0 }}>Active Signal Snapshot</h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Emitter</th>
                        <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Frequency</th>
                        <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Power</th>
                        <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Location</th>
                        <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Track</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(latestFrame?.activeSignals ?? []).map((signal) => (
                        <tr key={signal.emitterId}>
                          <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{signal.label}</td>
                          <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                            {(signal.frequencyHz / 1_000_000).toFixed(4)} MHz
                          </td>
                          <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                            {signal.powerDbm.toFixed(1)} dBm
                          </td>
                          <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                            {signal.location.latitude.toFixed(4)}, {signal.location.longitude.toFixed(4)}
                          </td>
                          <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                            {signal.isTrackedTarget ? "Triangulated target" : `${signal.headingDeg.toFixed(0)} deg @ ${signal.speedMps.toFixed(1)} m/s`}
                          </td>
                        </tr>
                      ))}

                      {(latestFrame?.activeSignals ?? []).length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: theme.spacing.sm, color: theme.colors.textSecondary }}>
                            No frame available yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>
      </PageContainer>
    </AppLayout>
  );
}
