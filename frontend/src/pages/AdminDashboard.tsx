// import { useEffect, useState } from "react";
// import { Link } from "react-router-dom";
// import AppLayout from "../components/layout/AppLayout";
// import PageContainer from "../components/layout/PageContainer";
// import MetricCard from "../components/ui/MetricCard";
// import Card from "../components/ui/Card";
// import { getUsers } from "../api/users";
// import { getAlerts, simulateAlerts } from "../api/alerts";
// import { getRFSignals } from "../api/rf";
// import { useTheme } from "../context/ThemeContext";
// import { AxiosError } from "axios";

// export default function AdminDashboard() {
//   const { theme } = useTheme();
//   const [activeUsers, setActiveUsers] = useState(0);
//   const [openAlerts, setOpenAlerts] = useState(0);
//   const [signals, setSignals] = useState(0);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [simulateLoading, setSimulateLoading] = useState(false);
//   const [simulateMessage, setSimulateMessage] = useState<string | null>(null);

//   useEffect(() => {
//     const load = async () => {
//       try {
//         setLoading(true);
//         setError(null);
//         const [usersRes, alertsRes, signalsRes] = await Promise.all([
//           getUsers(),
//           getAlerts("NEW"),
//           getRFSignals(),
//         ]);
//         setActiveUsers(usersRes.data.filter((user) => user.is_active).length);
//         setOpenAlerts(alertsRes.data.length);
//         setSignals(signalsRes.data.length);
//       } catch {
//         setError("Failed to load dashboard metrics.");
//       } finally {
//         setLoading(false);
//       }
//     };
//     load();
//   }, []);

//   const handleSimulateAlerts = async () => {
//     try {
//       setSimulateLoading(true);
//       setSimulateMessage(null);
//       const response = await simulateAlerts(50);
//       setSimulateMessage(`Simulated ${response.data.created} alerts successfully.`);
//     } catch (error) {
//       const axiosError = error as AxiosError<{ detail?: string }>;
//       const detail = axiosError.response?.data?.detail;
//       setSimulateMessage(detail ? `Failed to simulate alerts: ${detail}` : "Failed to simulate alerts.");
//     } finally {
//       setSimulateLoading(false);
//     }
//   };

//   return (
//     <AppLayout>
//       <PageContainer title="Admin Dashboard">
//         <div
//           style={{
//             display: "grid",
//             gridTemplateColumns: "repeat(4, 1fr)",
//             gap: theme.spacing.lg,
//             marginBottom: theme.spacing.xl,
//           }}
//         >
//           <MetricCard label="Active Users" value={loading ? "..." : String(activeUsers)} />
//           <MetricCard label="Open Alerts" value={loading ? "..." : String(openAlerts)} />
//           <MetricCard label="RF Signals" value={loading ? "..." : String(signals)} />
//           <MetricCard label="System Health" value={error ? "Degraded" : "Online"} />
//         </div>

//         {error && <div style={{ marginBottom: theme.spacing.md }}>{error}</div>}

//             <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
//               <button
//                 type="button"
//                 onClick={handleSimulateAlerts}
//                 disabled={simulateLoading}
//                 style={{
//                   border: "none",
//                   borderRadius: theme.radius.md,
//                   background: theme.colors.primary,
//                   color: "#fff",
//                   cursor: simulateLoading ? "not-allowed" : "pointer",
//                   opacity: simulateLoading ? 0.7 : 1,
//                   padding: `${theme.spacing.xs} ${theme.spacing.md}`,
//                 }}
//               >
//                 {simulateLoading ? "Simulating..." : "Simulate 50 Alerts"}
//               </button>
//               {simulateMessage && (
//                 <span style={{ color: simulateMessage.startsWith("Failed") ? theme.colors.danger : theme.colors.textSecondary }}>
//                   {simulateMessage}
//                 </span>
//               )}
//             </div>

//         <Card>
//           <div
//             style={{
//               display: "flex",
//               alignItems: "center",
//               justifyContent: "space-between",
//               gap: theme.spacing.md,
//             }}
//           >
//             <div>
//               <div style={{ fontSize: theme.typography.h3.fontSize, fontWeight: theme.typography.h3.fontWeight }}>
//                 CRFS Live
//               </div>
//               <div style={{ color: theme.colors.textSecondary }}>Open live CRFS ingest health and recent activity.</div>
//             </div>
//             <Link
//               to="/crfs/live"
//               style={{
//                 textDecoration: "none",
//                 borderRadius: theme.radius.md,
//                 background: theme.colors.primary,
//                 color: theme.colors.surface,
//                 padding: `${theme.spacing.xs} ${theme.spacing.md}`,
//                 fontWeight: 600,
//               }}
//             >
//               Open CRFS Live
//             </Link>
//           </div>
//         </Card>

//       </PageContainer>
//     </AppLayout>
//   );
// }


import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import PageContainer from "../components/layout/PageContainer";
import Card from "../components/ui/Card";
import { getUsers } from "../api/users";
import { getAlerts, simulateAlerts } from "../api/alerts";
import { getRFSignals } from "../api/rf";
import { useTheme } from "../context/ThemeContext";
import { AxiosError } from "axios";

export default function AdminDashboard() {
  const { theme, mode } = useTheme();
  const isDark = mode === "dark";

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

        setActiveUsers(usersRes.data.filter((u) => u.is_active).length);
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

      const res = await simulateAlerts(50);
      setSimulateMessage(`Simulated ${res.data.created} alerts successfully.`);
    } catch (error) {
      const axiosError = error as AxiosError<{ detail?: string }>;
      const detail = axiosError.response?.data?.detail;

      setSimulateMessage(
        detail
          ? `Failed to simulate alerts: ${detail}`
          : "Failed to simulate alerts."
      );
    } finally {
      setSimulateLoading(false);
    }
  };

  // 🎨 CARD STYLE
  const getCardStyle = (type: "blue" | "red" | "purple" | "green") => {
    const styles = {
      blue: { bg: isDark ? "rgba(59,130,246,0.15)" : "#EFF6FF", color: "#3B82F6", icon: "" },
      red: { bg: isDark ? "rgba(239,68,68,0.15)" : "#FEF2F2", color: "#EF4444", icon: "" },
      purple: { bg: isDark ? "rgba(139,92,246,0.15)" : "#F5F3FF", color: "#8B5CF6", icon: "" },
      green: { bg: isDark ? "rgba(34,197,94,0.15)" : "#ECFDF5", color: "#22C55E", icon: "" },
    };
    return styles[type];
  };

  const Metric = ({
    label,
    value,
    type,
  }: {
    label: string;
    value: string;
    type: "blue" | "red" | "purple" | "green";
  }) => {
    const style = getCardStyle(type);

    return (
      <div
        style={{
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
          background: style.bg,
          border: `1px solid ${theme.colors.border}`,
          fontFamily: "Inter, system-ui, sans-serif",
          transition: "all 0.25s ease",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.boxShadow = isDark
            ? "0 10px 25px rgba(0,0,0,0.4)"
            : "0 10px 25px rgba(0,0,0,0.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <div style={{ fontSize: 20 }}>{style.icon}</div>

        <div
          style={{
            fontSize: 13,
            color: theme.colors.textSecondary,
            marginTop: 6,
          }}
        >
          {label}
        </div>

        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: style.color,
            marginTop: 4,
          }}
        >
          {value}
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <PageContainer title="Admin Dashboard">

        {/* METRICS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: theme.spacing.lg,
            marginBottom: theme.spacing.xl,
          }}
        >
          <Metric label="Active Users" value={loading ? "..." : String(activeUsers)} type="blue" />
          <Metric label="Open Alerts" value={loading ? "..." : String(openAlerts)} type="red" />
          <Metric label="RF Signals" value={loading ? "..." : String(signals)} type="purple" />
          <Metric label="System Health" value={error ? "Degraded" : "Online"} type="green" />
        </div>

        {/* ERROR */}
        {error && (
          <div
            style={{
              marginBottom: theme.spacing.lg,
              padding: theme.spacing.md,
              borderRadius: theme.radius.md,
              background: theme.colors.surfaceAlt,
              color: theme.colors.danger,
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            {error}
          </div>
        )}

        {/* ACTION */}
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                alignItems: "center",
                gap: theme.spacing.md,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>
                  Alert Simulation
                </div>
                <div style={{ fontSize: 13, color: theme.colors.textSecondary }}>
                  Generate alerts for testing system behavior.
                </div>
              </div>

              <button
                onClick={handleSimulateAlerts}
                disabled={simulateLoading}
                style={{
                  minWidth: 180,
                  height: 40,
                  border: "none",
                  borderRadius: theme.radius.md,
                  background: theme.colors.primary,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: simulateLoading ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.9";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                {simulateLoading ? "Simulating..." : "Simulate 50 Alerts"}
              </button>
            </div>

            {/* ✅ MESSAGE */}
            {simulateMessage && (
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: simulateMessage.startsWith("Failed")
                    ? theme.colors.danger
                    : theme.colors.success,
                }}
              >
                {simulateMessage}
              </div>
            )}
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
              <div style={{ color: theme.colors.textSecondary }}>
                Open the live CRFS dashboard for ingest and RF monitoring.
              </div>
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
                whiteSpace: "nowrap",
              }}
            >
              Open CRFS Live
            </Link>
          </div>
        </Card>

        {/* CRFS */}
        <div style={{ marginTop: theme.spacing.lg }}>
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                alignItems: "center",
                gap: theme.spacing.md,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>
                  CRFS Live Monitoring
                </div>
                <div style={{ fontSize: 13, color: theme.colors.textSecondary }}>
                  Monitor live ingest health and RF activity streams.
                </div>
              </div>

              <Link
                to="/crfs/live"
                style={{
                  minWidth: 180,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textDecoration: "none",
                  background: theme.colors.primary,
                  color: "#fff",
                  borderRadius: theme.radius.md,
                  fontWeight: 500,
                }}
              >
                Open Dashboard
              </Link>
            </div>
          </Card>
        </div>

      </PageContainer>
    </AppLayout>
  );
}