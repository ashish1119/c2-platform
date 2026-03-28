import { useMemo } from "react";
import { useTheme } from "../../../context/ThemeContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, CartesianGrid, ReferenceLine,
} from "recharts";
import type {
  DailyVolume, ContactFrequency, DistEntry,
} from "../state/useTelecomAnalytics";

const COLORS = ["#3B82F6", "#11C1CA", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

function ChartCard({
  title,
  subtitle,
  children,
  height = 220,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
}) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";
  return (
    <div
      style={{
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.8)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(17,193,202,0.3)",
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#11C1CA", letterSpacing: "0.8px" }}>
          {title}
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
    <div
      style={{
        background: isDark ? "#1E293B" : "#fff",
        border: "1px solid rgba(17,193,202,0.4)",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
      }}
    >
      {label && <div style={{ fontWeight: 700, marginBottom: 4, color: "#11C1CA" }}>{label}</div>}
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color ?? "#fff", display: "flex", gap: 8 }}>
          <span>{p.name ?? p.dataKey}:</span>
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

  const axisStyle = {
    fill: theme.colors.textMuted,
    fontSize: 10,
  };

  const avgDuration = useMemo(() => {
    if (!durationTrend.length) return 0;
    return Math.round(durationTrend.reduce((s, d) => s + d.duration, 0) / durationTrend.length);
  }, [durationTrend]);

  // Shorten target numbers for display
  const contactChartData = topContacts.map((c) => ({
    name: c.target.length > 12 ? "…" + c.target.slice(-8) : c.target,
    fullTarget: c.target,
    calls: c.count,
    duration: Math.round(c.totalDuration / 60),
    suspicious: c.suspicious,
  }));

  // Shorten dates for x-axis
  const volumeData = dailyVolume.map((d) => ({
    ...d,
    label: d.date.slice(5), // "MM-DD"
  }));

  if (!dailyVolume.length && !callTypeDist.length) {
    return (
      <div
        style={{
          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.8)",
          border: "1px solid rgba(17,193,202,0.3)",
          borderRadius: 10,
          padding: 32,
          textAlign: "center",
          color: theme.colors.textMuted,
          fontSize: 13,
        }}
      >
        No data to chart — apply filters or upload CSV
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 4,
            height: 20,
            background: "linear-gradient(to bottom, #11C1CA, #3B82F6)",
            borderRadius: 2,
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 700, color: theme.colors.textPrimary, letterSpacing: "0.5px" }}>
          ANALYTICS & INSIGHTS
        </span>
        <span style={{ fontSize: 11, color: theme.colors.textMuted }}>
          — all charts reflect filtered data
        </span>
      </div>

      {/* Row 1: Bar + Pies */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
        }}
      >
        {/* Call Volume by Day */}
        <ChartCard title="CALL VOLUME BY DAY" subtitle="Calls + SMS per date" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volumeData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />
              <XAxis dataKey="label" tick={axisStyle} />
              <YAxis tick={axisStyle} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="calls" name="Calls" fill="#3B82F6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="sms" name="SMS" fill="#11C1CA" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Call Type Distribution */}
        <ChartCard title="CALL TYPE DISTRIBUTION" subtitle="Voice / SMS / Data breakdown" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={callTypeDist}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                labelLine={false}
                label={PieLabel}
              >
                {callTypeDist.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any, name: any) => [`${value ?? 0} (${callTypeDist.find(d => d.name === name)?.pct ?? ""}%)`, String(name ?? "")]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: theme.colors.textSecondary }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Operator Distribution */}
        <ChartCard title="OPERATOR DISTRIBUTION" subtitle="Based on filtered records" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={operatorDist}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                dataKey="value"
                labelLine={false}
                label={PieLabel}
              >
                {operatorDist.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any, name: any) => [`${value ?? 0} (${operatorDist.find(d => d.name === name)?.pct ?? ""}%)`, String(name ?? "")]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: theme.colors.textSecondary }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2: Top Contacts + Duration Trend */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 12,
        }}
      >
        {/* Top Contacts */}
        <ChartCard title="TOP CONTACTS" subtitle="By call count (click target to analyse)" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={contactChartData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} horizontal={false} />
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

        {/* Duration Trend */}
        <ChartCard title="CALL DURATION TREND" subtitle="Duration in minutes over time" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={durationTrend.slice(-50)} // last 50 for perf
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />
              <XAxis dataKey="time" tick={{ ...axisStyle, fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={axisStyle} unit="m" />
              <Tooltip content={<CustomTooltip />} />
              {avgDuration > 0 && (
                <ReferenceLine
                  y={avgDuration}
                  stroke="#F59E0B"
                  strokeDasharray="4 4"
                  label={{ value: `avg ${avgDuration}m`, fill: "#F59E0B", fontSize: 10 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="duration"
                name="Duration (min)"
                stroke="#11C1CA"
                strokeWidth={2}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  return (
                    <circle
                      key={`dot-${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
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
      </div>
    </div>
  );
}
