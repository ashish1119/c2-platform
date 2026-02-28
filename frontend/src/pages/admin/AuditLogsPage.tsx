import { useEffect, useState } from "react";

import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";
import { getAuditLogs, type AuditLogRecord } from "../../api/audit";
import { useTheme } from "../../context/ThemeContext";

export default function AuditLogsPage() {
  const { theme } = useTheme();
  const [rows, setRows] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("PERMISSION_WORKFLOW_APPLY");
  const [usernameFilter, setUsernameFilter] = useState("");
  const [startTimeFilter, setStartTimeFilter] = useState("");
  const [endTimeFilter, setEndTimeFilter] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAuditLogs({
        action: actionFilter || undefined,
        username: usernameFilter || undefined,
        start_time: startTimeFilter || undefined,
        end_time: endTimeFilter || undefined,
        limit: 200,
      });
      setRows(res.data);
    } catch {
      setError("Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const inputStyle: React.CSSProperties = {
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    background: theme.colors.surfaceAlt,
    color: theme.colors.textPrimary,
  };

  const buttonStyle: React.CSSProperties = {
    border: "none",
    borderRadius: theme.radius.md,
    background: theme.colors.primary,
    color: "#fff",
    cursor: "pointer",
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
  };

  return (
    <AppLayout>
      <PageContainer title="Audit Logs">
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: theme.spacing.md }}>
            <input
              style={inputStyle}
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              placeholder="Filter by action (optional)"
            />
            <button style={buttonStyle} onClick={load} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, marginBottom: theme.spacing.md }}>
            <input
              style={inputStyle}
              value={usernameFilter}
              onChange={(event) => setUsernameFilter(event.target.value)}
              placeholder="Filter by username"
            />
            <input
              style={inputStyle}
              type="datetime-local"
              value={startTimeFilter}
              onChange={(event) => setStartTimeFilter(event.target.value)}
            />
            <input
              style={inputStyle}
              type="datetime-local"
              value={endTimeFilter}
              onChange={(event) => setEndTimeFilter(event.target.value)}
            />
            <button
              style={buttonStyle}
              onClick={() => {
                setUsernameFilter("");
                setStartTimeFilter("");
                setEndTimeFilter("");
              }}
              disabled={loading}
            >
              Clear
            </button>
          </div>

          {error && <div style={{ color: theme.colors.danger, marginBottom: theme.spacing.sm }}>{error}</div>}

          <table style={{ width: "100%", borderCollapse: "collapse", background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Time</th>
                <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>User</th>
                <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Action</th>
                <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Entity</th>
                <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{row.timestamp ?? "-"}</td>
                  <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{row.username ?? row.user_id ?? "-"}</td>
                  <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{row.action ?? "-"}</td>
                  <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{row.entity ?? "-"}</td>
                  <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {JSON.stringify(row.details ?? {}, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: theme.spacing.sm }}>No audit logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </PageContainer>
    </AppLayout>
  );
}
