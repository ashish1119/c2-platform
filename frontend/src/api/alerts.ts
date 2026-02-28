import api from "./axios";

export type AlertRecord = {
  id: string;
  asset_id?: string | null;
  alert_name?: string | null;
  alert_type?: string | null;
  severity: string;
  status: string;
  description?: string | null;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  created_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export const getAlerts = (status?: string) =>
  api.get<AlertRecord[]>("/alerts", { params: status ? { status } : undefined });

export const acknowledgeAlert = (alertId: string, userId: string) =>
  api.post(`/alerts/${alertId}/ack`, { user_id: userId });