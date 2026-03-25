import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "../../../context/ThemeContext";
import type { WaveformPoint } from "../model/types";

type WaveformChartProps = {
  points: WaveformPoint[];
};

export default function WaveformChart({ points }: WaveformChartProps) {
  const { theme } = useTheme();

  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={theme.colors.border} strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            tick={{ fill: theme.colors.textSecondary, fontSize: 11 }}
            tickFormatter={(value: number) => `${(value * 1000).toFixed(2)} ms`}
          />
          <YAxis tick={{ fill: theme.colors.textSecondary, fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: theme.colors.surface,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.sm,
              color: theme.colors.textPrimary,
            }}
            formatter={(value: unknown, name: string) => {
              if (typeof value !== "number") {
                return [String(value), name];
              }
              return [value.toFixed(3), "Amplitude"];
            }}
            labelFormatter={(value) => `${(Number(value) * 1000).toFixed(2)} ms`}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={theme.colors.warning}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
