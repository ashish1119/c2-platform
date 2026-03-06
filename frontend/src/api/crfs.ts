import api from "./axios";

export type CrfsIngestHealth = {
  enabled: boolean;
  running: boolean;
  host: string;
  port: number;
  length_endian: string;
  active_connections: number;
  total_connections: number;
  frames_received: number;
  frames_processed: number;
  frames_rejected: number;
  frames_failed: number;
  max_message_bytes: number;
  idle_timeout_seconds: number;
  last_message_at?: string | null;
  last_error?: string | null;
  realtime?: Record<string, unknown>;
};

export type CrfsStream = {
  stream_guid: string;
  stream_name?: string | null;
  color?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CrfsSignal = {
  id: number;
  timestamp: string;
  center_frequency?: number | null;
  bandwidth?: number | null;
  power?: number | null;
  snr?: number | null;
  modulation: string;
  classification?: string | null;
  aoa_bearing?: number | null;
  aoa_elevation?: number | null;
  origin_guid: string;
  stream_guid: string;
  created_at?: string | null;
};

export type CrfsLocation = {
  id: number;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
  timestamp: string;
  origin_guid: string;
  stream_guid: string;
  created_at?: string | null;
};

export type CrfsEvent = {
  id: number;
  event_type: string;
  frequency_center?: number | null;
  frequency_span?: number | null;
  power?: number | null;
  timestamp: string;
  origin_guid: string;
  stream_guid: string;
  payload_json: Record<string, unknown>;
  created_at?: string | null;
};

export type CrfsAlert = {
  id: string;
  alert_name?: string | null;
  alert_type?: string | null;
  severity: string;
  status: string;
  description?: string | null;
  created_at?: string | null;
};

export type CrfsOperatorDashboard = {
  streams: CrfsStream[];
  signals: CrfsSignal[];
  locations: CrfsLocation[];
  events: CrfsEvent[];
  alerts: CrfsAlert[];
  realtime_events: Record<string, unknown>[];
};

export const getCrfsHealth = () => api.get<CrfsIngestHealth>("/crfs/health");

export const getCrfsOperatorDashboard = () =>
  api.get<CrfsOperatorDashboard>("/crfs/dashboard/operator");
