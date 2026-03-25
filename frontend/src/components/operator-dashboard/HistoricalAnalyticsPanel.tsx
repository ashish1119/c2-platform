import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "../ui/Card";
import { useTheme } from "../../context/ThemeContext";
import type { SmsDetectionRecord } from "../../api/operatorDashboard";

type HistoricalAnalyticsPanelProps = {
  detections: SmsDetectionRecord[];
};

type BandPoint = {
  band: string;
  count: number;
};

type ModulationPoint = {
  name: string;
  value: number;
};

const PIE_COLORS = ["#38bdf8", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#a3a3a3"];

function classifyBand(frequencyHz: number): string {
  if (frequencyHz < 30_000_000) return "HF";
  if (frequencyHz < 300_000_000) return "VHF";
  if (frequencyHz < 1_000_000_000) return "UHF";
  if (frequencyHz < 6_000_000_000) return "SHF";
  return "EHF";
}

export default function HistoricalAnalyticsPanel({ detections }: HistoricalAnalyticsPanelProps) {
  const { theme } = useTheme();

  const analytics = useMemo(() => {
    const sourceSet = new Set<string>();
    const bandCountMap = new Map<string, number>();
    const modulationCountMap = new Map<string, number>();

    let confidenceSum = 0;
    let confidenceSamples = 0;
    let powerSum = 0;
    let powerSamples = 0;
    let interferenceCandidates = 0;

    for (const detection of detections) {
      sourceSet.add(detection.source_node);

      const band = classifyBand(detection.frequency_hz);
      bandCountMap.set(band, (bandCountMap.get(band) ?? 0) + 1);

      const modulation = (detection.modulation ?? "UNKNOWN").trim() || "UNKNOWN";
      modulationCountMap.set(modulation, (modulationCountMap.get(modulation) ?? 0) + 1);

      if (typeof detection.confidence === "number") {
        confidenceSamples += 1;
        confidenceSum += detection.confidence <= 1 ? detection.confidence * 100 : detection.confidence;
      }

      if (typeof detection.power_dbm === "number") {
        powerSamples += 1;
        powerSum += detection.power_dbm;
      }

      if (
        typeof detection.power_dbm === "number" &&
        typeof detection.snr_db === "number" &&
        detection.power_dbm >= -70 &&
        detection.snr_db < 4
      ) {
        interferenceCandidates += 1;
      }
    }

    const bandData: BandPoint[] = Array.from(bandCountMap.entries())
      .map(([band, count]) => ({ band, count }))
      .sort((left, right) => right.count - left.count);

    const modulationData: ModulationPoint[] = Array.from(modulationCountMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 6);

    return {
      totalDetections: detections.length,
      activeSources: sourceSet.size,
      avgConfidence: confidenceSamples > 0 ? Number((confidenceSum / confidenceSamples).toFixed(2)) : null,
      avgPower: powerSamples > 0 ? Number((powerSum / powerSamples).toFixed(2)) : null,
      interferenceCandidates,
      bandData,
      modulationData,
    };
  }, [detections]);

  return (
    <Card>
      <div style={{ display: "grid", gap: theme.spacing.md }}>
        <div>
          <h3 style={{ margin: 0 }}>Historical Analytics</h3>
          <div style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
            Longitudinal RF behavior, modulation mix, and interference indicators.
          </div>
        </div>

        <div style={{ display: "grid", gap: theme.spacing.sm, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
          <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt }}>
            <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>Detections</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{analytics.totalDetections}</div>
          </div>
          <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt }}>
            <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>Active Sources</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{analytics.activeSources}</div>
          </div>
          <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt }}>
            <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>Avg Confidence</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>
              {typeof analytics.avgConfidence === "number" ? `${analytics.avgConfidence.toFixed(1)}%` : "-"}
            </div>
          </div>
          <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt }}>
            <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>Interference Hits</div>
            <div style={{ fontWeight: 700, fontSize: 20, color: theme.colors.warning }}>{analytics.interferenceCandidates}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: theme.spacing.md }}>
          <div
            style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              background: theme.colors.surfaceAlt,
              padding: theme.spacing.sm,
              height: 220,
            }}
          >
            {analytics.bandData.length === 0 ? (
              <div style={{ color: theme.colors.textSecondary, padding: theme.spacing.md }}>
                No band analytics available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.bandData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke={theme.colors.border} strokeDasharray="3 3" />
                  <XAxis dataKey="band" tick={{ fill: theme.colors.textSecondary, fontSize: 11 }} />
                  <YAxis tick={{ fill: theme.colors.textSecondary, fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: theme.colors.surface,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radius.sm,
                      color: theme.colors.textPrimary,
                    }}
                  />
                  <Bar dataKey="count" fill={theme.colors.primary} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div
            style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              background: theme.colors.surfaceAlt,
              padding: theme.spacing.sm,
              height: 220,
            }}
          >
            {analytics.modulationData.length === 0 ? (
              <div style={{ color: theme.colors.textSecondary, padding: theme.spacing.md }}>
                No modulation distribution yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.modulationData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={68}
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {analytics.modulationData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: theme.colors.surface,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radius.sm,
                      color: theme.colors.textPrimary,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
