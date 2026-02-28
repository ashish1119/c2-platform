import api from "./axios";

export type DecodioHealth = {
  enabled: boolean;
  state: string;
  connected: boolean;
  host: string;
  port: number;
  reconnect_attempts: number;
  last_error?: string | null;
  last_message_at?: string | null;
  cache?: {
    device_count: number;
    stream_count: number;
    last_sync_at?: string | null;
  };
};

export type DecodioConfig = {
  enabled: boolean;
  host: string;
  port: number;
  connect_timeout_seconds: number;
  read_timeout_seconds: number;
  heartbeat_interval_seconds: number;
  ack_timeout_seconds: number;
  reconnect_max_seconds: number;
  json_format: string;
  event_aliases: Record<string, string[]>;
  updated_at?: string | null;
};

export const getDecodioHealth = () => api.get<DecodioHealth>("/decodio/health");

export const getDecodioConfig = () => api.get<DecodioConfig>("/decodio/config");

export const updateDecodioConfig = (payload: DecodioConfig) =>
  api.put<DecodioConfig>("/decodio/config", payload);

export const modifyDecodioDevice = (payload: Record<string, unknown>) =>
  api.post("/decodio/devices/modify", payload);

export const startDecodioDevice = (payload: Record<string, unknown>) =>
  api.post("/decodio/devices/start", payload);

export const stopDecodioDevice = (payload: Record<string, unknown>) =>
  api.post("/decodio/devices/stop", payload);

export const deleteDecodioDevice = (payload: Record<string, unknown>) =>
  api.post("/decodio/devices/delete", payload);

export const modifyDecodioStream = (payload: Record<string, unknown>) =>
  api.post("/decodio/streams/modify", payload);

export const deleteDecodioStream = (payload: Record<string, unknown>) =>
  api.post("/decodio/streams/delete", payload);

export const getDecodioCarrierInfo = () => api.post("/decodio/methods/get-carrier-info");

export const addDecodioNeighbourStreams = (payload: Record<string, unknown>) =>
  api.post("/decodio/methods/add-neighbour-streams", payload);

export const seedDecodioTestEvents = () => api.post("/decodio/seed-test-events");
