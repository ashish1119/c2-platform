import { useEffect, useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import PageContainer from "../components/layout/PageContainer";
import MetricCard from "../components/ui/MetricCard";
import AlertTable from "../components/AlertTable";
import { getUsers } from "../api/users";
import { getAlerts } from "../api/alerts";
import { getRFSignals } from "../api/rf";
import { useTheme } from "../context/ThemeContext";

export default function AdminDashboard() {
  const { theme } = useTheme();
  const [activeUsers, setActiveUsers] = useState(0);
  const [openAlerts, setOpenAlerts] = useState(0);
  const [signals, setSignals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        <AlertTable />
      </PageContainer>
    </AppLayout>
  );
}