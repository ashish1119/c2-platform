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
import type { SpectrumBin } from "../model/types";

type SpectrumChartProps = {
  bins: SpectrumBin[];
};

export default function SpectrumChart({ bins }: SpectrumChartProps) {
  const { theme } = useTheme();

  const chartData = bins.map((bin) => ({
    frequencyMhz: Number((bin.frequencyHz / 1_000_000).toFixed(4)),
    powerDbm: Number(bin.powerDbm.toFixed(2)),
  }));

  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={theme.colors.border} strokeDasharray="3 3" />
          <XAxis
            dataKey="frequencyMhz"
            tick={{ fill: theme.colors.textSecondary, fontSize: 11 }}
            tickFormatter={(value: number) => `${value.toFixed(2)} MHz`}
          />
          <YAxis
            tick={{ fill: theme.colors.textSecondary, fontSize: 11 }}
            tickFormatter={(value: number) => `${value.toFixed(0)} dBm`}
          />
          <Tooltip
            contentStyle={{
              background: theme.colors.surface,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.sm,
              color: theme.colors.textPrimary,
            }}
            formatter={(value: unknown, name?: string | number) => {
              if (typeof value !== "number") {
                return [String(value), String(name ?? "")];
              }
              return [`${value.toFixed(2)} dBm`, "Power"];
            }}
          />
          <Line
            type="monotone"
            dataKey="powerDbm"
            stroke={theme.colors.primary}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
