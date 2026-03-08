import api from "./axios";

export type TcpListenerHealth = {
  enabled: boolean;
  running: boolean;
  host: string;
  port: number;
  active_connections: number;
  total_connections: number;
  messages_received: number;
  messages_rejected: number;
  idle_timeout_seconds: number;
  max_line_bytes: number;
};

export type TcpListenerEndpointUpdateRequest = {
  host: string;
  port: number;
};

export type TcpListenerConnectionTest = {
  success: boolean;
  message: string;
};

export type TcpListenerSendTestRequest = {
  host: string;
  port: number;
  event_type: string;
  value?: number;
  unit?: string;
  severity_hint?: string;
};

export type TcpListenerSendTestResponse = {
  success: boolean;
  message: string;
  payload: Record<string, unknown>;
};

export type TcpClientStatus = {
  connected: boolean;
  target_host?: string | null;
  target_port?: number | null;
  protocol?: "line" | "proto" | null;
  length_endian?: "big" | "little" | null;
  messages_received: number;
  messages_rejected: number;
  last_message_at?: string | null;
  last_error?: string | null;
  recent_messages: Array<{
    received_at?: string;
    raw?: string;
    protocol?: "line" | "proto";
    byte_length?: number;
    ascii_preview?: string;
    hex_preview?: string;
    parsed_fields?: Record<string, string>;
    decode_error?: string;
  }>;
};

export type TcpClientConnectRequest = {
  host: string;
  port: number;
  protocol?: "line" | "proto";
  length_endian?: "big" | "little";
};

export const getTcpListenerHealth = () =>
  api.get<TcpListenerHealth>("/tcp-listener/health");

export const updateTcpListenerEndpoint = (payload: TcpListenerEndpointUpdateRequest) =>
  api.put<TcpListenerHealth>("/tcp-listener/endpoint", payload);

export const testTcpListenerConnection = (payload: TcpListenerEndpointUpdateRequest) =>
  api.post<TcpListenerConnectionTest>("/tcp-listener/test-connection", payload);

export const sendTcpListenerTestMessage = (payload: TcpListenerSendTestRequest) =>
  api.post<TcpListenerSendTestResponse>("/tcp-listener/send-test", payload);

export const getTcpClientStatus = () =>
  api.get<TcpClientStatus>("/tcp-listener/client/status");

export const connectTcpClient = (payload: TcpClientConnectRequest) =>
  api.post<TcpClientStatus>("/tcp-listener/client/connect", payload);

export const disconnectTcpClient = () =>
  api.post<TcpClientStatus>("/tcp-listener/client/disconnect");
