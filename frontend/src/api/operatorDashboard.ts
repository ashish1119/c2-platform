import api from "./axios";

export type SmsNodeHealthRecord = {
  id: string;
  source_node: string;
  last_heartbeat: string;
  online: boolean;
  metrics: Record<string, unknown>;
  updated_at?: string | null;
};

export type SmsAdapterFileIngestResponse = {
  filename: string;
  source_node: string;
  file_format: "csv" | "json" | "ndjson";
  accepted: number;
  rejected: number;
  errors: string[];
  node_health: SmsNodeHealthRecord;
};

export type SmsAdapterStreamPullRequest = {
  stream_url: string;
  source_node?: string;
  metrics?: Record<string, unknown>;
  timeout_seconds?: number;
};

export type SmsAdapterStreamPullResponse = {
  stream_url: string;
  source_node: string;
  fetched_at: string;
  payload_format: "json" | "ndjson";
  detections_fetched: number;
  accepted: number;
  rejected: number;
  errors: string[];
  node_health: SmsNodeHealthRecord;
};

export type SmsStreamSessionStartRequest = {
  stream_url: string;
  source_node?: string;
  metrics?: Record<string, unknown>;
  pull_interval_seconds?: number;
  timeout_seconds?: number;
};

export type SmsStreamSession = {
  session_id: string;
  stream_url: string;
  source_node: string;
  metrics: Record<string, unknown>;
  pull_interval_seconds: number;
  timeout_seconds: number;
  status: string;
  started_at: string;
  last_pull_at?: string | null;
  last_success_at?: string | null;
  last_error?: string | null;
  consecutive_failures: number;
  detections_fetched_total: number;
  accepted_total: number;
  rejected_total: number;
  payload_format?: "json" | "ndjson" | null;
};

export type SmsStreamWorkerHealth = {
  running: boolean;
  active_sessions: number;
  sessions: SmsStreamSession[];
};

export type SmsLiveEvent = {
  type: string;
  published_at?: string;
  [key: string]: unknown;
};

export type SmsSpectrumOccupancyBin = {
  frequency_hz: number;
  detection_count: number;
  max_power_dbm?: number | null;
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
  raw_payload?: Record<string, unknown>;
};

export type SmsDetectionQuery = {
  from_ts?: string;
  to_ts?: string;
  freq_min_hz?: number;
  freq_max_hz?: number;
  source_node?: string;
  limit?: number;
};

export const uploadRfFile = (file: File, sourceNode?: string) => {
  const form = new FormData();
  form.append("file", file);

  return api.post<SmsAdapterFileIngestResponse>("/sms/adapter/upload-rf-file", form, {
    params: sourceNode ? { source_node: sourceNode } : undefined,
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const pullStreamFromUrl = (payload: SmsAdapterStreamPullRequest) =>
  api.post<SmsAdapterStreamPullResponse>("/sms/adapter/stream/pull", payload);

export const startStreamSession = (payload: SmsStreamSessionStartRequest) =>
  api.post<SmsStreamSession>("/sms/adapter/stream/session/start", payload);

export const stopStreamSession = (sessionId: string) =>
  api.post<SmsStreamSession>(`/sms/adapter/stream/session/${sessionId}/stop`);

export const getStreamSessions = () => api.get<SmsStreamSession[]>("/sms/adapter/stream/sessions");

export const getStreamWorkerHealth = () =>
  api.get<SmsStreamWorkerHealth>("/sms/adapter/stream/worker/health");

export const getSpectrumOccupancy = (windowSeconds = 60, limit = 240) =>
  api.get<SmsSpectrumOccupancyBin[]>("/sms/spectrum/occupancy", {
    params: {
      window_seconds: windowSeconds,
      limit,
    },
  });

export const getSmsDetections = (query: SmsDetectionQuery = {}) =>
  api.get<SmsDetectionRecord[]>("/sms/detections", {
    params: {
      limit: query.limit ?? 250,
      source_node: query.source_node,
      freq_min_hz: query.freq_min_hz,
      freq_max_hz: query.freq_max_hz,
      from_ts: query.from_ts,
      to_ts: query.to_ts,
    },
  });

export const resolveSmsLiveWsUrl = () => {
  if (typeof window === "undefined") {
    return "ws://localhost:8000/sms/ws/live";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:8000/sms/ws/live`;
};
