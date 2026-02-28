import api from "./axios";

export type SmsNodeHealthRecord = {
  id: string;
  source_node: string;
  last_heartbeat: string;
  online: boolean;
  metrics: Record<string, unknown>;
  updated_at?: string | null;
};

export type SmsDetectionRecord = {
  id: string;
  source_node: string;
  timestamp_utc: string;
  frequency_hz: number;
  bandwidth_hz?: number | null;
  power_dbm?: number | null;
  snr_db?: number | null;
  modulation?: string | null;
  confidence?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  altitude_m?: number | null;
  doa_azimuth_deg?: number | null;
  doa_elevation_deg?: number | null;
  doa_rmse_deg?: number | null;
  created_at?: string | null;
};

export type SmsTrackRecord = {
  id: string;
  track_code: string;
  first_seen: string;
  last_seen: string;
  frequency_min_hz: number;
  frequency_max_hz: number;
  avg_power_dbm?: number | null;
  mobility?: string | null;
  classification?: string | null;
  threat_level: number;
  centroid_latitude?: number | null;
  centroid_longitude?: number | null;
  metadata: Record<string, unknown>;
};

export type SmsThreatRecord = {
  id: string;
  track_id: string;
  threat_type: string;
  risk_score: number;
  priority: string;
  recommended_action?: string | null;
  status: string;
  details: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
};

export const getSmsNodes = () => api.get<SmsNodeHealthRecord[]>("/sms/nodes");

export const getSmsDetections = (limit = 10) =>
  api.get<SmsDetectionRecord[]>("/sms/detections", { params: { limit } });

export const getSmsTracks = (activeOnly = false, limit = 10) =>
  api.get<SmsTrackRecord[]>("/sms/tracks", {
    params: { active_only: activeOnly, limit },
  });

export const getSmsThreats = (limit = 10) =>
  api.get<SmsThreatRecord[]>("/sms/threats", { params: { limit } });
