import { useCallback, useEffect, useState } from "react";
import { acknowledgeAlert, getAlerts, type AlertRecord } from "../api/alerts";
import { getAssets } from "../api/assets";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

type Props = {
  showAcknowledge?: boolean;
};

export default function AlertTable({ showAcknowledge = true }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ackInProgressId, setAckInProgressId] = useState<string | null>(null);
  const [assetNameById, setAssetNameById] = useState<Record<string, string>>({});

  const inferAlertType = (alert: AlertRecord) => {
    if (alert.alert_type && alert.alert_type.trim().length > 0) {
      const normalized = alert.alert_type.trim().toUpperCase();
      if (normalized === "DF" || normalized === "DIRECTION_FINDER") {
        return "Direction Finder";
      }
      return alert.alert_type;
    }
    const description = alert.description ?? "";
    const eventMatch = description.match(/event=([^\s]+)/i);
    if (eventMatch?.[1]) {
      return eventMatch[1].toUpperCase();
    }
    return alert.severity;
  };

  const inferAlertName = (alert: AlertRecord) => {
    if (alert.alert_name && alert.alert_name.trim().length > 0) {
      return alert.alert_name;
    }
    const description = (alert.description ?? "").trim();
    if (description.length > 0) {
      return description.length > 64 ? `${description.slice(0, 64)}...` : description;
    }
    return `${alert.severity} Alert`;
  };

  const inferAlertSource = (alert: AlertRecord) => {
    if (alert.asset_id) {
      return assetNameById[alert.asset_id] ?? "Unknown Asset";
    }

    const description = alert.description ?? "";
    const sourceNameMatch = description.match(/source_name=([^|,\s]+)/i);
    if (sourceNameMatch?.[1]) {
      return sourceNameMatch[1].replace(/_/g, " ");
    }

    const senderMatch = description.match(/sender=([^\s|,]+)/i);
    if (senderMatch?.[1]) {
      return senderMatch[1].replace(/_/g, " ");
    }

    const fromMatch = description.match(/from\s([^:]+):/i);
    if (fromMatch?.[1]) {
      return fromMatch[1].trim();
    }

    return "-";
  };

  const renderOthers = (alert: AlertRecord) => {
    const bits: string[] = [];
    if (alert.acknowledged_by) {
      bits.push(`Ack By: ${alert.acknowledged_by}`);
    }
    if (alert.acknowledged_at) {
      bits.push(`Ack At: ${new Date(alert.acknowledged_at).toLocaleString()}`);
    }
    return bits.length > 0 ? bits.join(" | ") : "-";
  };

  const loadAlerts = useCallback(async () => {
    try {
      setError(null);
      const [alertsResponse, assetsResponse] = await Promise.all([getAlerts(), getAssets()]);
      setAlerts(alertsResponse.data);
      setAssetNameById(
        Object.fromEntries(assetsResponse.data.map((asset) => [asset.id, asset.name]))
      );
    } catch {
      setError("Failed to load alerts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const ws = new WebSocket("ws://localhost:8000/ws/alerts");
    ws.onmessage = () => {
      loadAlerts();
    };

    const interval = setInterval(loadAlerts, 10000);
    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, [loadAlerts]);

  const handleAcknowledge = async (id: string) => {
    if (!user) return;
    try {
      setAckInProgressId(id);
      await acknowledgeAlert(id, user.id);
      await loadAlerts();
    } catch {
      setError("Failed to acknowledge alert.");
    } finally {
      setAckInProgressId(null);
    }
  };

  if (loading) {
    return <div style={{ color: theme.colors.textSecondary }}>Loading alerts...</div>;
  }

  if (error) {
    return <div style={{ color: theme.colors.danger }}>{error}</div>;
  }

  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>Alert List</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>ID</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Details</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Type</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Source</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Date and Time</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Latitude</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Longitude</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Status</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Ack</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Others</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => (
            <tr key={alert.id}>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{alert.id}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{inferAlertName(alert)}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{inferAlertType(alert)}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{inferAlertSource(alert)}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{alert.created_at ? new Date(alert.created_at).toLocaleString() : "-"}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{typeof alert.latitude === "number" ? alert.latitude.toFixed(6) : "-"}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{typeof alert.longitude === "number" ? alert.longitude.toFixed(6) : "-"}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{alert.status}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                {alert.status === "NEW" && showAcknowledge ? (
                  <button
                    style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
                    disabled={ackInProgressId === alert.id}
                    onClick={() => handleAcknowledge(alert.id)}
                  >
                    {ackInProgressId === alert.id ? "Acknowledging..." : "Ack"}
                  </button>
                ) : alert.acknowledged_at ? "Acknowledged" : "-"}
              </td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{renderOthers(alert)}</td>
            </tr>
          ))}
          {alerts.length === 0 && (
            <tr>
              <td style={{ padding: theme.spacing.sm }} colSpan={10}>No alerts found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}