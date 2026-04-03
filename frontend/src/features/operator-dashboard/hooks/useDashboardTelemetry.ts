import { useCallback, useRef, useState } from "react";
import { getAssets, type AssetRecord } from "../../../api/assets";
import { getAlerts, type AlertRecord } from "../../../api/alerts";
import { getHeatMap, getTriangulation, type HeatCell, type TriangulationResult } from "../../../api/rf";
import {
  getSmsDetections,
  getSpectrumOccupancy,
  type SmsDetectionRecord,
  type SmsSpectrumOccupancyBin,
} from "../../../api/operatorDashboard";
import { isDashboardSimulationActive, type DashboardSimulationSnapshot } from "../../../features/signal-simulation/state/dashboardSimulationBridge";
import type { DashboardStatus } from "../../../components/operator-dashboard/StatusPanel";

export type { DashboardStatus };

function isDirectionFinderAsset(asset: AssetRecord): boolean {
  const normalized = (asset.type ?? "").trim().toUpperCase();
  return normalized === "DIRECTION_FINDER" || normalized === "DF";
}

export function useDashboardTelemetry(canReadSms: boolean) {
  const [spectrumBins, setSpectrumBins] = useState<SmsSpectrumOccupancyBin[]>([]);
  const [detections, setDetections] = useState<SmsDetectionRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [dfAssets, setDfAssets] = useState<AssetRecord[]>([]);
  const [heatCells, setHeatCells] = useState<HeatCell[]>([]);
  const [triangulation, setTriangulation] = useState<TriangulationResult | null>(null);
  const [triangulations, setTriangulations] = useState<TriangulationResult[]>([]);
  const [lastTelemetryUpdate, setLastTelemetryUpdate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<number | null>(null);

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

  const refresh = useCallback(
    async (silent = false, immediate = false) => {
      if (isDashboardSimulationActive()) {
        setLoading(false);
        return;
      }

      if (!canReadSms) {
        setLoading(false);
        return;
      }

      const execute = async () => {
        try {
          if (!silent) setLoading(true);
          setError(null);

          const [binsRes, detectionsRes, assetsRes, alertsRes, heatRes, triRes] = await Promise.all([
            getSpectrumOccupancy(120, 240),
            getSmsDetections({ limit: 250 }),
            getAssets(),
            getAlerts().catch(() => ({ data: [] as AlertRecord[] })),
            getHeatMap().catch(() => ({ data: [] as HeatCell[] })),
            getTriangulation().catch(() => ({ data: null as TriangulationResult | null })),
          ]);

          setSpectrumBins(binsRes.data);
          setDetections(detectionsRes.data);
          setDfAssets(assetsRes.data.filter(isDirectionFinderAsset));
          setAlerts(alertsRes.data);
          setHeatCells(heatRes.data);
          setTriangulation(triRes.data);
          setTriangulations(triRes.data ? [triRes.data] : []);
          setLastTelemetryUpdate(new Date().toISOString());
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to load RF/DF telemetry.";
          setError(msg);
        } finally {
          setLoading(false);
        }
      };

      if (immediate) {
        void execute();
        return;
      }

      // Debounce: coalesce WS-triggered refreshes within a 300ms window
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        void execute();
      }, 300);
    },
    [canReadSms]
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
    setError(null);
    setLoading(false);

    setStatus((prev) => ({
      ...prev,
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

  const pushDetection = useCallback((d: {
    id?: string | number;
    freq?: number | null;
    power?: number | null;
    DOA?: number | null;
    doa?: number | null;
    timestamp?: string | null;
    source_node?: string | null;
    status?: string | null;
  }) => {
    const newDetection: SmsDetectionRecord = {
      id: String(d.id ?? `ws-${Date.now()}`),
      source_node: d.source_node ?? "ws_node",
      frequency_hz: typeof d.freq === "number" ? d.freq * 1_000_000 : 0,
      power_dbm: d.power ?? 0,
      doa_azimuth_deg: d.DOA ?? d.doa ?? 0,
      timestamp_utc: d.timestamp ?? new Date().toISOString(),
    };

    setDetections((prev) => {
      if (d.status === "OBSOLETE") {
        return prev.filter((p) => String(p.id) !== String(d.id));
      }
      const idx = prev.findIndex((p) => String(p.id) === String(d.id));
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = newDetection;
        return next;
      }
      return [newDetection, ...prev].slice(0, 200);
    });

    if (typeof d.freq === "number" && Number.isFinite(d.freq)) {
      const incomingHz = Math.round(d.freq * 1_000_000);
      setSpectrumBins((prev) => {
        const tolerance = 500_000;
        const idx = prev.findIndex((b) => Math.abs(b.frequency_hz - incomingHz) <= tolerance);
        const incomingPower = typeof d.power === "number" && Number.isFinite(d.power) ? d.power : undefined;

        if (idx === -1) {
          return [...prev, { frequency_hz: incomingHz, detection_count: 1, max_power_dbm: incomingPower ?? null }]
            .sort((a, b) => a.frequency_hz - b.frequency_hz)
            .slice(-800);
        }

        const next = [...prev];
        next[idx] = {
          ...next[idx],
          detection_count: next[idx].detection_count + 1,
          max_power_dbm:
            incomingPower !== undefined
              ? Math.max(next[idx].max_power_dbm ?? Number.NEGATIVE_INFINITY, incomingPower)
              : next[idx].max_power_dbm,
        };
        return next;
      });
    }
  }, []);

  return {
    spectrumBins,
    detections,
    alerts,
    dfAssets,
    heatCells,
    triangulation,
    triangulations,
    lastTelemetryUpdate,
    loading,
    error,
    status,
    setStatus,
    setDetections,
    refresh,
    applySimulationSnapshot,
    pushDetection,
  };
}
