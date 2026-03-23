import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "../ui/Card";
import { useTheme } from "../../context/ThemeContext";
import type { SmsDetectionRecord, SmsSpectrumOccupancyBin } from "../../api/operatorDashboard";
import CanvasWaterfall, { type WaterfallBin } from "./CanvasWaterfall";

type WaterfallHistoryViewProps = {
  detections: SmsDetectionRecord[];
  spectrumBins?: SmsSpectrumOccupancyBin[];
  loading?: boolean;
};

type WaterfallPoint = {
  id: string;
  timestampMs: number;
  timeLabel: string;
  frequencyMhz: number;
  frequencyLabel: string;
  powerDbm: number;
};

type HistoryPoint = {
  timestampMs: number;
  timeLabel: string;
  detections: number;
  avgPowerDbm: number | null;
};

function formatFrequencyHz(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(3)} GHz`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(3)} MHz`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(3)} kHz`;
  }
  return `${value.toFixed(1)} Hz`;
}


export default function WaterfallHistoryView({ detections, spectrumBins, loading = false }: WaterfallHistoryViewProps) {
  const { theme } = useTheme();

  const waterfallPoints = useMemo<WaterfallPoint[]>(() => {
    return detections
      .map((detection) => {
        const timestampMs = Date.parse(detection.timestamp_utc);
        if (!Number.isFinite(timestampMs)) {
          return null;
        }

        const powerDbm = typeof detection.power_dbm === "number" ? detection.power_dbm : -110;
        const frequencyMhz = detection.frequency_hz / 1_000_000;

        return {
          id: detection.id,
          timestampMs,
          timeLabel: new Date(timestampMs).toLocaleTimeString(),
          frequencyMhz,
          frequencyLabel: formatFrequencyHz(detection.frequency_hz),
          powerDbm,
        };
      })
      .filter((point): point is WaterfallPoint => point !== null)
      .sort((left, right) => left.timestampMs - right.timestampMs)
      .slice(-260);
  }, [detections]);

  const waterfallSweep = useMemo<WaterfallBin[] | null>(() => {
    if (spectrumBins && spectrumBins.length > 0) {
      return spectrumBins.map((b) => ({
        frequencyHz: b.frequency_hz,
        powerDbm: typeof b.max_power_dbm === "number" ? b.max_power_dbm : -110,
      }));
    }
    if (waterfallPoints.length === 0) return null;
    // Synthesise a sweep from sparse detection points by frequency-bucketing
    const buckets = 128;
    const freqs = waterfallPoints.map((p) => p.frequencyMhz);
    const fMin = Math.min(...freqs);
    const fMax = Math.max(...freqs);
    const spanMhz = Math.max(1, fMax - fMin);
    const accumPow = new Float64Array(buckets).fill(-110);
    const accumCount = new Int32Array(buckets);
    for (const pt of waterfallPoints) {
      const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((pt.frequencyMhz - fMin) / spanMhz) * buckets)));
      accumPow[idx] = accumCount[idx] === 0 ? pt.powerDbm : Math.max(accumPow[idx], pt.powerDbm);
      accumCount[idx] += 1;
    }
    return Array.from({ length: buckets }, (_, i) => ({
      frequencyHz: (fMin + (i / buckets) * spanMhz) * 1_000_000,
      powerDbm: accumPow[i],
    }));
  }, [spectrumBins, waterfallPoints]);

  const historyData = useMemo<HistoryPoint[]>(() => {
    if (waterfallPoints.length === 0) {
      return [];
    }

    const bucketCount = 20;
    const newestTimestamp = waterfallPoints[waterfallPoints.length - 1].timestampMs;
    const oldestTimestamp = Math.max(waterfallPoints[0].timestampMs, newestTimestamp - 10 * 60 * 1000);
    const windowDurationMs = Math.max(1, newestTimestamp - oldestTimestamp);
    const bucketDurationMs = Math.max(1, Math.floor(windowDurationMs / bucketCount));

    const buckets = Array.from({ length: bucketCount }, (_, index) => ({
      timestampMs: oldestTimestamp + index * bucketDurationMs,
      detections: 0,
      powerSum: 0,
      powerSamples: 0,
    }));

    for (const point of waterfallPoints) {
      if (point.timestampMs < oldestTimestamp) {
        continue;
      }

      const relativeOffset = point.timestampMs - oldestTimestamp;
      const bucketIndex = Math.min(bucketCount - 1, Math.max(0, Math.floor(relativeOffset / bucketDurationMs)));
      const bucket = buckets[bucketIndex];

      bucket.detections += 1;
      bucket.powerSum += point.powerDbm;
      bucket.powerSamples += 1;
    }

    return buckets.map((bucket) => ({
      timestampMs: bucket.timestampMs,
      timeLabel: new Date(bucket.timestampMs).toLocaleTimeString(),
      detections: bucket.detections,
      avgPowerDbm: bucket.powerSamples > 0 ? Number((bucket.powerSum / bucket.powerSamples).toFixed(2)) : null,
    }));
  }, [waterfallPoints]);

  return (
    <Card>
      <div style={{ display: "grid", gap: theme.spacing.md }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0 }}>Waterfall / Time History</h3>
            <div style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
              Frequency-time heat points with rolling activity trend.
            </div>
          </div>
          <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>
            {loading ? "Refreshing..." : `Points: ${waterfallPoints.length}`}
          </div>
        </div>

        <CanvasWaterfall
          sweep={waterfallSweep}
          noiseFloorDbm={-110}
          ceilingDbm={-30}
          maxRows={200}
          height={260}
          title="Waterfall History"
        />

        <div
          style={{
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            background: theme.colors.surfaceAlt,
            padding: theme.spacing.sm,
            height: 180,
          }}
        >
          {historyData.length === 0 ? (
            <div style={{ color: theme.colors.textSecondary, padding: theme.spacing.md }}>
              No historical timeline yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid stroke={theme.colors.border} strokeDasharray="3 3" />
                <XAxis dataKey="timestampMs" type="number" tickFormatter={(value: number) => new Date(value).toLocaleTimeString()} />
                <YAxis yAxisId="left" tick={{ fill: theme.colors.textSecondary, fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: theme.colors.textSecondary, fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: theme.colors.surface,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radius.sm,
                    color: theme.colors.textPrimary,
                  }}
                  formatter={(value: unknown, name: string) => {
                    if (name === "avgPowerDbm" && typeof value === "number") {
                      return [`${value.toFixed(2)} dBm`, "Avg Power"];
                    }
                    if (name === "detections" && typeof value === "number") {
                      return [value, "Detections"];
                    }
                    return [String(value ?? "-"), name];
                  }}
                  labelFormatter={(value) => new Date(Number(value)).toLocaleTimeString()}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="detections"
                  stroke={theme.colors.primary}
                  fill={theme.colors.primary}
                  fillOpacity={0.24}
                  isAnimationActive={false}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgPowerDbm"
                  stroke={theme.colors.warning}
                  fill={theme.colors.warning}
                  fillOpacity={0.12}
                  isAnimationActive={false}
                  connectNulls={true}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Card>
  );
}
