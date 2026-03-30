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

const ESM_CAPABILITIES = [
  {
    title: "Search",
    description: "Scan the RF environment to discover active emitters across monitored bands.",
  },
  {
    title: "Monitor",
    description: "Continuously observe detected signal activity, persistence, and behavioral changes.",
  },
  {
    title: "Intercept",
    description: "Capture communications-bearing frames and protocol metadata for downstream exploitation.",
  },
  {
    title: "Direction Finding",
    description: "Estimate emitter bearing and origin to support locating hostile or suspicious sources.",
  },
  {
    title: "Analysis",
    description: "Classify signal type, source characteristics, and threat behavior without active transmission.",
  },
];

const SIGNAL_DOMAINS = [
  "V/U/SHF bands",
  "Cellular communications",
  "Mobile satellite communications",
  "Passive drone communication detection",
];

const DEPLOYMENT_FACTS = [
  "Designed for mountain and high-altitude terrain",
  "Operational envelope up to 5500 meters elevation",
  "Suitable for border surveillance and difficult terrain monitoring",
  "Assumes rugged, high-reliability field deployment conditions",
];

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

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function formatNumber(value?: number | null, suffix = ""): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return `${value.toLocaleString()}${suffix}`;
}

function StatusBadge({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: active ? "#166534" : "#991b1b",
        background: active ? "#dcfce7" : "#fee2e2",
        border: active ? "1px solid #86efac" : "1px solid #fca5a5",
      }}
    >
      {label}
    </span>
  );
}

function InfoGrid({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  const { theme } = useTheme();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: theme.spacing.md,
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            display: "grid",
            gap: 4,
            padding: theme.spacing.md,
            borderRadius: theme.radius.md,
            background: theme.colors.surfaceAlt,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: theme.colors.textSecondary,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {item.label}
          </span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: theme.colors.textPrimary,
              wordBreak: "break-word",
            }}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function MissionChip({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: "#0f766e",
        background: "#ccfbf1",
        border: "1px solid #99f6e4",
      }}
    >
      {label}
    </span>
  );
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
      setTcpError(null);
      setRefreshing(refresh);

      const [healthRes, dashboardRes] = await Promise.all([
        getCrfsHealth(),
        getCrfsOperatorDashboard(),
      ]);

      setHealth(healthRes.data);
      setDashboard(dashboardRes.data);

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

  const recentSignals = signals.slice(0, 8);
  const recentLocations = locations.slice(0, 8);
  const recentEvents = events.slice(0, 8);
  const recentAlerts = alerts.slice(0, 8);

  return (
    <AppLayout>
      <PageContainer title="CRFS Live">
        <div style={{ display: "grid", gap: theme.spacing.lg }}>
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

            <div
              style={{
                color: theme.colors.textSecondary,
                fontSize: 14,
                flex: 1,
                minWidth: 220,
              }}
            >
              Live ESM mission picture for passive search, monitoring, intercept, direction finding, and signal analysis across RF, cellular, satellite, and drone-linked emitters.
            </div>

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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
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

          {error && (
            <Card>
              <div style={{ color: theme.colors.danger }}>{error}</div>
            </Card>
          )}
          {tcpError && (
            <Card>
              <div style={{ color: theme.colors.danger }}>{tcpError}</div>
            </Card>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.9fr)",
              gap: theme.spacing.lg,
              alignItems: "start",
            }}
          >
            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                <div>
                  <h3
                    style={{
                      marginTop: 0,
                      marginBottom: theme.spacing.xs,
                      fontSize: 18,
                      fontWeight: 600,
                    }}
                  >
                    Mission Justification
                  </h3>
                  <div style={{ color: theme.colors.textSecondary, fontSize: 14, lineHeight: 1.6 }}>
                    This page exists to expose the operational ESM picture for passive surveillance against adversary emitters. It supports detection, observation, interception, bearing estimation, and classification without requiring active transmission.
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: theme.spacing.md,
                  }}
                >
                  {ESM_CAPABILITIES.map((capability) => (
                    <div
                      key={capability.title}
                      style={{
                        display: "grid",
                        gap: 6,
                        padding: theme.spacing.md,
                        borderRadius: theme.radius.md,
                        background: theme.colors.surfaceAlt,
                        border: `1px solid ${theme.colors.border}`,
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, color: theme.colors.textPrimary }}>
                        {capability.title}
                      </span>
                      <span style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 1.5 }}>
                        {capability.description}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: theme.colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Signal Domains Covered
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {SIGNAL_DOMAINS.map((domain) => (
                      <MissionChip key={domain} label={domain} />
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                <div>
                  <h3
                    style={{
                      marginTop: 0,
                      marginBottom: theme.spacing.xs,
                      fontSize: 18,
                      fontWeight: 600,
                    }}
                  >
                    Deployment Environment
                  </h3>
                  <div style={{ color: theme.colors.textSecondary, fontSize: 14, lineHeight: 1.6 }}>
                    The CRFS live picture is intended for austere mountain deployment, including high-altitude border sectors where equipment reliability, persistent passive sensing, and terrain-aware situational awareness are critical.
                  </div>
                </div>

                <InfoGrid
                  items={[
                    { label: "Terrain", value: "Mountains and high-altitude sectors" },
                    { label: "Altitude Envelope", value: "Up to 5500 m" },
                    { label: "Operational Style", value: "Passive surveillance and threat localization" },
                    { label: "Target Set", value: "Hostile communications and drone-linked emitters" },
                  ]}
                />

                <div style={{ display: "grid", gap: 8 }}>
                  {DEPLOYMENT_FACTS.map((fact) => (
                    <div
                      key={fact}
                      style={{
                        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                        borderRadius: theme.radius.md,
                        border: `1px solid ${theme.colors.border}`,
                        background: theme.colors.surfaceAlt,
                        color: theme.colors.textSecondary,
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}
                    >
                      {fact}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: theme.spacing.lg,
            }}
          >
            <Card>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: theme.spacing.md,
                  gap: theme.spacing.md,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                  CRFS Ingest Status
                </h3>
                <StatusBadge
                  label={health?.running ? "Running" : "Stopped"}
                  active={Boolean(health?.running)}
                />
              </div>

              <InfoGrid
                items={[
                  { label: "Endpoint", value: `${health?.host ?? "-"}:${health?.port ?? "-"}` },
                  { label: "Length Endian", value: health?.length_endian ?? "-" },
                  { label: "Active Connections", value: formatNumber(health?.active_connections) },
                  { label: "Frames Received", value: formatNumber(health?.frames_received) },
                  { label: "Frames Processed", value: formatNumber(health?.frames_processed) },
                  { label: "Frames Rejected", value: formatNumber(health?.frames_rejected) },
                  { label: "Frames Failed", value: formatNumber(health?.frames_failed) },
                  { label: "Last Message", value: formatDateTime(health?.last_message_at) },
                ]}
              />

              {health?.last_error && (
                <div
                  style={{
                    marginTop: theme.spacing.md,
                    color: theme.colors.danger,
                    fontSize: 13,
                  }}
                >
                  Last ingest error: {health.last_error}
                </div>
              )}
            </Card>

            <Card>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: theme.spacing.md,
                  gap: theme.spacing.md,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                  TCP Feed Status
                </h3>
                <StatusBadge
                  label={tcpStatus?.connected ? "Connected" : "Disconnected"}
                  active={Boolean(tcpStatus?.connected)}
                />
              </div>

              <InfoGrid
                items={[
                  { label: "Target", value: `${tcpStatus?.target_host ?? LIVE_TCP_HOST}:${tcpStatus?.target_port ?? LIVE_TCP_PORT}` },
                  { label: "Protocol", value: tcpStatus?.protocol ?? "-" },
                  { label: "Length Endian", value: tcpStatus?.length_endian ?? "-" },
                  { label: "Messages Received", value: formatNumber(tcpStatus?.messages_received) },
                  { label: "Messages Rejected", value: formatNumber(tcpStatus?.messages_rejected) },
                  { label: "Last Frame", value: formatDateTime(tcpStatus?.last_message_at) },
                ]}
              />

              {tcpStatus?.last_error && (
                <div
                  style={{
                    marginTop: theme.spacing.md,
                    color: theme.colors.danger,
                    fontSize: 13,
                  }}
                >
                  Last TCP error: {tcpStatus.last_error}
                </div>
              )}
            </Card>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
              gap: theme.spacing.lg,
            }}
          >
            <Card>
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: theme.spacing.md,
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                Active Streams
              </h3>

              <SimpleTable
                headers={["Name", "GUID", "Updated"]}
                rows={streams.map((stream) => [
                  stream.stream_name ?? "-",
                  stream.stream_guid,
                  formatDateTime(stream.updated_at ?? stream.created_at),
                ])}
              />
            </Card>

            <Card>
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: theme.spacing.md,
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                Latest Signals
              </h3>

              <SimpleTable
                headers={["Time", "Frequency", "Power", "Modulation", "Classification"]}
                rows={recentSignals.map((signal) => [
                  formatDateTime(signal.timestamp),
                  formatNumber(signal.center_frequency, " Hz"),
                  formatNumber(signal.power, " dB"),
                  signal.modulation,
                  signal.classification ?? "-",
                ])}
              />
            </Card>

            <Card>
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: theme.spacing.md,
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                Latest Locations
              </h3>

              <SimpleTable
                headers={["Time", "Latitude", "Longitude", "Altitude", "Speed"]}
                rows={recentLocations.map((location) => [
                  formatDateTime(location.timestamp),
                  formatNumber(location.latitude),
                  formatNumber(location.longitude),
                  formatNumber(location.altitude, " m"),
                  formatNumber(location.speed, " m/s"),
                ])}
              />
            </Card>

            <Card>
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: theme.spacing.md,
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                Events and Alerts
              </h3>

              <div style={{ display: "grid", gap: theme.spacing.lg }}>
                <SimpleTable
                  headers={["Event", "Time", "Power", "Origin"]}
                  rows={recentEvents.map((event) => [
                    event.event_type,
                    formatDateTime(event.timestamp),
                    formatNumber(event.power, " dB"),
                    event.origin_guid,
                  ])}
                />

                <SimpleTable
                  headers={["Alert", "Severity", "Status", "Created"]}
                  rows={recentAlerts.map((alert) => [
                    alert.alert_name ?? alert.alert_type ?? "-",
                    alert.severity,
                    alert.status,
                    formatDateTime(alert.created_at),
                  ])}
                />
              </div>
            </Card>
          </div>

          <Card>
            <h3
              style={{
                marginTop: 0,
                marginBottom: theme.spacing.md,
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              TCP Decoded Frames
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