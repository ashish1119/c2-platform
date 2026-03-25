import { useMemo } from "react";
import Card from "../ui/Card";
import { useTheme } from "../../context/ThemeContext";
import type { SmsDetectionRecord } from "../../api/operatorDashboard";

type DeviceIdentificationPanelProps = {
  detections: SmsDetectionRecord[];
};

type DeviceSummary = {
  signature: string;
  sourceNode: string;
  modulation: string;
  hits: number;
  avgPowerDbm: number | null;
  avgSnrDb: number | null;
  avgConfidencePct: number | null;
  firstSeenMs: number;
  lastSeenMs: number;
  primaryBand: string;
};

type DeviceAccumulator = {
  sourceNode: string;
  modulation: string;
  hits: number;
  firstSeenMs: number;
  lastSeenMs: number;
  powerSum: number;
  powerSamples: number;
  snrSum: number;
  snrSamples: number;
  confidenceSum: number;
  confidenceSamples: number;
  frequencySum: number;
};

function frequencyBandName(frequencyHz: number): string {
  if (frequencyHz < 30_000_000) return "HF";
  if (frequencyHz < 300_000_000) return "VHF";
  if (frequencyHz < 1_000_000_000) return "UHF";
  if (frequencyHz < 6_000_000_000) return "SHF";
  return "EHF";
}

export default function DeviceIdentificationPanel({ detections }: DeviceIdentificationPanelProps) {
  const { theme } = useTheme();

  const devices = useMemo<DeviceSummary[]>(() => {
    const accumulatorByKey = new Map<string, DeviceAccumulator>();

    for (const detection of detections) {
      const timestampMs = Date.parse(detection.timestamp_utc);
      if (!Number.isFinite(timestampMs)) {
        continue;
      }

      const sourceNode = detection.source_node.trim() || "unknown-node";
      const modulation = (detection.modulation ?? "UNKNOWN").trim() || "UNKNOWN";
      const signature = `${sourceNode}::${modulation}`;

      let accumulator = accumulatorByKey.get(signature);
      if (!accumulator) {
        accumulator = {
          sourceNode,
          modulation,
          hits: 0,
          firstSeenMs: timestampMs,
          lastSeenMs: timestampMs,
          powerSum: 0,
          powerSamples: 0,
          snrSum: 0,
          snrSamples: 0,
          confidenceSum: 0,
          confidenceSamples: 0,
          frequencySum: 0,
        };
        accumulatorByKey.set(signature, accumulator);
      }

      accumulator.hits += 1;
      accumulator.firstSeenMs = Math.min(accumulator.firstSeenMs, timestampMs);
      accumulator.lastSeenMs = Math.max(accumulator.lastSeenMs, timestampMs);
      accumulator.frequencySum += detection.frequency_hz;

      if (typeof detection.power_dbm === "number") {
        accumulator.powerSum += detection.power_dbm;
        accumulator.powerSamples += 1;
      }

      if (typeof detection.snr_db === "number") {
        accumulator.snrSum += detection.snr_db;
        accumulator.snrSamples += 1;
      }

      if (typeof detection.confidence === "number") {
        const confidenceValue = detection.confidence <= 1 ? detection.confidence * 100 : detection.confidence;
        accumulator.confidenceSum += confidenceValue;
        accumulator.confidenceSamples += 1;
      }
    }

    return Array.from(accumulatorByKey.entries())
      .map(([signature, accumulator]) => {
        const avgFrequencyHz = accumulator.hits > 0 ? accumulator.frequencySum / accumulator.hits : 0;

        return {
          signature,
          sourceNode: accumulator.sourceNode,
          modulation: accumulator.modulation,
          hits: accumulator.hits,
          avgPowerDbm:
            accumulator.powerSamples > 0 ? Number((accumulator.powerSum / accumulator.powerSamples).toFixed(2)) : null,
          avgSnrDb: accumulator.snrSamples > 0 ? Number((accumulator.snrSum / accumulator.snrSamples).toFixed(2)) : null,
          avgConfidencePct:
            accumulator.confidenceSamples > 0
              ? Number((accumulator.confidenceSum / accumulator.confidenceSamples).toFixed(2))
              : null,
          firstSeenMs: accumulator.firstSeenMs,
          lastSeenMs: accumulator.lastSeenMs,
          primaryBand: frequencyBandName(avgFrequencyHz),
        };
      })
      .sort((left, right) => {
        if (right.hits !== left.hits) {
          return right.hits - left.hits;
        }
        return right.lastSeenMs - left.lastSeenMs;
      })
      .slice(0, 12);
  }, [detections]);

  const interferenceCandidates = useMemo(
    () =>
      devices.filter(
        (device) =>
          typeof device.avgPowerDbm === "number" &&
          typeof device.avgSnrDb === "number" &&
          device.avgPowerDbm >= -65 &&
          device.avgSnrDb < 6
      ).length,
    [devices]
  );

  return (
    <Card>
      <div style={{ display: "grid", gap: theme.spacing.md }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0 }}>RF Device Identification</h3>
            <div style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
              Signature tracking by source node and modulation profile.
            </div>
          </div>
          <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>
            Devices: {devices.length} | Interference risk: {interferenceCandidates}
          </div>
        </div>

        <div style={{ overflowX: "auto", border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: theme.colors.surfaceAlt }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Device</th>
                <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Modulation</th>
                <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Band</th>
                <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Hits</th>
                <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Avg Power</th>
                <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Avg SNR</th>
                <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Confidence</th>
                <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.signature}>
                  <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{device.sourceNode}</td>
                  <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{device.modulation}</td>
                  <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{device.primaryBand}</td>
                  <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{device.hits}</td>
                  <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                    {typeof device.avgPowerDbm === "number" ? `${device.avgPowerDbm.toFixed(1)} dBm` : "-"}
                  </td>
                  <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                    {typeof device.avgSnrDb === "number" ? `${device.avgSnrDb.toFixed(1)} dB` : "-"}
                  </td>
                  <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                    {typeof device.avgConfidencePct === "number" ? `${device.avgConfidencePct.toFixed(1)}%` : "-"}
                  </td>
                  <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                    {new Date(device.lastSeenMs).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
              {devices.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: theme.spacing.md, color: theme.colors.textSecondary }}>
                    No device signatures identified yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
