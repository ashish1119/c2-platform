export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type SignalEmitterConfig = {
  id: string;
  label: string;
  baseFrequencyHz: number;
  bandwidthHz: number;
  basePowerDbm: number;
  fadeDepthDb: number;
  fadeRateHz: number;
  driftHz: number;
  driftRateHz: number;
  initialLocation: GeoPoint;
  headingDeg?: number;
  speedMps?: number;
  turnRateDegPerSec?: number;
  enabled?: boolean;
};

export type DfSensorConfig = {
  id: string;
  label: string;
  location: GeoPoint;
  bearingNoiseStdDeg: number;
  bearingBiasDeg?: number;
  confidence?: number;
  rayLengthM?: number;
  enabled?: boolean;
};

export type SimulationConfig = {
  seed: number;
  updateIntervalMs: number;
  waveformSampleRateHz: number;
  waveformSamples: number;
  spectrumMinHz: number;
  spectrumMaxHz: number;
  spectrumBins: number;
  noiseFloorDbm: number;
  historyLimit: number;
  trackingEmitterId?: string;
  bearingRayLengthM?: number;
  parallelAngleThresholdDeg?: number;
  maxIntersectionDistanceM?: number;
  heatmapGridSize?: number;
  heatmapCellSizeM?: number;
  sensors: DfSensorConfig[];
  emitters: SignalEmitterConfig[];
};

export type ActiveSignal = {
  emitterId: string;
  label: string;
  frequencyHz: number;
  powerDbm: number;
  bandwidthHz: number;
  location: GeoPoint;
  headingDeg: number;
  speedMps: number;
  isTrackedTarget: boolean;
};

export type SpectrumBin = {
  frequencyHz: number;
  powerDbm: number;
};

export type WaveformPoint = {
  t: number;
  value: number;
};

export type DfVector = {
  emitterId: string;
  sensorId: string;
  label: string;
  angleDeg: number;
  strengthDbm: number;
};

export type BearingMeasurement = {
  sensorId: string;
  sensorLabel: string;
  sensorLocation: GeoPoint;
  emitterId: string;
  emitterLabel: string;
  measuredBearingDeg: number;
  trueBearingDeg: number;
  noiseDeg: number;
  biasDeg: number;
  noiseStdDeg: number;
  confidence: number;
  receivedPowerDbm: number;
  distanceMeters: number;
  timestampMs: number;
};

export type BearingRay = {
  sensorId: string;
  sensorLabel: string;
  start: GeoPoint;
  end: GeoPoint;
  bearingDeg: number;
  confidence: number;
};

export type IntersectionPoint = {
  latitude: number;
  longitude: number;
  weight: number;
  sourceSensorIds: [string, string];
};

export type ProbabilityEllipse = {
  center: GeoPoint;
  semiMajorAxisM: number;
  semiMinorAxisM: number;
  rotationDeg: number;
  polygon: GeoPoint[];
  confidenceLevel: number;
};

export type SimulationHeatCell = {
  latitude_bucket: number;
  longitude_bucket: number;
  density: number;
};

export type DfTriangulationEstimate = {
  emitterId: string;
  emitterLabel: string;
  centroid: GeoPoint | null;
  intersections: IntersectionPoint[];
  rays: BearingRay[];
  ellipse: ProbabilityEllipse | null;
  heatmap: SimulationHeatCell[];
  warning?: string | null;
};

export type SimulationEvent = {
  id: string;
  ts: number;
  severity: "info" | "warning" | "critical";
  message: string;
};

export type SimulationFrame = {
  ts: number;
  activeSignals: ActiveSignal[];
  spectrum: SpectrumBin[];
  waveform: WaveformPoint[];
  dfVectors: DfVector[];
  bearings: BearingMeasurement[];
  triangulation: DfTriangulationEstimate | null;
  triangulations: DfTriangulationEstimate[];
  events: SimulationEvent[];
};
