import React, { useMemo } from "react";
import { useTheme } from "../../../context/ThemeContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, CartesianGrid, ReferenceLine,
  AreaChart, Area,
} from "recharts";
import type {
  DailyVolume, ContactFrequency, DistEntry,
} from "../state/useTelecomAnalytics";
import {
  BarChart2, TrendingUp, PieChart as PieIcon, Activity,
  Users, AlertTriangle, Phone, Clock,
} from "lucide-react";

const COLORS = ["#3B82F6", "#11C1CA", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

// ── Section header ────────────────────────────────────────────────────────
function SectionHeader({
  icon,
  title,
  subtitle,
  accent = "#11C1CA",
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  accent?: string;
}) {
  const { theme } = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `${accent}18`,
        border: `1px solid ${accent}35`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: accent,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: theme.colors.textPrimary, letterSpacing: "0.4px" }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 10, color: theme.colors.textMuted, marginTop: 1 }}>{subtitle}</div>
        )}
      </div>
    </div>
  );
}

// ── Chart card wrapper ────────────────────────────────────────────────────
function ChartCard({
  title,
  subtitle,
  icon,
  accent = "#11C1CA",
  children,
  height = 220,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accent?: string;
  children: React.ReactNode;
  height?: number;
}) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";
  return (
    <div style={{
      background: isDark
        ? "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)"
        : "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.9) 100%)",
      backdropFilter: "blur(14px)",
      border: `1.5px solid ${accent}25`,
      borderRadius: 12,
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      boxShadow: isDark
        ? `0 4px 20px rgba(0,0,0,0.25), 0 0 0 1px ${accent}10`
        : `0 4px 16px rgba(0,0,0,0.06), 0 0 0 1px ${accent}08`,
      transition: "box-shadow 0.2s ease",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Top accent line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${accent}, ${accent}30)`,
      }} />
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {icon && <span style={{ color: accent, opacity: 0.8 }}>{icon}</span>}
          <div style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: "0.8px" }}>
            {title}
          </div>
        </div>
        {subtitle && (
          <div style={{ fontSize: 10, color: theme.colors.textMuted, marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: isDark ? "rgba(15,23,42,0.95)" : "rgba(255,255,255,0.98)",
      border: "1px solid rgba(17,193,202,0.5)",
      borderRadius: 8,
      padding: "10px 14px",
      fontSize: 12,
      boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
      backdropFilter: "blur(8px)",
    }}>
      {label && <div style={{ fontWeight: 800, marginBottom: 6, color: "#11C1CA", fontSize: 11, letterSpacing: "0.5px" }}>{label}</div>}
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color ?? "#fff", display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color ?? "#11C1CA", flexShrink: 0 }} />
          <span style={{ color: isDark ? "#94a3b8" : "#64748b" }}>{p.name ?? p.dataKey}:</span>
          <span style={{ fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, pct, name }: any) {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (parseFloat(pct) < 5) return null;
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {pct}%
    </text>
  );
}

// ── Top Contacts Panel ────────────────────────────────────────────────────
function TopContactsPanel({ contacts }: { contacts: ContactFrequency[] }) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";
  const top5 = contacts.slice(0, 5);

  if (!top5.length) return (
    <div style={{ padding: 20, textAlign: "center", color: theme.colors.textMuted, fontSize: 12 }}>
      No contact data available
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {top5.map((c, i) => {
        const isHighRisk = c.suspicious;
        const isFrequent = c.count >= 5;
        const badge = isHighRisk ? "HIGH RISK" : isFrequent ? "FREQUENT" : null;
        const badgeColor = isHighRisk ? "#EF4444" : "#F59E0B";
        const pct = contacts.length ? Math.round((c.count / contacts.reduce((s, x) => s + x.count, 0)) * 100) : 0;

        return (
          <div key={c.target} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px",
            background: isDark
              ? isHighRisk ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)"
              : isHighRisk ? "rgba(239,68,68,0.05)" : "rgba(0,0,0,0.02)",
            border: `1px solid ${isHighRisk ? "rgba(239,68,68,0.3)" : isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
            borderLeft: `3px solid ${isHighRisk ? "#EF4444" : isFrequent ? "#F59E0B" : "#3B82F6"}`,
            borderRadius: 8,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800, color: theme.colors.textMuted, flexShrink: 0,
            }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: theme.colors.textPrimary, fontFamily: "monospace" }}>
                  {c.target}
                </span>
                {badge && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: "0.5px",
                    color: badgeColor, background: `${badgeColor}18`,
                    border: `1px solid ${badgeColor}40`,
                    padding: "1px 6px", borderRadius: 4,
                  }}>
                    {badge}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 10, color: theme.colors.textMuted }}>
                <span><Phone size={9} style={{ display: "inline", marginRight: 3 }} />{c.count} calls</span>
                <span><Clock size={9} style={{ display: "inline", marginRight: 3 }} />{Math.round(c.totalDuration / 60)}m</span>
              </div>
            </div>
            {/* Mini bar */}
            <div style={{ width: 60, flexShrink: 0 }}>
              <div style={{ height: 4, borderRadius: 2, background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  width: `${pct}%`,
                  background: isHighRisk ? "#EF4444" : "#3B82F6",
                  boxShadow: `0 0 6px ${isHighRisk ? "#EF4444" : "#3B82F6"}60`,
                }} />
              </div>
              <div style={{ fontSize: 9, color: theme.colors.textMuted, textAlign: "right", marginTop: 2 }}>{pct}%</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type Props = {
  dailyVolume: DailyVolume[];
  callTypeDist: DistEntry[];
  operatorDist: DistEntry[];
  topContacts: ContactFrequency[];
  durationTrend: { time: string; duration: number; suspicious: boolean }[];
};

export default function TelecomChartsPanel({
  dailyVolume,
  callTypeDist,
  operatorDist,
  topContacts,
  durationTrend,
}: Props) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";

  const axisStyle = { fill: theme.colors.textMuted, fontSize: 10 };

  const avgDuration = useMemo(() => {
    if (!durationTrend.length) return 0;
    return Math.round(durationTrend.reduce((s, d) => s + d.duration, 0) / durationTrend.length);
  }, [durationTrend]);

  const contactChartData = topContacts.map((c) => ({
    name: c.target.length > 12 ? "…" + c.target.slice(-8) : c.target,
    fullTarget: c.target,
    calls: c.count,
    duration: Math.round(c.totalDuration / 60),
    suspicious: c.suspicious,
  }));

  const volumeData = dailyVolume.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));

  // Suspicious activity trend (area chart data)
  const suspiciousTrend = useMemo(() => {
    const map = new Map<string, { date: string; suspicious: number; normal: number }>();
    durationTrend.forEach((d) => {
      const date = d.time.slice(0, 10);
      if (!map.has(date)) map.set(date, { date, suspicious: 0, normal: 0 });
      const entry = map.get(date)!;
      if (d.suspicious) entry.suspicious++;
      else entry.normal++;
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
      ...d,
      label: d.date.slice(5),
    }));
  }, [durationTrend]);

  if (!dailyVolume.length && !callTypeDist.length) {
    return (
      <div style={{
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.8)",
        border: "1.5px solid rgba(17,193,202,0.25)",
        borderRadius: 12,
        padding: 40,
        textAlign: "center",
        color: theme.colors.textMuted,
        fontSize: 13,
        fontWeight: 600,
      }}>
        No data to chart — apply filters or upload CSV
      </div>
    );
  }

  const gridLine = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Section: Overview Summary ─────────────────────────────────────── */}
      <div>
        <SectionHeader
          icon={<BarChart2 size={16} />}
          title="OVERVIEW SUMMARY"
          subtitle="Communication volume and type breakdown"
          accent="#3B82F6"
        />
        <div style={{ height: 12 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <ChartCard title="CALL FREQUENCY" subtitle="Calls + SMS per date" icon={<BarChart2 size={12} />} accent="#3B82F6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridLine} />
                <XAxis dataKey="label" tick={axisStyle} />
                <YAxis tick={axisStyle} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="calls" name="Calls" fill="#3B82F6" radius={[3, 3, 0, 0]}
                  style={{ filter: "drop-shadow(0 0 4px rgba(59,130,246,0.4))" }} />
                <Bar dataKey="sms" name="SMS" fill="#11C1CA" radius={[3, 3, 0, 0]}
                  style={{ filter: "drop-shadow(0 0 4px rgba(17,193,202,0.4))" }} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="CALL TYPE DISTRIBUTION" subtitle="Voice / SMS / Data breakdown" icon={<PieIcon size={12} />} accent="#11C1CA">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={callTypeDist} cx="50%" cy="50%" outerRadius={80}
                  dataKey="value" labelLine={false} label={PieLabel}>
                  {callTypeDist.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any, name: any) => [`${value ?? 0} (${callTypeDist.find(d => d.name === name)?.pct ?? ""}%)`, String(name ?? "")]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: theme.colors.textSecondary }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="OPERATOR DISTRIBUTION" subtitle="Based on filtered records" icon={<PieIcon size={12} />} accent="#22C55E">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={operatorDist} cx="50%" cy="50%" innerRadius={40} outerRadius={80}
                  dataKey="value" labelLine={false} label={PieLabel}>
                  {operatorDist.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any, name: any) => [`${value ?? 0} (${operatorDist.find(d => d.name === name)?.pct ?? ""}%)`, String(name ?? "")]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: theme.colors.textSecondary }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* ── Section: Risk Analysis ────────────────────────────────────────── */}
      <div>
        <SectionHeader
          icon={<AlertTriangle size={16} />}
          title="RISK ANALYSIS"
          subtitle="Suspicious activity trend over time"
          accent="#EF4444"
        />
        <div style={{ height: 12 }} />
        <ChartCard title="SUSPICIOUS ACTIVITY TREND" subtitle="Normal vs suspicious communications per day"
          icon={<Activity size={12} />} accent="#EF4444" height={200}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={suspiciousTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="suspGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="normGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridLine} />
              <XAxis dataKey="label" tick={axisStyle} />
              <YAxis tick={axisStyle} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="normal" name="Normal" stroke="#3B82F6" strokeWidth={2} fill="url(#normGrad)" />
              <Area type="monotone" dataKey="suspicious" name="Suspicious" stroke="#EF4444" strokeWidth={2} fill="url(#suspGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Section: Communication Pattern ───────────────────────────────── */}
      <div>
        <SectionHeader
          icon={<TrendingUp size={16} />}
          title="COMMUNICATION PATTERN"
          subtitle="Duration trends and top contact analysis"
          accent="#F59E0B"
        />
        <div style={{ height: 12 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          <ChartCard title="DURATION TREND" subtitle="Total call duration per time bucket (aggregated)"
            icon={<TrendingUp size={12} />} accent="#F59E0B">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={durationTrend}
                margin={{ top: 4, right: 8, left: -20, bottom: durationTrend.length > 20 ? 28 : 4 }}
              >
                <defs>
                  <linearGradient id="durGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#11C1CA" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#11C1CA" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridLine} />
                <XAxis
                  dataKey="time"
                  tick={{
                    ...axisStyle,
                    fontSize: 9,
                    // rotate labels when there are many buckets to avoid overlap
                    ...(durationTrend.length > 20 ? { angle: -45, textAnchor: "end" } : {}),
                  }}
                  interval={durationTrend.length > 40 ? Math.floor(durationTrend.length / 20) : "preserveStartEnd"}
                />
                <YAxis tick={axisStyle} unit="m" />
                <Tooltip
                  content={<CustomTooltip />}
                  formatter={(value: any) => [`${value}m`, "Total Duration"]}
                />
                {avgDuration > 0 && (
                  <ReferenceLine y={avgDuration} stroke="#F59E0B" strokeDasharray="4 4"
                    label={{ value: `avg ${avgDuration}m`, fill: "#F59E0B", fontSize: 10 }} />
                )}
                <Line
                  type="monotone"
                  dataKey="duration"
                  name="Duration (min)"
                  stroke="#11C1CA"
                  strokeWidth={2}
                  connectNulls
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    // Only render dots when there are few points — skip for dense data
                    if (durationTrend.length > 30) return <g key={`dot-${cx}-${cy}`} />;
                    return (
                      <circle
                        key={`dot-${cx}-${cy}`}
                        cx={cx} cy={cy}
                        r={payload.suspicious ? 5 : 3}
                        fill={payload.suspicious ? "#EF4444" : "#11C1CA"}
                        stroke="none"
                      />
                    );
                  }}
                  activeDot={{ r: 6, fill: "#11C1CA" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="TOP CONTACTS BY CALL COUNT" subtitle="Most contacted numbers"
            icon={<Users size={12} />} accent="#3B82F6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={contactChartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridLine} horizontal={false} />
                <XAxis type="number" tick={axisStyle} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 10 }} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="calls" name="Calls" radius={[0, 3, 3, 0]}>
                  {contactChartData.map((c, i) => (
                    <Cell key={i} fill={c.suspicious ? "#EF4444" : "#3B82F6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* ── Section: Top Contacts Panel ──────────────────────────────────── */}
      <div>
        <SectionHeader
          icon={<Users size={16} />}
          title="TOP CONTACTS"
          subtitle="Most contacted numbers with risk classification"
          accent="#8B5CF6"
        />
        <div style={{ height: 12 }} />
        <div style={{
          background: isDark
            ? "linear-gradient(135deg, rgba(139,92,246,0.06), rgba(255,255,255,0.02))"
            : "linear-gradient(135deg, rgba(139,92,246,0.04), rgba(255,255,255,0.9))",
          border: "1.5px solid rgba(139,92,246,0.2)",
          borderRadius: 12,
          padding: "16px 18px",
          boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 4px 12px rgba(0,0,0,0.05)",
        }}>
          <TopContactsPanel contacts={topContacts} />
        </div>
      </div>
    </div>
  );
}
