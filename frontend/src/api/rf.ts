import api from "./axios";

export type RFSignal = {
  id: number;
  frequency: number;
  modulation: string;
  power_level: number;
  bandwidth_hz?: number | null;
  confidence: number;
  doa_deg?: number | null;
  latitude: number;
  longitude: number;
  detected_at: string;
};

export type HeatCell = {
  latitude_bucket: number;
  longitude_bucket: number;
  density: number;
};

export type TriangulationPoint = {
  latitude: number;
  longitude: number;
};

export type TriangulationRay = {
  source_id: string;
  source_latitude: number;
  source_longitude: number;
  bearing_deg: number;
  end_latitude: number;
  end_longitude: number;
  confidence: number;
};

export type TriangulationResult = {
  antenna_count: number;
  intersection_count: number;
  centroid_latitude?: number | null;
  centroid_longitude?: number | null;
  roi_polygon: TriangulationPoint[];
  rays: TriangulationRay[];
  warning?: string | null;
};

export const getRFSignals = () => api.get<RFSignal[]>("/rf/signals");

export const getHeatMap = () => api.get<HeatCell[]>("/rf/heatmap");

export const getTriangulation = () => api.get<TriangulationResult>("/rf/triangulation");