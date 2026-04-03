// import { useMemo } from "react";
// import {
//   Area,
//   AreaChart,
//   CartesianGrid,
//   ResponsiveContainer,
//   Tooltip,
//   XAxis,
//   YAxis,
// } from "recharts";
// import Card from "../ui/Card";
// import { useTheme } from "../../context/ThemeContext";
// import type { SmsDetectionRecord, SmsSpectrumOccupancyBin } from "../../api/operatorDashboard";
// import CanvasWaterfall, { type WaterfallBin } from "./CanvasWaterfall";

// type WaterfallHistoryViewProps = {
//   detections: SmsDetectionRecord[];
//   spectrumBins?: SmsSpectrumOccupancyBin[];
//   loading?: boolean;
// };

// type WaterfallPoint = {
//   id: string;
//   timestampMs: number;
//   timeLabel: string;
//   frequencyMhz: number;
//   frequencyLabel: string;
//   powerDbm: number;
// };

// type HistoryPoint = {
//   timestampMs: number;
//   timeLabel: string;
//   detections: number;
//   avgPowerDbm: number | null;
// };

// // function formatFrequencyHz(value: number): string {
// //   if (value >= 1_000_000_000) {
// //     return `${(value / 1_000_000_000).toFixed(3)} GHz`;
// //   }
// //   if (value >= 1_000_000) {
// //     return `${(value / 1_000_000).toFixed(3)} MHz`;
// //   }
// //   if (value >= 1_000) {
// //     return `${(value / 1_000).toFixed(3)} kHz`;
// //   }
// //   return `${value.toFixed(1)} Hz`;
// // }

// function formatFrequencyHz(value: number): string {
//   return `${(value / 1_000_000).toFixed(3)} MHz`;
// }

// export default function WaterfallHistoryView({ detections, spectrumBins, loading = false }: WaterfallHistoryViewProps) {
//   const { theme } = useTheme();

//   const waterfallPoints = useMemo<WaterfallPoint[]>(() => {
//     return detections
//       .map((detection) => {
//         const timestampMs = Date.parse(detection.timestamp_utc);
//         if (!Number.isFinite(timestampMs)) {
//           return null;
//         }

//         const powerDbm = typeof detection.power_dbm === "number" ? detection.power_dbm : -110;
//         const frequencyMhz = detection.frequency_hz / 1_000_000;

//         return {
//           id: detection.id,
//           timestampMs,
//           timeLabel: new Date(timestampMs).toLocaleTimeString(),
//           frequencyMhz,
//           frequencyLabel: formatFrequencyHz(detection.frequency_hz),
//           powerDbm,
//         };
//       })
//       .filter((point): point is WaterfallPoint => point !== null)
//       .sort((left, right) => left.timestampMs - right.timestampMs)
//       .slice(-260);
//   }, [detections]);

//   const waterfallSweep = useMemo<WaterfallBin[] | null>(() => {
//     if (spectrumBins && spectrumBins.length > 0) {
//       return spectrumBins.map((b) => ({
//         frequencyHz: b.frequency_hz,
//         powerDbm: typeof b.max_power_dbm === "number" ? b.max_power_dbm : -110,
//       }));
//     }
//     if (waterfallPoints.length === 0) return null;
//     // Synthesise a sweep from sparse detection points by frequency-bucketing
//     const buckets = 128;
//     const freqs = waterfallPoints.map((p) => p.frequencyMhz);
//     const fMin = Math.min(...freqs);
//     const fMax = Math.max(...freqs);
//     const spanMhz = Math.max(1, fMax - fMin);
//     const accumPow = new Float64Array(buckets).fill(-110);
//     const accumCount = new Int32Array(buckets);
//     for (const pt of waterfallPoints) {
//       const idx = Math.min(buckets - 1, Math.max(0, Math.floor(((pt.frequencyMhz - fMin) / spanMhz) * buckets)));
//       accumPow[idx] = accumCount[idx] === 0 ? pt.powerDbm : Math.max(accumPow[idx], pt.powerDbm);
//       accumCount[idx] += 1;
//     }
//     return Array.from({ length: buckets }, (_, i) => ({
//       frequencyHz: (fMin + (i / buckets) * spanMhz) * 1_000_000,
//       powerDbm: accumPow[i],
//     }));
//   }, [spectrumBins, waterfallPoints]);

//   const historyData = useMemo<HistoryPoint[]>(() => {
//     if (waterfallPoints.length === 0) {
//       return [];
//     }

//     const bucketCount = 20;
//     const newestTimestamp = waterfallPoints[waterfallPoints.length - 1].timestampMs;
//     const oldestTimestamp = Math.max(waterfallPoints[0].timestampMs, newestTimestamp - 10 * 60 * 1000);
//     const windowDurationMs = Math.max(1, newestTimestamp - oldestTimestamp);
//     const bucketDurationMs = Math.max(1, Math.floor(windowDurationMs / bucketCount));

//     const buckets = Array.from({ length: bucketCount }, (_, index) => ({
//       timestampMs: oldestTimestamp + index * bucketDurationMs,
//       detections: 0,
//       powerSum: 0,
//       powerSamples: 0,
//     }));

//     for (const point of waterfallPoints) {
//       if (point.timestampMs < oldestTimestamp) {
//         continue;
//       }

//       const relativeOffset = point.timestampMs - oldestTimestamp;
//       const bucketIndex = Math.min(bucketCount - 1, Math.max(0, Math.floor(relativeOffset / bucketDurationMs)));
//       const bucket = buckets[bucketIndex];

//       bucket.detections += 1;
//       bucket.powerSum += point.powerDbm;
//       bucket.powerSamples += 1;
//     }

//     return buckets.map((bucket) => ({
//       timestampMs: bucket.timestampMs,
//       timeLabel: new Date(bucket.timestampMs).toLocaleTimeString(),
//       detections: bucket.detections,
//       avgPowerDbm: bucket.powerSamples > 0 ? Number((bucket.powerSum / bucket.powerSamples).toFixed(2)) : null,
//     }));
//   }, [waterfallPoints]);

//   return (
//     <Card>
//       <div style={{ display: "grid", gap: theme.spacing.md }}>
//         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//           <div>
//             <h3 style={{ margin: 0 }}>Waterfall / Time History</h3>
//             <div style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
//               Frequency-time heat points with rolling activity trend.
//             </div>
//           </div>
//           <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>
//             {loading ? "Refreshing..." : `Points: ${waterfallPoints.length}`}
//           </div>
//         </div>

//         <CanvasWaterfall
//           sweep={waterfallSweep}
//           noiseFloorDbm={-110}
//           ceilingDbm={-30}
//           maxRows={200}
//           height={260}
//           title="Waterfall History"
//         />

//         <div
//           style={{
//             border: `1px solid ${theme.colors.border}`,
//             borderRadius: theme.radius.md,
//             background: theme.colors.surfaceAlt,
//             padding: theme.spacing.sm,
//             height: 180,
//           }}
//         >
//           {historyData.length === 0 ? (
//             <div style={{ color: theme.colors.textSecondary, padding: theme.spacing.md }}>
//               No historical timeline yet.
//             </div>
//           ) : (
//             <ResponsiveContainer width="100%" height="100%">
//               <AreaChart data={historyData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
//                 <CartesianGrid stroke={theme.colors.border} strokeDasharray="3 3" />
//                 <XAxis dataKey="timestampMs" type="number" tickFormatter={(value: number) => new Date(value).toLocaleTimeString()} />
//                 <YAxis yAxisId="left" tick={{ fill: theme.colors.textSecondary, fontSize: 11 }} />
//                 <YAxis yAxisId="right" orientation="right" tick={{ fill: theme.colors.textSecondary, fontSize: 11 }} />
//                 <Tooltip
//                   contentStyle={{
//                     background: theme.colors.surface,
//                     border: `1px solid ${theme.colors.border}`,
//                     borderRadius: theme.radius.sm,
//                     color: theme.colors.textPrimary,
//                   }}
//                   formatter={(value: unknown, name: string) => {
//                     if (name === "avgPowerDbm" && typeof value === "number") {
//                       return [`${value.toFixed(2)} dBm`, "Avg Power"];
//                     }
//                     if (name === "detections" && typeof value === "number") {
//                       return [value, "Detections"];
//                     }
//                     return [String(value ?? "-"), name];
//                   }}
//                   labelFormatter={(value) => new Date(Number(value)).toLocaleTimeString()}
//                 />
//                 <Area
//                   yAxisId="left"
//                   type="monotone"
//                   dataKey="detections"
//                   stroke={theme.colors.primary}
//                   fill={theme.colors.primary}
//                   fillOpacity={0.24}
//                   isAnimationActive={false}
//                 />
//                 <Area
//                   yAxisId="right"
//                   type="monotone"
//                   dataKey="avgPowerDbm"
//                   stroke={theme.colors.warning}
//                   fill={theme.colors.warning}
//                   fillOpacity={0.12}
//                   isAnimationActive={false}
//                   connectNulls={true}
//                 />
//               </AreaChart>
//             </ResponsiveContainer>
//           )}
//         </div>
//       </div>
//     </Card>
//   );
// }

import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../ui/Card";
import { useTheme } from "../../context/ThemeContext";
import { resolveBackendWsUrl } from "../../api/ws";
import type { SmsDetectionRecord, SmsSpectrumOccupancyBin } from "../../api/operatorDashboard";
import CanvasWaterfall, { type WaterfallBin } from "./CanvasWaterfall";

type WaterfallHistoryViewProps = {
  detections?: SmsDetectionRecord[];
  spectrumBins?: SmsSpectrumOccupancyBin[];
  loading?: boolean;
};

export default function WaterfallHistoryView({ loading = false }: WaterfallHistoryViewProps) {
  const { theme } = useTheme();

  // 🔥 Multi-system WS bins (same as spectrum)
  const [wsBins, setWsBins] = useState<Record<string, SmsSpectrumOccupancyBin[]>>({});

  // 🔥 Waterfall history (rows)
  const [history, setHistory] = useState<WaterfallBin[][]>([]);

  // -------------------------------
  // 📡 WEBSOCKET CONNECTION
  // -------------------------------
  useEffect(() => {
    const ws = new WebSocket(resolveBackendWsUrl("/ws/rf"));

    ws.onopen = () => console.log("✅ Waterfall WS connected");

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const rf = msg.data ? msg.data : msg;

        if (!rf.freq) return;

        const systemId = rf.system_id || "unknown";

        const newBin: SmsSpectrumOccupancyBin = {
          frequency_hz: rf.freq * 1_000_000,
          max_power_dbm: rf.power,
          detection_count: 1,
        };

        setWsBins((prev) => {
          const existing = prev[systemId] || [];

          let updated = [...existing];

          const index = updated.findIndex(
            (b) => Math.abs(b.frequency_hz - newBin.frequency_hz) < 100000
          );

          if (index !== -1) {
            updated[index] = {
              ...updated[index],
              max_power_dbm: Math.max(
                updated[index].max_power_dbm ?? -110,
                newBin.max_power_dbm ?? -110
              ),
              detection_count: updated[index].detection_count + 1,
            };
          } else {
            updated.push(newBin);
          }

          if (updated.length > 200) {
            updated = updated.slice(-200);
          }

          return {
            ...prev,
            [systemId]: updated,
          };
        });
      } catch (e) {
        console.error("WS error", e);
      }
    };

    ws.onclose = () => console.log("❌ Waterfall WS closed");

    return () => ws.close();
  }, []);

  // -------------------------------
  // 📊 BUILD SWEEP FROM WS DATA
  // -------------------------------
  const combinedSweep = useMemo<WaterfallBin[] | null>(() => {
    const allSystems = Object.values(wsBins);

    if (allSystems.length === 0) return null;

    const merged: SmsSpectrumOccupancyBin[] = [];

    allSystems.forEach((sys) => merged.push(...sys));

    if (merged.length === 0) return null;

    // sort by freq
    merged.sort((a, b) => a.frequency_hz - b.frequency_hz);

    return merged.map((b) => ({
      frequencyHz: b.frequency_hz,
      powerDbm: typeof b.max_power_dbm === "number" ? b.max_power_dbm : -110,
    }));
  }, [wsBins]);

  // -------------------------------
  // 🌊 BUILD WATERFALL HISTORY
  // -------------------------------
  useEffect(() => {
    if (!combinedSweep) return;

    setHistory((prev) => {
      const updated = [...prev, combinedSweep];

      // keep last 200 rows
      if (updated.length > 200) {
        return updated.slice(-200);
      }

      return updated;
    });
  }, [combinedSweep]);

  // latest row
  const latestSweep = history.length > 0 ? history[history.length - 1] : null;

  return (
    <Card>
      <div style={{ display: "grid", gap: theme.spacing.md }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0 }}>Live Waterfall (WebSocket)</h3>
            <div style={{ color: theme.colors.textSecondary }}>
              Real-time RF waterfall from multi-system WS stream
            </div>
          </div>

          <div style={{ color: theme.colors.textSecondary }}>
            {loading ? "Refreshing..." : `Rows: ${history.length}`}
          </div>
        </div>

        <CanvasWaterfall
          sweep={latestSweep}
          noiseFloorDbm={-110}
          ceilingDbm={-30}
          maxRows={200}
          height={300}
          title="Live RF Waterfall"
        />
      </div>
    </Card>
  );
}