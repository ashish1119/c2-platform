// import { useCallback, useEffect, useState } from "react";
// import AppLayout from "../components/layout/AppLayout";
// import PageContainer from "../components/layout/PageContainer";
// import Card from "../components/ui/Card";
// import MetricCard from "../components/ui/MetricCard";
// import {
//   getCrfsHealth,
//   getCrfsOperatorDashboard,
//   type CrfsIngestHealth,
//   type CrfsOperatorDashboard,
// } from "../api/crfs";
// import {
//   connectTcpClient,
//   getTcpClientStatus,
//   type TcpClientStatus,
// } from "../api/tcpListener";
// import { useTheme } from "../context/ThemeContext";

// const REFRESH_MS = 5000;
// const LIVE_TCP_HOST = "10.1.0.16";
// const LIVE_TCP_PORT = 9991;

// function hexToAscii(hex: string): string {
//   const pairs = hex.match(/[0-9a-fA-F]{2}/g) ?? [];
//   if (pairs.length === 0) {
//     return "-";
//   }

//   const chars = pairs.map((pair) => {
//     const code = Number.parseInt(pair, 16);
//     if (Number.isNaN(code)) {
//       return ".";
//     }
//     return code >= 32 && code <= 126 ? String.fromCharCode(code) : ".";
//   });

//   return chars.join("");
// }

// function SimpleTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
//   const { theme } = useTheme();

//   return (
//     <div style={{ overflowX: "auto" }}>
//       <table style={{ width: "100%", borderCollapse: "collapse" }}>
//         <thead>
//           <tr>
//             {headers.map((header) => (
//               <th
//                 key={header}
//                 style={{
//                   textAlign: "left",
//                   padding: theme.spacing.sm,
//                   borderBottom: `1px solid ${theme.colors.border}`,
//                 }}
//               >
//                 {header}
//               </th>
//             ))}
//           </tr>
//         </thead>
//         <tbody>
//           {rows.map((row, rowIndex) => (
//             <tr key={`row-${rowIndex}`}>
//               {row.map((cell, cellIndex) => (
//                 <td
//                   key={`cell-${rowIndex}-${cellIndex}`}
//                   style={{
//                     padding: theme.spacing.sm,
//                     borderBottom: `1px solid ${theme.colors.border}`,
//                   }}
//                 >
//                   {cell}
//                 </td>
//               ))}
//             </tr>
//           ))}
//           {rows.length === 0 && (
//             <tr>
//               <td style={{ padding: theme.spacing.sm }} colSpan={headers.length}>
//                 No data available.
//               </td>
//             </tr>
//           )}
//         </tbody>
//       </table>
//     </div>
//   );
// }

// export default function CrfsLivePage() {
//   const { theme } = useTheme();
//   const [health, setHealth] = useState<CrfsIngestHealth | null>(null);
//   const [dashboard, setDashboard] = useState<CrfsOperatorDashboard | null>(null);
//   const [tcpStatus, setTcpStatus] = useState<TcpClientStatus | null>(null);
//   const [tcpError, setTcpError] = useState<string | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const load = useCallback(async (refresh = false) => {
//     try {
//       setError(null);
//       setRefreshing(refresh);
//       let tcpRes;
//       try {
//         tcpRes = await getTcpClientStatus();
//         const status = tcpRes.data;
//         const targetMatches =
//           status.target_host === LIVE_TCP_HOST &&
//           status.target_port === LIVE_TCP_PORT &&
//           status.protocol === "proto" &&
//           status.length_endian === "little";

//         if (!targetMatches) {
//           await connectTcpClient({
//             host: LIVE_TCP_HOST,
//             port: LIVE_TCP_PORT,
//             protocol: "proto",
//             length_endian: "little",
//           });
//           tcpRes = await getTcpClientStatus();
//         }

//         setTcpStatus(tcpRes.data);
//       } catch {
//         setTcpError(`Unable to stream from ${LIVE_TCP_HOST}:${LIVE_TCP_PORT}.`);
//       }
//     } catch {
//       setError("Failed to load CRFS live data.");
//     } finally {
//       setLoading(false);
//       setRefreshing(false);
//     }
//   }, []);

//   useEffect(() => {
//     (async () => { await load(); })();
//     const timer = setInterval(() => { load(true); }, REFRESH_MS);
//     return () => clearInterval(timer);
//   }, [load]);

//   const streams = dashboard?.streams ?? [];
//   const signals = dashboard?.signals ?? [];
//   const locations = dashboard?.locations ?? [];
//   const events = dashboard?.events ?? [];
//   const alerts = dashboard?.alerts ?? [];
//   const recentTcp = (tcpStatus?.recent_messages ?? []).slice().reverse();

//   return (
//     <AppLayout>
//       <PageContainer title="CRFS Live">
//         <div style={{ display: "grid", gap: theme.spacing.lg }}>
//           <div
//             style={{
//               display: "flex",
//               alignItems: "center",
//               justifyContent: "space-between",
//             }}
//           >
//             <h2 style={{ margin: 0 }}>CRFS Live</h2>
//             <button
//               type="button"
//               onClick={() => load(true)}
//               disabled={refreshing}
//               style={{
//                 border: "none",
//                 borderRadius: theme.radius.md,
//                 background: theme.colors.primary,
//                 color: theme.colors.surface,
//                 cursor: refreshing ? "not-allowed" : "pointer",
//                 opacity: refreshing ? 0.75 : 1,
//                 padding: `${theme.spacing.sm} ${theme.spacing.md}`,
//               }}
//             >
//               {refreshing ? "Refreshing..." : "Refresh"}
//             </button>
//           </div>

//           <div
//             style={{
//               display: "grid",
//               gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
//               gap: theme.spacing.md,
//             }}
//           >
//             <MetricCard label="Ingest" value={health?.running ? "Running" : "Stopped"} />
//             <MetricCard label="Streams" value={loading ? "..." : streams.length} />
//             <MetricCard label="Signals" value={loading ? "..." : signals.length} />
//             <MetricCard label="Locations" value={loading ? "..." : locations.length} />
//             <MetricCard label="Events" value={loading ? "..." : events.length} />
//             <MetricCard label="Alerts" value={loading ? "..." : alerts.length} />
//             <MetricCard label="TCP Source" value={tcpStatus?.connected ? "Connected" : "Disconnected"} />
//             <MetricCard label="TCP Frames" value={tcpStatus?.messages_received ?? "-"} />
//           </div>

//           {error && <div style={{ color: theme.colors.danger }}>{error}</div>}
//           {tcpError && <div style={{ color: theme.colors.danger }}>{tcpError}</div>}

//         </div>
//         {/* TCP Decoded Frames table is now absolutely last on the page */}
//         <Card>
//           <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>TCP Decoded Frames (Latest First)</h3>
//           <SimpleTable
//             headers={["Time", "Bytes", "Name", "Stream", "Origin", "UnixTime", "ASCII"]}
//             rows={recentTcp.slice(0, 20).map((message) => [
//               message.received_at ?? "-",
//               message.byte_length ?? "-",
//               message.parsed_fields?.Name ?? "-",
//               message.parsed_fields?.Stream ?? "-",
//               message.parsed_fields?.Origin ?? "-",
//               message.parsed_fields?.UnixTime ?? "-",
//               message.hex_preview ? hexToAscii(message.hex_preview) : "-",
//             ])}
//           />
//         </Card>
//       </PageContainer>
//     </AppLayout>
//   );
// }

import { useCallback, useEffect, useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import PageContainer from "../components/layout/PageContainer";
import Card from "../components/ui/Card";
import MetricCard from "../components/ui/MetricCard";
import {
  getCrfsHealth,
  getCrfsOperatorDashboard,
  type CrfsIngestHealth,
  type CrfsOperatorDashboard,
} from "../api/crfs";
import {
  connectTcpClient,
  getTcpClientStatus,
  type TcpClientStatus,
} from "../api/tcpListener";
import { useTheme } from "../context/ThemeContext";
import { RefreshCw } from "lucide-react";

const REFRESH_MS = 5000;
const LIVE_TCP_HOST = "10.1.0.16";
const LIVE_TCP_PORT = 9991;

function hexToAscii(hex: string): string {
  const pairs = hex.match(/[0-9a-fA-F]{2}/g) ?? [];
  if (pairs.length === 0) return "-";

  return pairs
    .map((pair) => {
      const code = Number.parseInt(pair, 16);
      return code >= 32 && code <= 126 ? String.fromCharCode(code) : ".";
    })
    .join("");
}

/* ================= TABLE ================= */
function SimpleTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  const { theme } = useTheme();

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 14,
        }}
      >
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                style={{
                  textAlign: "left",
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  borderBottom: `1px solid ${theme.colors.border}`,
                  fontWeight: 600,
                  color: theme.colors.textPrimary,
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  style={{
                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                    borderBottom: `1px solid ${theme.colors.border}`,
                    color: theme.colors.textSecondary,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td
                colSpan={headers.length}
                style={{
                  padding: theme.spacing.lg,
                  textAlign: "center",
                  color: theme.colors.textSecondary,
                }}
              >
                No data available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function CrfsLivePage() {
  const { theme } = useTheme();

  const [health, setHealth] = useState<CrfsIngestHealth | null>(null);
  const [dashboard, setDashboard] =
    useState<CrfsOperatorDashboard | null>(null);
  const [tcpStatus, setTcpStatus] = useState<TcpClientStatus | null>(null);

  const [tcpError, setTcpError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    try {
      setError(null);
      setRefreshing(refresh);

      let tcpRes;

      try {
        tcpRes = await getTcpClientStatus();

        const status = tcpRes.data;

        const targetMatches =
          status.target_host === LIVE_TCP_HOST &&
          status.target_port === LIVE_TCP_PORT &&
          status.protocol === "proto" &&
          status.length_endian === "little";

        if (!targetMatches) {
          await connectTcpClient({
            host: LIVE_TCP_HOST,
            port: LIVE_TCP_PORT,
            protocol: "proto",
            length_endian: "little",
          });

          tcpRes = await getTcpClientStatus();
        }

        setTcpStatus(tcpRes.data);
      } catch {
        setTcpError(
          `Unable to stream from ${LIVE_TCP_HOST}:${LIVE_TCP_PORT}.`
        );
      }
    } catch {
      setError("Failed to load CRFS live data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const streams = dashboard?.streams ?? [];
  const signals = dashboard?.signals ?? [];
  const locations = dashboard?.locations ?? [];
  const events = dashboard?.events ?? [];
  const alerts = dashboard?.alerts ?? [];

  const recentTcp = (tcpStatus?.recent_messages ?? [])
    .slice()
    .reverse();

  return (
    <AppLayout>
      <PageContainer title="CRFS Live">
        <div style={{ display: "grid", gap: theme.spacing.lg }}>
          
          {/* HEADER */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: theme.spacing.md,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              CRFS Live
            </h2>

           <button
  onClick={() => load(true)}
  disabled={refreshing}
  style={{
    border: "none",
    borderRadius: 8,
    background: "#11C1CA",
    color: "#fff",
    padding: 10,
    cursor: refreshing ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 10px rgba(17,193,202,0.3)",
    transition: "all 0.2s ease",
    opacity: refreshing ? 0.7 : 1,
  }}
>
  <RefreshCw
    size={18}
    style={{
      animation: refreshing ? "spin 1s linear infinite" : "none",
    }}
  />
</button>
          </div>

          {/* METRIC GRID */}
       {/* ================= METRIC CARDS ================= */}
<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)", // ✅ FIXED 3 COLUMNS
    gap: theme.spacing.md,
  }}
>
  <MetricCard
    label="Ingest"
    value={health?.running ? "Running" : "Stopped"}
    accent="#22c55e"
  />

  <MetricCard
    label="Streams"
    value={loading ? "..." : streams.length}
    accent="#3b82f6"
  />

  <MetricCard
    label="Signals"
    value={loading ? "..." : signals.length}
    accent="#a855f7"
  />

  <MetricCard
    label="Locations"
    value={loading ? "..." : locations.length}
    accent="#f59e0b"
  />

  <MetricCard
    label="Events"
    value={loading ? "..." : events.length}
    accent="#ef4444"
  />

  <MetricCard
    label="Alerts"
    value={loading ? "..." : alerts.length}
    accent="#ec4899"
  />

  <MetricCard
    label="TCP Source"
    value={tcpStatus?.connected ? "Connected" : "Disconnected"}
    accent={tcpStatus?.connected ? "#22c55e" : "#ef4444"}
  />

  <MetricCard
    label="TCP Frames"
    value={tcpStatus?.messages_received ?? "-"}
    accent="#11c1ca"
  />
</div>

          {/* ERRORS */}
          {error && <div style={{ color: theme.colors.danger }}>{error}</div>}
          {tcpError && <div style={{ color: theme.colors.danger }}>{tcpError}</div>}

          {/* TABLE */}
          <Card>
            <h3
              style={{
                marginTop: 0,
                marginBottom: theme.spacing.md,
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              TCP Decoded Frames (Latest First)
            </h3>

            <SimpleTable
              headers={[
                "Time",
                "Bytes",
                "Name",
                "Stream",
                "Origin",
                "UnixTime",
                "ASCII",
              ]}
              rows={recentTcp.slice(0, 20).map((message) => [
                message.received_at ?? "-",
                message.byte_length ?? "-",
                message.parsed_fields?.Name ?? "-",
                message.parsed_fields?.Stream ?? "-",
                message.parsed_fields?.Origin ?? "-",
                message.parsed_fields?.UnixTime ?? "-",
                message.hex_preview
                  ? hexToAscii(message.hex_preview)
                  : "-",
              ])}
            />
          </Card>
        </div>
      </PageContainer>
    </AppLayout>
  );
}