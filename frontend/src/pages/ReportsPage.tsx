// import { useState } from "react";
// import AppLayout from "../components/layout/AppLayout";
// import PageContainer from "../components/layout/PageContainer";
// import Card from "../components/ui/Card";
// import { getEOBReport, getStatisticalReport, type EOBEntry, type StatisticalReport } from "../api/reports";
// import { useTheme } from "../context/ThemeContext";

// const defaultFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
// const defaultTo = new Date().toISOString();

// export default function ReportsPage() {
//   const { theme } = useTheme();
//   const [from, setFrom] = useState(defaultFrom);
//   const [to, setTo] = useState(defaultTo);
//   const [stats, setStats] = useState<StatisticalReport | null>(null);
//   const [eobEntries, setEobEntries] = useState<EOBEntry[]>([]);
//   const [loadingStats, setLoadingStats] = useState(false);
//   const [loadingEob, setLoadingEob] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const generateStats = async () => {
//     try {
//       setLoadingStats(true);
//       setError(null);
//       const response = await getStatisticalReport(from, to);
//       setStats(response.data);
//     } catch {
//       setError("Failed to generate statistical report.");
//     } finally {
//       setLoadingStats(false);
//     }
//   };

//   const generateEOB = async () => {
//     try {
//       setLoadingEob(true);
//       setError(null);
//       const response = await getEOBReport(from, to, "LEOB");
//       setEobEntries(response.data);
//     } catch {
//       setError("Failed to generate EOB/LEOB report.");
//     } finally {
//       setLoadingEob(false);
//     }
//   };

//   return (
//     <AppLayout>
//       <PageContainer title="Reports">
//         <Card>
//           <div style={{ display: "grid", gap: 12 }}>
//             <label>
//               From
//               <input style={{ width: "100%", padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} value={from} onChange={(e) => setFrom(e.target.value)} />
//             </label>
//             <label>
//               To
//               <input style={{ width: "100%", padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} value={to} onChange={(e) => setTo(e.target.value)} />
//             </label>
//             <div style={{ display: "flex", gap: 8 }}>
//               <button style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }} onClick={generateStats} disabled={loadingStats}>
//                 {loadingStats ? "Generating..." : "Generate Statistical Report"}
//               </button>
//               <button style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }} onClick={generateEOB} disabled={loadingEob}>
//                 {loadingEob ? "Generating..." : "Generate EOB/LEOB"}
//               </button>
//             </div>
//             {error && <div style={{ color: theme.colors.danger }}>{error}</div>}
//           </div>
//         </Card>

//         {stats && (
//           <Card>
//             <h3>Statistical Report</h3>
//             <div>Total Signals: {stats.total_signals}</div>
//             <div>Unique Modulations: {stats.unique_modulations}</div>
//             <div>Average Power: {stats.avg_power ?? "-"}</div>
//             <div>Max Frequency: {stats.max_frequency ?? "-"}</div>
//           </Card>
//         )}

//         <Card>
//           <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>EOB / LEOB</h3>
//           <table style={{ width: "100%", borderCollapse: "collapse", background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
//             <thead>
//               <tr>
//                 <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Emitter</th>
//                 <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Capability</th>
//                 <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Threat</th>
//                 <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Confidence</th>
//               </tr>
//             </thead>
//             <tbody>
//               {eobEntries.map((entry) => (
//                 <tr key={entry.emitter_designation}>
//                   <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{entry.emitter_designation}</td>
//                   <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{entry.assessed_capability}</td>
//                   <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{entry.threat_level}</td>
//                   <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{entry.confidence}</td>
//                 </tr>
//               ))}
//               {eobEntries.length === 0 && (
//                 <tr>
//                   <td style={{ padding: theme.spacing.sm }} colSpan={4}>No EOB entries generated yet.</td>
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </Card>
//       </PageContainer>
//     </AppLayout>
//   );
// }


import { useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import PageContainer from "../components/layout/PageContainer";
import Card from "../components/ui/Card";
import {
  getEOBReport,
  getStatisticalReport,
  type EOBEntry,
  type StatisticalReport,
} from "../api/reports";
import { useTheme } from "../context/ThemeContext";

const defaultFrom = new Date(Date.now() - 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 16);
const defaultTo = new Date().toISOString().slice(0, 16);

export default function ReportsPage() {
  const { theme } = useTheme();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [stats, setStats] = useState<StatisticalReport | null>(null);
  const [eobEntries, setEobEntries] = useState<EOBEntry[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingEob, setLoadingEob] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const glassStyle = {
    backdropFilter: "blur(10px)",
    background:
      theme.mode === "dark"
        ? "rgba(255,255,255,0.05)"
        : "rgba(255,255,255,0.6)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 10,
  };

  const generateStats = async () => {
    try {
      setLoadingStats(true);
      setError(null);
      const response = await getStatisticalReport(from, to);
      setStats(response.data);
    } catch {
      setError("Failed to generate statistical report.");
    } finally {
      setLoadingStats(false);
    }
  };

  const generateEOB = async () => {
    try {
      setLoadingEob(true);
      setError(null);
      const response = await getEOBReport(from, to, "LEOB");
      setEobEntries(response.data);
    } catch {
      setError("Failed to generate EOB/LEOB report.");
    } finally {
      setLoadingEob(false);
    }
  };

  return (
    <AppLayout>
      <PageContainer title="Reports">

        {/* FILTER */}
        <Card>
          <div style={{ ...glassStyle, padding: 20 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                alignItems: "end",
              }}
            >
              {/* FROM */}
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, color: theme.mode === "dark" ? "#94A3B8" : "#475569" }}>
                  From
                </span>

                <div style={{ position: "relative" }}>
                  <input
                    type="datetime-local"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 36px 10px 12px",
                      borderRadius: 6,
                      border: `1px solid ${theme.colors.border}`,
                      background:
                        theme.mode === "dark"
                          ? "rgba(255,255,255,0.05)"
                          : "#fff",
                      color: theme.mode === "dark" ? "#E2E8F0" : "#0f172a",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 16,
                      color: "#94A3B8",
                    }}
                  >
                    
                  </span>
                </div>
              </label>

              {/* TO */}
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, color: theme.mode === "dark" ? "#94A3B8" : "#475569" }}>
                  To
                </span>

                <div style={{ position: "relative" }}>
                  <input
                    type="datetime-local"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 36px 10px 12px",
                      borderRadius: 6,
                      border: `1px solid ${theme.colors.border}`,
                      background:
                        theme.mode === "dark"
                          ? "rgba(255,255,255,0.05)"
                          : "#fff",
                      color: theme.mode === "dark" ? "#E2E8F0" : "#0f172a",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 16,
                      color: "#94A3B8",
                    }}
                  >
                    
                  </span>
                </div>
              </label>

              {/* BUTTONS */}
              <button
                style={{
                  height: 40,
                  border: "none",
                  borderRadius: 6,
                  background: "#11c1ca",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={generateStats}
                disabled={loadingStats}
              >
                {loadingStats ? "Generating..." : "Generate Statistical Report"}
              </button>

              <button
                style={{
                  height: 40,
                  border: "none",
                  borderRadius: 6,
                  background: "#11c1ca",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={generateEOB}
                disabled={loadingEob}
              >
                {loadingEob ? "Generating..." : "Generate EOB/LEOB"}
              </button>
            </div>

            {error && (
              <div style={{ marginTop: 12, color: theme.colors.danger }}>
                {error}
              </div>
            )}
          </div>
        </Card>

        {/* STATS */}
        {stats && (
          <Card>
            <div style={{ ...glassStyle, padding: 20 }}>
              <h3 style={{ marginBottom: 16 }}>Statistical Report</h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>Total Signals</div>
                  <div style={{ fontWeight: 600 }}>{stats.total_signals}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>Unique Modulations</div>
                  <div style={{ fontWeight: 600 }}>{stats.unique_modulations}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>Average Power</div>
                  <div style={{ fontWeight: 600 }}>{stats.avg_power ?? "-"}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>Max Frequency</div>
                  <div style={{ fontWeight: 600 }}>{stats.max_frequency ?? "-"}</div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* TABLE */}
        <Card>
          <div style={{ ...glassStyle, padding: 20 }}>
            <h3 style={{ marginBottom: 16 }}>EOB / LEOB</h3>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "#64748B", textAlign: "left" }}>
                    <th style={{ padding: 10 }}>Emitter</th>
                    <th style={{ padding: 10 }}>Capability</th>
                    <th style={{ padding: 10 }}>Threat</th>
                    <th style={{ padding: 10 }}>Confidence</th>
                  </tr>
                </thead>

                <tbody>
                  {eobEntries.map((entry) => (
                    <tr key={entry.emitter_designation}>
                      <td style={{ padding: 10 }}>{entry.emitter_designation}</td>
                      <td style={{ padding: 10 }}>{entry.assessed_capability}</td>
                      <td style={{ padding: 10 }}>{entry.threat_level}</td>
                      <td style={{ padding: 10 }}>{entry.confidence}</td>
                    </tr>
                  ))}

                  {eobEntries.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: 12, color: "#64748B" }}>
                        No EOB entries generated yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

      </PageContainer>
    </AppLayout>
  );
}