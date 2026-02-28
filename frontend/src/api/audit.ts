import api from "./axios";

export type AuditLogRecord = {
  id: number;
  user_id?: string | null;
  action?: string | null;
  entity?: string | null;
  details?: Record<string, unknown>;
  timestamp?: string | null;
  username?: string | null;
};

export const getAuditLogs = (params?: {
  action?: string;
  username?: string;
  start_time?: string;
  end_time?: string;
  limit?: number;
}) =>
  api.get<AuditLogRecord[]>("/audit/logs", { params });
