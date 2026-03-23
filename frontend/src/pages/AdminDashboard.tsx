import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import PageContainer from "../components/layout/PageContainer";
import MetricCard from "../components/ui/MetricCard";
import Card from "../components/ui/Card";
import { getUsers } from "../api/users";
import { getAlerts, simulateAlerts } from "../api/alerts";
import { getRFSignals } from "../api/rf";
import { useTheme } from "../context/ThemeContext";
import { AxiosError } from "axios";

export default function AdminDashboard() {
  const { theme } = useTheme();
  const [activeUsers, setActiveUsers] = useState(0);
  const [openAlerts, setOpenAlerts] = useState(0);
  const [signals, setSignals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [simulateMessage, setSimulateMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [usersRes, alertsRes, signalsRes] = await Promise.all([
          getUsers(),
          getAlerts("NEW"),
          getRFSignals(),
        ]);
        setActiveUsers(usersRes.data.filter((user) => user.is_active).length);
        setOpenAlerts(alertsRes.data.length);
        setSignals(signalsRes.data.length);
      } catch {
        setError("Failed to load dashboard metrics.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSimulateAlerts = async () => {
    try {
      setSimulateLoading(true);
      setSimulateMessage(null);
      const response = await simulateAlerts(50);
      setSimulateMessage(`Simulated ${response.data.created} alerts successfully.`);
    } catch (error) {
      const axiosError = error as AxiosError<{ detail?: string }>;
      const detail = axiosError.response?.data?.detail;
      setSimulateMessage(detail ? `Failed to simulate alerts: ${detail}` : "Failed to simulate alerts.");
    } finally {
      setSimulateLoading(false);
    }
  };

  return (
    <AppLayout>
      <PageContainer title="Admin Dashboard">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: theme.spacing.lg,
            marginBottom: theme.spacing.xl,
          }}
        >
          <MetricCard label="Active Users" value={loading ? "..." : String(activeUsers)} />
          <MetricCard label="Open Alerts" value={loading ? "..." : String(openAlerts)} />
          <MetricCard label="RF Signals" value={loading ? "..." : String(signals)} />
          <MetricCard label="System Health" value={error ? "Degraded" : "Online"} />
        </div>

        {error && <div style={{ marginBottom: theme.spacing.md }}>{error}</div>}

            <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
              <button
                type="button"
                onClick={handleSimulateAlerts}
                disabled={simulateLoading}
                style={{
                  border: "none",
                  borderRadius: theme.radius.md,
                  background: theme.colors.primary,
                  color: "#fff",
                  cursor: simulateLoading ? "not-allowed" : "pointer",
                  opacity: simulateLoading ? 0.7 : 1,
                  padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                }}
              >
                {simulateLoading ? "Simulating..." : "Simulate 50 Alerts"}
              </button>
              {simulateMessage && (
                <span style={{ color: simulateMessage.startsWith("Failed") ? theme.colors.danger : theme.colors.textSecondary }}>
                  {simulateMessage}
                </span>
              )}
            </div>

        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: theme.spacing.md,
            }}
          >
            <div>
              <div style={{ fontSize: theme.typography.h3.fontSize, fontWeight: theme.typography.h3.fontWeight }}>
                Geospatial Ingestion Sources
              </div>
              <div style={{ color: theme.colors.textSecondary }}>Register and manage multi-source geospatial feeds with ISO 19115 metadata.</div>
            </div>
            <Link
              to="/admin/geospatial"
              style={{
                textDecoration: "none",
                borderRadius: theme.radius.md,
                background: theme.colors.primary,
                color: theme.colors.surface,
                padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              Manage Sources
            </Link>
          </div>
        </Card>

        <Card>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: theme.spacing.md,
            }}
          >
            <div>
              <div style={{ fontSize: theme.typography.h3.fontSize, fontWeight: theme.typography.h3.fontWeight }}>
                CRFS Live
              </div>
              <div style={{ color: theme.colors.textSecondary }}>Open live CRFS ingest health and recent activity.</div>
            </div>
            <Link
              to="/crfs/live"
              style={{
                textDecoration: "none",
                borderRadius: theme.radius.md,
                background: theme.colors.primary,
                color: theme.colors.surface,
                padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                fontWeight: 600,
              }}
            >
              Open CRFS Live
            </Link>
          </div>
        </Card>

      </PageContainer>
    </AppLayout>
  );
}