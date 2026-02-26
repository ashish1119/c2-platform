import { useCallback, useEffect, useState } from "react";
import { acknowledgeAlert, getAlerts, type AlertRecord } from "../api/alerts";
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

  const loadAlerts = useCallback(async () => {
    try {
      setError(null);
      const response = await getAlerts();
      setAlerts(response.data);
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
      <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>Alerts</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Severity</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Status</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Description</th>
            <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Created</th>
            {showAcknowledge && <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => (
            <tr key={alert.id}>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{alert.severity}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{alert.status}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{alert.description ?? "-"}</td>
              <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{alert.created_at ? new Date(alert.created_at).toLocaleString() : "-"}</td>
              {showAcknowledge && (
                <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                  {alert.status === "NEW" ? (
                    <button
                      style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
                      disabled={ackInProgressId === alert.id}
                      onClick={() => handleAcknowledge(alert.id)}
                    >
                      {ackInProgressId === alert.id ? "Acknowledging..." : "Acknowledge"}
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
              )}
            </tr>
          ))}
          {alerts.length === 0 && (
            <tr>
              <td style={{ padding: theme.spacing.sm }} colSpan={showAcknowledge ? 5 : 4}>No alerts found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}