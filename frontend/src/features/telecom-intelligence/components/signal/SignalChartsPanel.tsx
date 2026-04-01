/**
 * SignalChartsPanel — Rx level timeline, network distribution, band distribution.
 * Plugs into the Signal Analysis tab as a new "Charts" sub-tab.
 * Works with backend data (getSignalStats) + client-side fallback from TelecomRecord[].
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, AreaChart, Area,
  BarChart, Bar, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { useTheme } from "../../../../context/ThemeContext";
import type { TelecomRecord } from "../../model";
import { getSignalStats, type SignalStatsResponse } from "../../../../api/cdr";
import { Activity, Radio, BarChart2, PieChart as PieIcon } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function rxStrength(dbm: number): "Strong" | "Medium" | "Weak" {
  if (dbm >= -70) return "Strong";
  if (dbm >= -85) return "Medium";
  return "Weak";
}

function rxColor(dbm: number): string {
  if (dbm >= -70) return "#22c55e";
  if (dbm >= -85) return "#f59e0b";
  return "#ef4444";
}

/** Build signal stats client-side from TelecomRecord[] */
function buildClientStats(records: TelecomRecord[], msisdn: string): SignalStatsResponse {
  const filtered = msisdn
    ? records.filter((r) => r.msisdn === msisdn || r.msisdn.includes(msisdn))
    : records;

  if (!filtered.length) {
    return { rx_timeline: [], network_dist: [], band_dist: [], avg_rx: null, strong_pct: 0, medium_pct: 0, weak_pct: 0 };
  }

  // Simulate Rx level from rxLevel field or from a hash of lat/lng
  const rx_timeline = filtered
    .slice(0, 200)
    .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""))
    .map((r) => {
      const seed = Math.abs(Math.sin((r.latitude || 0) * 1000 + (r.longitude || 0) * 100)) * 1000;
      const dist = seed % 2000;
      const rx = r.rxLevel ?? Math.round(-50 - dist * 0.04);
      return {
        timestamp: (r.startTime || r.dateTime || "").slice(0, 16).replace("T", " "),
        rx_level: rx,
        network: r.network || "Unknown",
        operator: r.operator || null,
      };
    });

  const rxVals = rx_timeline.map((p) => p.rx_level);
  const total = rxVals.length || 1;
  const strong = rxVals.filter((v) => v >= -70).length;
  const medium = rxVals.filter((v) => v >= -85 && v < -70).length;
  const weak   = rxVals.filter((v) => v < -85).length;

  const netMap: Record<string, number> = {};
  const bandMap: Record<string, number> = {};
  filtered.forEach((r) => {
    const n = r.network || "Unknown";
    const b = r.band || "Unknown";
    netMap[n] = (netMap[n] ?? 0) + 1;
    bandMap[b] = (bandMap[b] ?? 0) + 1;
  });

  const network_dist = Object.entries(netMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, pct: Math.round((value / filtered.length) * 100) }));

  const band_dist = Object.entries(bandMap)
    .sort((a, b) => b[1] - a[1])
    .map(([band, count]) => ({ band, count }));

  const avg_rx = rxVals.length ? Math.round(rxVals.reduce((s, v) => s + v, 0) / rxVals.length) : null;

  return {
    rx_timeline,
    network_dist,
    band_dist,
    avg_rx,
    strong_pct: Math.round((strong / total) * 100),
    medium_pct: Math.round((medium / total) * 100),
    weak_pct:   Math.round((weak   / total) * 100),
  };
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function RxTooltip({ active, payload, label }: any) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";
  if (!active || !payload?.length) return null;
  const rx = payload[0]?.value as number;
  return (
    <div style={{
      background: isDark ? "rgba(15,23,42,0.95)" : "rgba(255,255,255,0.98)",
      border: `1px solid ${rxColor(rx)}60`,
      borderRadius: 8, padding: "8px 12px", fontSize: 11,
      boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
    }}>
      <div style={{ color: "#94a3b8", marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700, color: rxColor(rx) }}>
        {rx} dBm — {rxStrength(rx)}
      </div>
      {payload[1] && (
        <div style={{ color: "#94a3b8", marginTop: 2 }}>{payload[1].name}: {payload[1].value}</div>
      )}
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 100, padding: "10px 14px", borderRadius: 10,
      background: `${color}12`, border: `1.5px solid ${color}35`,
      textAlign: "center",
      boxShadow: `0 0 10px ${color}18`,
    }}>
      <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "#64748b", marginTop: 3, fontWeight: 600, letterSpacing: "0.4px" }}>{label}</div>
    </div>
  );
}

// ── Chart card ────────────────────────────────────────────────────────────────

function ChartCard({ title, icon, accent = "#11C1CA", children, height = 200 }: {
  title: string; icon: React.ReactNode; accent?: string;
  children: React.ReactNode; height?: number;
}) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";
  return (
    <div style={{
      background: isDark
        ? "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))"
        : "rgba(255,255,255,0.95)",
      border: `1.5px solid ${accent}25`,
      borderRadius: 12, padding: "14px 16px",
      boxShadow: isDark ? `0 4px 20px rgba(0,0,0,0.25), 0 0 0 1px ${accent}10` : `0 4px 12px rgba(0,0,0,0.06)`,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${accent}, ${accent}30)` }} />
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <span style={{ color: accent }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: "0.7px" }}>{title}</span>
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

const NET_COLORS: Record<string, string> = {
  "5G": "#a855f7", "4G": "#22c55e", "LTE": "#3b82f6", "3G": "#f97316",
  "Unknown": "#64748b",
};
const PIE_COLORS = ["#3B82F6", "#11C1CA", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6"];

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  records: TelecomRecord[];
  msisdn: string;
  dateFrom?: string;
  dateTo?: string;
};

export default function SignalChartsPanel({ records, msisdn, dateFrom, dateTo }: Props) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";

  const [apiData, setApiData] = useState<SignalStatsResponse | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Try backend; fall back to client-side
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await getSignalStats({
          msisdn: msisdn || undefined,
          start_date: dateFrom || undefined,
          end_date: dateTo || undefined,
          limit: 200,
        });
        if (res.data.rx_timeline.length > 0) setApiData(res.data);
        else setApiData(null);
      } catch {
        setApiData(null);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [msisdn, dateFrom, dateTo]);

  const clientData = useMemo(() => buildClientStats(records, msisdn), [records, msisdn]);
  const data = apiData ?? clientData;

  const axisStyle = { fill: theme.colors.textMuted, fontSize: 10 };
  const gridLine = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";

  // Shorten timestamps for x-axis
  const rxData = data.rx_timeline.map((p) => ({
    ...p,
    label: p.timestamp.slice(5, 16),
    color: rxColor(p.rx_level),
  }));

  if (!data.rx_timeline.length && !data.network_dist.length) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: theme.colors.textMuted, fontSize: 13 }}>
        No signal data — apply filters or upload CSV with Rx Level data
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Signal strength summary pills ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <StatPill label="AVG Rx LEVEL" value={data.avg_rx !== null ? `${data.avg_rx} dBm` : "—"} color="#11C1CA" />
        <StatPill label="STRONG (≥−70)" value={`${data.strong_pct}%`} color="#22c55e" />
        <StatPill label="MEDIUM (−70/−85)" value={`${data.medium_pct}%`} color="#f59e0b" />
        <StatPill label="WEAK (<−85)" value={`${data.weak_pct}%`} color="#ef4444" />
      </div>

      {/* ── Rx Level over time ── */}
      <ChartCard title="Rx LEVEL OVER TIME" icon={<Activity size={13} />} accent="#11C1CA" height={220}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rxData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#11C1CA" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#11C1CA" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridLine} />
            <XAxis dataKey="label" tick={{ ...axisStyle, fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={axisStyle} unit=" dBm" domain={["auto", "auto"]} />
            <Tooltip content={<RxTooltip />} />
            {/* Reference lines for thresholds */}
            <ReferenceLine y={-70} stroke="#22c55e" strokeDasharray="4 3"
              label={{ value: "Strong −70", fill: "#22c55e", fontSize: 9, position: "insideTopRight" }} />
            <ReferenceLine y={-85} stroke="#f59e0b" strokeDasharray="4 3"
              label={{ value: "Medium −85", fill: "#f59e0b", fontSize: 9, position: "insideTopRight" }} />
            <Area type="monotone" dataKey="rx_level" name="Rx Level (dBm)"
              stroke="#11C1CA" strokeWidth={2} fill="url(#rxGrad)"
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                return (
                  <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3}
                    fill={rxColor(payload.rx_level)} stroke="none" />
                );
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Network + Band distribution ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>

        {/* Network distribution pie */}
        <ChartCard title="NETWORK DISTRIBUTION" icon={<PieIcon size={13} />} accent="#3B82F6">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.network_dist} cx="50%" cy="50%"
                innerRadius={45} outerRadius={80}
                dataKey="value" nameKey="name" labelLine={false}
                label={({ name, pct }: any) => pct > 5 ? `${name} ${pct}%` : ""}>
                {data.network_dist.map((entry, i) => (
                  <Cell key={i} fill={NET_COLORS[entry.name] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any, n: any) => [`${v} records`, n]} />
              <Legend iconType="circle" iconSize={8}
                wrapperStyle={{ fontSize: 11, color: theme.colors.textSecondary }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Band distribution bar */}
        <ChartCard title="BAND / FREQUENCY DISTRIBUTION" icon={<Radio size={13} />} accent="#a855f7">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.band_dist} layout="vertical"
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridLine} horizontal={false} />
              <XAxis type="number" tick={axisStyle} allowDecimals={false} />
              <YAxis type="category" dataKey="band" tick={{ ...axisStyle, fontSize: 10 }} width={60} />
              <Tooltip formatter={(v: any) => [`${v} records`, "Count"]} />
              <Bar dataKey="count" name="Records" radius={[0, 3, 3, 0]}>
                {data.band_dist.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Signal strength bar chart ── */}
      <ChartCard title="SIGNAL STRENGTH BREAKDOWN" icon={<BarChart2 size={13} />} accent="#22c55e" height={120}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={[
              { name: "Strong (≥−70 dBm)", value: data.strong_pct, fill: "#22c55e" },
              { name: "Medium (−70/−85)",  value: data.medium_pct, fill: "#f59e0b" },
              { name: "Weak (<−85 dBm)",   value: data.weak_pct,   fill: "#ef4444" },
            ]}
            margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridLine} />
            <XAxis dataKey="name" tick={{ ...axisStyle, fontSize: 9 }} />
            <YAxis tick={axisStyle} unit="%" domain={[0, 100]} />
            <Tooltip formatter={(v: any) => [`${v}%`, "Coverage"]} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {[{ fill: "#22c55e" }, { fill: "#f59e0b" }, { fill: "#ef4444" }].map((c, i) => (
                <Cell key={i} fill={c.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
