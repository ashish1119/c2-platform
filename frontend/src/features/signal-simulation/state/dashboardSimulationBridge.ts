import type { AlertRecord } from "../../../api/alerts";
import type { AssetRecord } from "../../../api/assets";
import type { HeatCell, RFSignal, TriangulationResult } from "../../../api/rf";
import type {
  SmsDetectionRecord,
  SmsSpectrumOccupancyBin,
} from "../../../api/operatorDashboard";
import type { SimulationConfig, SimulationEvent, SimulationFrame } from "../model/types";
import { RfDfSimulator } from "../simulator/rfDfSimulator";

export type SimulationTriangulationResult = TriangulationResult & {
  emitter_id: string;
  emitter_label: string;
  frequency_hz: number;
};

export type DashboardSimulationSnapshot = {
  spectrumBins: SmsSpectrumOccupancyBin[];
  detections: SmsDetectionRecord[];
  alerts: AlertRecord[];
  directionFinderAssets: AssetRecord[];
  signals: RFSignal[];
  heatCells: HeatCell[];
  triangulation: TriangulationResult | null;
  triangulations: SimulationTriangulationResult[];
  lastUpdatedAt: string;
};

type SnapshotListener = (snapshot: DashboardSimulationSnapshot | null) => void;

const MAX_DETECTIONS = 320;
const MAX_ALERTS = 120;

let simulator: RfDfSimulator | null = null;
let simulatorConfig: SimulationConfig | null = null;
let timerId: number | null = null;
let simulationActive = false;
let detectionSequence = 0;
let alertSequence = 0;
let detectionHistory: SmsDetectionRecord[] = [];
let alertHistory: AlertRecord[] = [];
let currentSnapshot: DashboardSimulationSnapshot | null = null;

const listeners = new Set<SnapshotListener>();

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mapSeverity(eventSeverity: SimulationEvent["severity"]): string {
  if (eventSeverity === "critical") {
    return "HIGH";
  }

  if (eventSeverity === "warning") {
    return "MEDIUM";
  }

  return "LOW";
}

function toDirectionFinderAssets(config: SimulationConfig): AssetRecord[] {
  return config.sensors
    .filter((sensor) => sensor.enabled !== false)
    .map((sensor) => ({
      id: sensor.id,
      name: sensor.label,
      type: "DIRECTION_FINDER",
      status: "ACTIVE",
      latitude: Number(sensor.location.latitude.toFixed(6)),
      longitude: Number(sensor.location.longitude.toFixed(6)),
      df_radius_m: Math.round(sensor.rayLengthM ?? config.bearingRayLengthM ?? 12_000),
      bearing_deg: 0,
    }));
}

function toDetectionRecords(frame: SimulationFrame, config: SimulationConfig): SmsDetectionRecord[] {
  const signalById = new Map(frame.activeSignals.map((signal) => [signal.emitterId, signal]));
  const centroidByEmitterId = new Map(
    frame.triangulations.map((triangulation) => [triangulation.emitterId, triangulation.centroid ?? null])
  );

  return frame.bearings.map((bearing, index) => {
    const signal = signalById.get(bearing.emitterId);
    const centroid = centroidByEmitterId.get(bearing.emitterId) ?? null;
    const snrDb = bearing.receivedPowerDbm - config.noiseFloorDbm;
    const confidence = clamp((snrDb - 2) / 24, 0.15, 0.99);

    return {
      id: `sim-det-${detectionSequence++}`,
      source_node: bearing.sensorLabel,
      timestamp_utc: new Date(frame.ts + index * 11).toISOString(),
      frequency_hz: Math.round(signal?.frequencyHz ?? 0),
      bandwidth_hz: Math.round(signal?.bandwidthHz ?? 0),
      power_dbm: Number(bearing.receivedPowerDbm.toFixed(2)),
      snr_db: Number(snrDb.toFixed(2)),
      modulation: signal?.isTrackedTarget ? "DF_TRACK" : "SIMULATION",
      confidence,
      latitude: Number(bearing.sensorLocation.latitude.toFixed(6)),
      longitude: Number(bearing.sensorLocation.longitude.toFixed(6)),
      altitude_m: 0,
      doa_azimuth_deg: Number(bearing.measuredBearingDeg.toFixed(2)),
      doa_elevation_deg: 0,
      doa_rmse_deg: Number(bearing.noiseStdDeg.toFixed(2)),
      raw_payload: {
        source: "dashboard-simulation",
        sensor_id: bearing.sensorId,
        emitter_id: bearing.emitterId,
        emitter_label: bearing.emitterLabel,
        true_bearing_deg: Number(bearing.trueBearingDeg.toFixed(2)),
        bearing_noise_deg: Number(bearing.noiseDeg.toFixed(2)),
        bearing_bias_deg: Number(bearing.biasDeg.toFixed(2)),
        range_m: Number(bearing.distanceMeters.toFixed(1)),
        triangulated_centroid: centroid,
      },
    };
  });
}

function toSpectrumBins(frame: SimulationFrame, config: SimulationConfig): SmsSpectrumOccupancyBin[] {
  return frame.spectrum.map((bin) => ({
    frequency_hz: Math.round(bin.frequencyHz),
    detection_count: Math.max(0, Math.round((bin.powerDbm - config.noiseFloorDbm) * 1.2)),
    max_power_dbm: Number(bin.powerDbm.toFixed(2)),
  }));
}

function toAlertRecords(frame: SimulationFrame): AlertRecord[] {
  const trackedSignal = frame.activeSignals.find((signal) => signal.isTrackedTarget) ?? frame.activeSignals[0] ?? null;
  const triangulationByEmitterId = new Map(frame.triangulations.map((triangulation) => [triangulation.emitterId, triangulation]));
  const trackedTriangulation = trackedSignal ? triangulationByEmitterId.get(trackedSignal.emitterId) ?? null : null;
  const fallbackTriangulation = frame.triangulations[0] ?? null;
  const centroid = trackedTriangulation?.centroid ?? fallbackTriangulation?.centroid ?? null;

  return frame.events.map((event) => {
    const location = centroid ?? trackedSignal?.location ?? { latitude: 12.9716, longitude: 77.5946 };

    return {
      id: `sim-alert-${alertSequence++}`,
      alert_name: "Simulation RF Event",
      alert_type: "SIMULATION",
      severity: mapSeverity(event.severity),
      status: "NEW",
      description: event.message,
      created_at: new Date(event.ts).toISOString(),
      latitude: Number(location.latitude.toFixed(6)),
      longitude: Number(location.longitude.toFixed(6)),
    };
  });
}

function toSignalRecords(frame: SimulationFrame): RFSignal[] {
  const triangulationByEmitterId = new Map(frame.triangulations.map((triangulation) => [triangulation.emitterId, triangulation]));

  return frame.activeSignals.map((signal, index) => {
    const triangulation = triangulationByEmitterId.get(signal.emitterId) ?? null;
    const centroid = triangulation?.centroid ?? signal.location;
    const emitterBearings = frame.bearings.filter((bearing) => bearing.emitterId === signal.emitterId);
    const averageBearingPower =
      emitterBearings.length > 0
        ? emitterBearings.reduce((sum, bearing) => sum + bearing.receivedPowerDbm, 0) / emitterBearings.length
        : signal.powerDbm;

    return {
      id: Math.max(frame.ts + index, 1),
      frequency: Math.round(signal.frequencyHz),
      modulation: signal.isTrackedTarget ? "DF_TRACK" : "DF_SIMULATION",
      power_level: Number(averageBearingPower.toFixed(2)),
      bandwidth_hz: Math.round(signal.bandwidthHz),
      confidence: Number((triangulation?.ellipse ? 0.92 : 0.68).toFixed(2)),
      doa_deg: emitterBearings[0]?.measuredBearingDeg ?? null,
      latitude: Number(centroid.latitude.toFixed(6)),
      longitude: Number(centroid.longitude.toFixed(6)),
      detected_at: new Date(frame.ts).toISOString(),
    };
  });
}

function toHeatCells(frame: SimulationFrame): HeatCell[] {
  const aggregatedByCell = new Map<string, HeatCell>();

  for (const triangulation of frame.triangulations) {
    for (const cell of triangulation.heatmap) {
      const key = `${cell.latitude_bucket}:${cell.longitude_bucket}`;
      const existing = aggregatedByCell.get(key);
      if (!existing || cell.density > existing.density) {
        aggregatedByCell.set(key, {
          latitude_bucket: cell.latitude_bucket,
          longitude_bucket: cell.longitude_bucket,
          density: cell.density,
        });
      }
    }
  }

  return Array.from(aggregatedByCell.values());
}

function toTriangulationResult(frame: SimulationFrame): TriangulationResult | null {
  if (frame.triangulations.length === 0) {
    return null;
  }

  const primaryTriangulation = frame.triangulation ?? frame.triangulations[0];
  const allIntersections = frame.triangulations.flatMap((triangulation) => triangulation.intersections);
  const allRays = frame.triangulations.flatMap((triangulation) => triangulation.rays);
  const centroidCandidates = frame.triangulations
    .map((triangulation) => triangulation.centroid)
    .filter((point): point is NonNullable<typeof point> => point !== null);
  const averageCentroid =
    centroidCandidates.length > 0
      ? {
          latitude:
            centroidCandidates.reduce((sum, point) => sum + point.latitude, 0) /
            centroidCandidates.length,
          longitude:
            centroidCandidates.reduce((sum, point) => sum + point.longitude, 0) /
            centroidCandidates.length,
        }
      : null;

  const confidenceValues = frame.triangulations
    .map((triangulation) => triangulation.ellipse?.confidenceLevel)
    .filter((value): value is number => typeof value === "number");
  const warningMessages = frame.triangulations
    .map((triangulation) => triangulation.warning)
    .filter((warning): warning is string => typeof warning === "string" && warning.trim().length > 0);

  return {
    antenna_count: allRays.length,
    intersection_count: allIntersections.length,
    centroid_latitude: averageCentroid?.latitude ?? primaryTriangulation.centroid?.latitude ?? null,
    centroid_longitude: averageCentroid?.longitude ?? primaryTriangulation.centroid?.longitude ?? null,
    roi_polygon: primaryTriangulation.ellipse?.polygon ?? [],
    intersections: allIntersections.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
    })),
    confidence_level:
      confidenceValues.length > 0
        ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
        : primaryTriangulation.ellipse?.confidenceLevel ?? null,
    rays: allRays.map((ray) => ({
      source_id: ray.sensorId,
      source_latitude: ray.start.latitude,
      source_longitude: ray.start.longitude,
      bearing_deg: ray.bearingDeg,
      end_latitude: ray.end.latitude,
      end_longitude: ray.end.longitude,
      confidence: ray.confidence,
    })),
    warning: warningMessages.length > 0 ? warningMessages.join(" | ") : null,
  };
}

function toTriangulationResults(frame: SimulationFrame): SimulationTriangulationResult[] {
  const frequencyByEmitterId = new Map(
    frame.activeSignals.map((signal) => [signal.emitterId, Math.round(signal.frequencyHz)])
  );

  return frame.triangulations.map((triangulation) => ({
    emitter_id: triangulation.emitterId,
    emitter_label: triangulation.emitterLabel,
    frequency_hz: frequencyByEmitterId.get(triangulation.emitterId) ?? 0,
    antenna_count: triangulation.rays.length,
    intersection_count: triangulation.intersections.length,
    centroid_latitude: triangulation.centroid?.latitude ?? null,
    centroid_longitude: triangulation.centroid?.longitude ?? null,
    roi_polygon: triangulation.ellipse?.polygon ?? [],
    intersections: triangulation.intersections.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
    })),
    confidence_level: triangulation.ellipse?.confidenceLevel ?? null,
    rays: triangulation.rays.map((ray) => ({
      source_id: ray.sensorId,
      source_latitude: ray.start.latitude,
      source_longitude: ray.start.longitude,
      bearing_deg: ray.bearingDeg,
      end_latitude: ray.end.latitude,
      end_longitude: ray.end.longitude,
      confidence: ray.confidence,
    })),
    warning: triangulation.warning ?? null,
  }));
}

function notifyListeners(snapshot: DashboardSimulationSnapshot | null = currentSnapshot): void {
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function tickSimulationFrame(): void {
  if (!simulator || !simulatorConfig) {
    return;
  }

  const frame = simulator.step(Date.now());
  const detectionsFromFrame = toDetectionRecords(frame, simulatorConfig);
  const alertsFromFrame = toAlertRecords(frame);
  const spectrumBins = toSpectrumBins(frame, simulatorConfig);
  const directionFinderAssets = toDirectionFinderAssets(simulatorConfig);
  const signals = toSignalRecords(frame);
  const heatCells = toHeatCells(frame);
  const triangulation = toTriangulationResult(frame);
  const triangulations = toTriangulationResults(frame);

  detectionHistory = [...detectionsFromFrame, ...detectionHistory].slice(0, MAX_DETECTIONS);
  alertHistory = [...alertsFromFrame, ...alertHistory].slice(0, MAX_ALERTS);

  currentSnapshot = {
    spectrumBins,
    detections: detectionHistory,
    alerts: alertHistory,
    directionFinderAssets,
    signals,
    heatCells,
    triangulation,
    triangulations,
    lastUpdatedAt: new Date(frame.ts).toISOString(),
  };

  notifyListeners();
}

export function startDashboardSimulation(config: SimulationConfig): void {
  simulatorConfig = config;
  simulator = new RfDfSimulator(config);
  simulationActive = true;

  detectionSequence = 0;
  alertSequence = 0;
  detectionHistory = [];
  alertHistory = [];
  currentSnapshot = null;

  if (timerId !== null) {
    window.clearInterval(timerId);
  }

  tickSimulationFrame();

  timerId = window.setInterval(() => {
    tickSimulationFrame();
  }, Math.max(60, config.updateIntervalMs));
}

export function publishDashboardSimulationSnapshot(snapshot: DashboardSimulationSnapshot): void {
  simulationActive = true;

  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }

  simulator = null;
  simulatorConfig = null;
  detectionHistory = snapshot.detections.slice(0, MAX_DETECTIONS);
  alertHistory = snapshot.alerts.slice(0, MAX_ALERTS);
  currentSnapshot = {
    ...snapshot,
    detections: detectionHistory,
    alerts: alertHistory,
  };

  notifyListeners();
}

export function stopDashboardSimulation(): void {
  simulationActive = false;

  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }

  simulator = null;
  simulatorConfig = null;
  currentSnapshot = null;
  detectionHistory = [];
  alertHistory = [];
  notifyListeners(null);
}

export function isDashboardSimulationActive(): boolean {
  return simulationActive;
}

export function getDashboardSimulationSnapshot(): DashboardSimulationSnapshot | null {
  return currentSnapshot;
}

export function subscribeDashboardSimulation(listener: SnapshotListener): () => void {
  listeners.add(listener);

  if (currentSnapshot) {
    listener(currentSnapshot);
  }

  return () => {
    listeners.delete(listener);
  };
}
