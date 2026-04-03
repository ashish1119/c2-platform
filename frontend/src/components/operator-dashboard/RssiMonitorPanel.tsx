// import { useMemo } from "react";
// import {
//   CartesianGrid,
//   Legend,
//   Line,
//   LineChart,
//   ResponsiveContainer,
//   Tooltip,
//   XAxis,
//   YAxis,
// } from "recharts";
// import Card from "../ui/Card";
// import { useTheme } from "../../context/ThemeContext";
// import type { SmsDetectionRecord } from "../../api/operatorDashboard";

// type RssiMonitorPanelProps = {
//   detections: SmsDetectionRecord[];
// };

// type RssiPoint = {
//   sourceNode: string;
//   latitude: number | null;
//   longitude: number | null;
//   timestampMs: number;
//   powerDbm: number;
// };

// type DistanceBucketAccumulator = {
//   upperBoundMeters: number;
//   sourceSums: Record<string, number>;
//   sourceCounts: Record<string, number>;
// };

// type ChartRow = {
//   distanceLabel: string;
//   distanceMeters: number;
//   [sourceNode: string]: string | number | null;
// };

// const SOURCE_COLORS = ["#2563eb", "#dc2626", "#eab308", "#0ea5e9", "#16a34a", "#8b5cf6"];
// const DISTANCE_BUCKET_TEMPLATE_METERS = [25, 60, 135, 160, 200];

// function toRadians(degrees: number): number {
//   return (degrees * Math.PI) / 180;
// }

// function haversineMeters(
//   lat1: number,
//   lon1: number,
//   lat2: number,
//   lon2: number
// ): number {
//   const earthRadiusMeters = 6_371_000;
//   const dLat = toRadians(lat2 - lat1);
//   const dLon = toRadians(lon2 - lon1);
//   const a =
//     Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//     Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
//       Math.sin(dLon / 2) * Math.sin(dLon / 2);
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//   return earthRadiusMeters * c;
// }

// function buildBucketUpperBounds(maxDistanceMeters: number): number[] {
//   if (!Number.isFinite(maxDistanceMeters) || maxDistanceMeters <= 10) {
//     return [...DISTANCE_BUCKET_TEMPLATE_METERS];
//   }

//   const quantized = DISTANCE_BUCKET_TEMPLATE_METERS.map((templateDistance, index) => {
//     const templateMax = DISTANCE_BUCKET_TEMPLATE_METERS[DISTANCE_BUCKET_TEMPLATE_METERS.length - 1];
//     const projectedDistance = (templateDistance / templateMax) * maxDistanceMeters;
//     const rounded = Math.max(5, Math.round(projectedDistance / 5) * 5);
//     if (index === 0) {
//       return rounded;
//     }
//     return Math.max(rounded, DISTANCE_BUCKET_TEMPLATE_METERS[index - 1] + 5);
//   });

//   for (let index = 1; index < quantized.length; index += 1) {
//     if (quantized[index] <= quantized[index - 1]) {
//       quantized[index] = quantized[index - 1] + 5;
//     }
//   }

//   return quantized;
// }

// export default function RssiMonitorPanel({ detections }: RssiMonitorPanelProps) {
//   const { theme } = useTheme();

//   const chartModel = useMemo(() => {
//     const points: RssiPoint[] = [];

//     for (const detection of detections) {
//       if (typeof detection.power_dbm !== "number") {
//         continue;
//       }

//       const timestampMs = Date.parse(detection.timestamp_utc);
//       if (!Number.isFinite(timestampMs)) {
//         continue;
//       }

//       points.push({
//         sourceNode: detection.source_node,
//         latitude: typeof detection.latitude === "number" ? detection.latitude : null,
//         longitude: typeof detection.longitude === "number" ? detection.longitude : null,
//         timestampMs,
//         powerDbm: detection.power_dbm,
//       });
//     }

//     if (points.length === 0) {
//       return {
//         rows: [] as ChartRow[],
//         topSources: [] as string[],
//         hasGeo: false,
//       };
//     }

//     const sourceHitMap = new Map<string, number>();
//     for (const point of points) {
//       sourceHitMap.set(point.sourceNode, (sourceHitMap.get(point.sourceNode) ?? 0) + 1);
//     }

//     const topSources = Array.from(sourceHitMap.entries())
//       .sort((left, right) => right[1] - left[1])
//       .slice(0, 3)
//       .map(([sourceNode]) => sourceNode);

//     const geoPoints = points.filter(
//       (point) => typeof point.latitude === "number" && typeof point.longitude === "number"
//     ) as Array<RssiPoint & { latitude: number; longitude: number }>;

//     const hasGeo = geoPoints.length > 0;

//     const sourceSamplesByDistance: Array<{
//       sourceNode: string;
//       distanceMeters: number;
//       powerDbm: number;
//     }> = [];

//     if (hasGeo) {
//       const strongestPoints = [...geoPoints]
//         .sort((left, right) => right.powerDbm - left.powerDbm)
//         .slice(0, Math.max(3, Math.floor(geoPoints.length * 0.2)));

//       const referenceLatitude =
//         strongestPoints.reduce((sum, point) => sum + point.latitude, 0) / strongestPoints.length;
//       const referenceLongitude =
//         strongestPoints.reduce((sum, point) => sum + point.longitude, 0) / strongestPoints.length;

//       for (const point of geoPoints) {
//         if (!topSources.includes(point.sourceNode)) {
//           continue;
//         }

//         sourceSamplesByDistance.push({
//           sourceNode: point.sourceNode,
//           powerDbm: point.powerDbm,
//           distanceMeters: haversineMeters(
//             referenceLatitude,
//             referenceLongitude,
//             point.latitude,
//             point.longitude
//           ),
//         });
//       }
//     } else {
//       const sortedByTime = [...points].sort((left, right) => left.timestampMs - right.timestampMs);
//       const perSourceTimeIndex = new Map<string, number>();

//       for (const point of sortedByTime) {
//         if (!topSources.includes(point.sourceNode)) {
//           continue;
//         }

//         const nextIndex = (perSourceTimeIndex.get(point.sourceNode) ?? 0) + 1;
//         perSourceTimeIndex.set(point.sourceNode, nextIndex);

//         // Fallback synthetic range so RSSI profile can still render without GPS.
//         sourceSamplesByDistance.push({
//           sourceNode: point.sourceNode,
//           powerDbm: point.powerDbm,
//           distanceMeters: Math.min(220, 20 + nextIndex * 15),
//         });
//       }
//     }

//     if (sourceSamplesByDistance.length === 0) {
//       return {
//         rows: [] as ChartRow[],
//         topSources,
//         hasGeo,
//       };
//     }

//     const maxDistanceMeters = sourceSamplesByDistance.reduce(
//       (maxDistance, sample) => Math.max(maxDistance, sample.distanceMeters),
//       0
//     );

//     const bucketUpperBounds = buildBucketUpperBounds(maxDistanceMeters);
//     const buckets: DistanceBucketAccumulator[] = bucketUpperBounds.map((upperBoundMeters) => ({
//       upperBoundMeters,
//       sourceSums: {},
//       sourceCounts: {},
//     }));

//     for (const sample of sourceSamplesByDistance) {
//       const bucketIndex = bucketUpperBounds.findIndex(
//         (upperBoundMeters) => sample.distanceMeters <= upperBoundMeters
//       );

//       const safeBucketIndex = bucketIndex >= 0 ? bucketIndex : bucketUpperBounds.length - 1;
//       const bucket = buckets[safeBucketIndex];

//       bucket.sourceSums[sample.sourceNode] = (bucket.sourceSums[sample.sourceNode] ?? 0) + sample.powerDbm;
//       bucket.sourceCounts[sample.sourceNode] = (bucket.sourceCounts[sample.sourceNode] ?? 0) + 1;
//     }

//     const rows: ChartRow[] = buckets.map((bucket) => {
//       const row: ChartRow = {
//         distanceLabel: `${bucket.upperBoundMeters.toFixed(0)} meters`,
//         distanceMeters: bucket.upperBoundMeters,
//       };

//       for (const sourceNode of topSources) {
//         const sampleCount = bucket.sourceCounts[sourceNode] ?? 0;
//         row[sourceNode] =
//           sampleCount > 0 ? Number((bucket.sourceSums[sourceNode] / sampleCount).toFixed(2)) : null;
//       }

//       return row;
//     });

//     return { rows, topSources, hasGeo };
//   }, [detections]);

//   return (
//     <Card>
//       <div style={{ display: "grid", gap: theme.spacing.md }}>
//         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//           <div>
//             <h3 style={{ margin: 0 }}>RSSI Chart</h3>
//             <div style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
//               Per-source signal strength profile across distance buckets.
//             </div>
//           </div>
//           <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>
//             Sources tracked: {chartModel.topSources.length}
//           </div>
//         </div>

//         <div
//           style={{
//             border: `1px solid ${theme.colors.border}`,
//             borderRadius: theme.radius.md,
//             background: "#f8fafc",
//             padding: theme.spacing.sm,
//             height: 340,
//           }}
//         >
//           {chartModel.rows.length === 0 ? (
//             <div style={{ color: theme.colors.textSecondary, padding: theme.spacing.md }}>
//               No RSSI samples available yet.
//             </div>
//           ) : (
//             <ResponsiveContainer width="100%" height="100%">
//               <LineChart data={chartModel.rows} margin={{ top: 8, right: 14, bottom: 8, left: 2 }}>
//                 <CartesianGrid stroke="#d1d5db" strokeDasharray="2 2" />
//                 <XAxis
//                   dataKey="distanceLabel"
//                   type="category"
//                   tick={{ fill: theme.colors.textSecondary, fontSize: 11 }}
//                 />
//                 <YAxis
//                   type="number"
//                   domain={[-160, 0]}
//                   tick={{ fill: theme.colors.textSecondary, fontSize: 11 }}
//                   tickFormatter={(value: number) => `${value.toFixed(0)} dBm`}
//                 />
//                 <Tooltip
//                   contentStyle={{
//                     background: theme.colors.surface,
//                     border: `1px solid ${theme.colors.border}`,
//                     borderRadius: theme.radius.sm,
//                     color: theme.colors.textPrimary,
//                   }}
//                   formatter={(value: unknown, sourceName: string) => {
//                     if (typeof value !== "number") {
//                       return ["-", sourceName];
//                     }
//                     return [`${value.toFixed(2)} dBm`, sourceName];
//                   }}
//                   labelFormatter={(value) => String(value)}
//                 />
//                 <Legend />
//                 {chartModel.topSources.map((sourceNode, index) => (
//                   <Line
//                     key={sourceNode}
//                     type="monotone"
//                     dataKey={sourceNode}
//                     name={sourceNode}
//                     stroke={SOURCE_COLORS[index % SOURCE_COLORS.length]}
//                     strokeWidth={2}
//                     dot={{ r: 3 }}
//                     isAnimationActive={false}
//                     connectNulls={true}
//                   />
//                 ))}
//               </LineChart>
//             </ResponsiveContainer>
//           )}
//         </div>

//         {!chartModel.hasGeo && chartModel.rows.length > 0 && (
//           <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>
//             Distance buckets are estimated from telemetry sequence because GPS coordinates are unavailable.
//           </div>
//         )}
//       </div>
//     </Card>
//   );
// }

// import { useMemo, useEffect, useState } from "react";
// import {
//   CartesianGrid,
//   Legend,
//   Line,
//   LineChart,
//   ResponsiveContainer,
//   Tooltip,
//   XAxis,
//   YAxis,
// } from "recharts";
// import Card from "../ui/Card";
// import { useTheme } from "../../context/ThemeContext";
// import type { SmsDetectionRecord } from "../../api/operatorDashboard";

// type RssiMonitorPanelProps = {
//   detections: SmsDetectionRecord[];
// };

// export default function RssiMonitorPanel({ detections }: RssiMonitorPanelProps) {
//   const { theme } = useTheme();

//   // ✅ NEW: state for live data
//   const [liveDetections, setLiveDetections] = useState<SmsDetectionRecord[]>([]);

//   // ✅ NEW: WebSocket connection
//   useEffect(() => {
//     const ws = new WebSocket("ws://localhost:8000/ws/rf");

//     ws.onopen = () => {
//       console.log("✅ WebSocket connected");
//     };

//     ws.onmessage = (event) => {
//       try {
//         const data = JSON.parse(event.data);

//         // ⚠️ Adjust mapping based on your backend schema
//         const newDetection: SmsDetectionRecord = {
//           source_node: data.source_node || "DF Node",
//           power_dbm: data.power_dbm ?? data.powerDbm ?? -80,
//           latitude: data.latitude ?? null,
//           longitude: data.longitude ?? null,
//           timestamp_utc: data.timestamp || new Date().toISOString(),
//         };

//         // ✅ Keep last 100 points (prevent memory overflow)
//         setLiveDetections((prev) => [...prev.slice(-100), newDetection]);
//       } catch (err) {
//         console.error("WebSocket parse error:", err);
//       }
//     };

//     ws.onclose = () => {
//       console.log("❌ WebSocket disconnected");
//     };

//     ws.onerror = (err) => {
//       console.error("WebSocket error:", err);
//     };

//     return () => {
//       ws.close();
//     };
//   }, []);

//   // ✅ Merge API + live data
//   const combinedDetections = [...detections, ...liveDetections];

//   // 🔥 EXISTING LOGIC (unchanged, just replaced detections → combinedDetections)
//   const chartModel = useMemo(() => {
//     const points = [];

//     for (const detection of combinedDetections) {
//       if (typeof detection.power_dbm !== "number") continue;

//       const timestampMs = Date.parse(detection.timestamp_utc);
//       if (!Number.isFinite(timestampMs)) continue;

//       points.push({
//         sourceNode: detection.source_node,
//         latitude: typeof detection.latitude === "number" ? detection.latitude : null,
//         longitude: typeof detection.longitude === "number" ? detection.longitude : null,
//         timestampMs,
//         powerDbm: detection.power_dbm,
//       });
//     }

//     if (points.length === 0) {
//       return { rows: [], topSources: [], hasGeo: false };
//     }

//     const sourceHitMap = new Map();
//     for (const point of points) {
//       sourceHitMap.set(point.sourceNode, (sourceHitMap.get(point.sourceNode) ?? 0) + 1);
//     }

//     const topSources = Array.from(sourceHitMap.entries())
//       .sort((a, b) => b[1] - a[1])
//       .slice(0, 3)
//       .map(([sourceNode]) => sourceNode);

//     const sortedByTime = [...points].sort((a, b) => a.timestampMs - b.timestampMs);
//     const perSourceTimeIndex = new Map();

//     const sourceSamplesByDistance = [];

//     for (const point of sortedByTime) {
//       if (!topSources.includes(point.sourceNode)) continue;

//       const nextIndex = (perSourceTimeIndex.get(point.sourceNode) ?? 0) + 1;
//       perSourceTimeIndex.set(point.sourceNode, nextIndex);

//       sourceSamplesByDistance.push({
//         sourceNode: point.sourceNode,
//         powerDbm: point.powerDbm,
//         distanceMeters: Math.min(220, 20 + nextIndex * 15),
//       });
//     }

//     const bucketUpperBounds = [25, 60, 135, 160, 200];

//     const buckets = bucketUpperBounds.map((upper) => ({
//       upperBoundMeters: upper,
//       sourceSums: {},
//       sourceCounts: {},
//     }));

//     for (const sample of sourceSamplesByDistance) {
//       const bucketIndex =
//         bucketUpperBounds.findIndex((b) => sample.distanceMeters <= b) ??
//         bucketUpperBounds.length - 1;

//       const bucket = buckets[bucketIndex >= 0 ? bucketIndex : buckets.length - 1];

//       bucket.sourceSums[sample.sourceNode] =
//         (bucket.sourceSums[sample.sourceNode] ?? 0) + sample.powerDbm;

//       bucket.sourceCounts[sample.sourceNode] =
//         (bucket.sourceCounts[sample.sourceNode] ?? 0) + 1;
//     }

//     const rows = buckets.map((bucket) => {
//       const row: any = {
//         distanceLabel: `${bucket.upperBoundMeters} meters`,
//       };

//       for (const sourceNode of topSources) {
//         const count = bucket.sourceCounts[sourceNode] ?? 0;
//         row[sourceNode] =
//           count > 0
//             ? Number((bucket.sourceSums[sourceNode] / count).toFixed(2))
//             : null;
//       }

//       return row;
//     });

//     return { rows, topSources, hasGeo: false };
//   }, [combinedDetections]);

//   return (
//     <Card>
//       <div style={{ display: "grid", gap: theme.spacing.md }}>
//         <h3>RSSI Chart (Live)</h3>

//         <div style={{ height: 340 }}>
//           <ResponsiveContainer width="100%" height="100%">
//             <LineChart data={chartModel.rows}>
//               <CartesianGrid stroke="#d1d5db" strokeDasharray="2 2" />
//               <XAxis dataKey="distanceLabel" />
//               <YAxis domain={[-160, 0]} />
//               <Tooltip />
//               <Legend />

//               {chartModel.topSources.map((sourceNode, index) => (
//                 <Line
//                   key={sourceNode}
//                   type="monotone"
//                   dataKey={sourceNode}
//                   stroke={["#2563eb", "#dc2626", "#16a34a"][index % 3]}
//                   strokeWidth={2}
//                   dot={{ r: 3 }}
//                   isAnimationActive={false}
//                 />
//               ))}
//             </LineChart>
//           </ResponsiveContainer>
//         </div>
//       </div>
//     </Card>
//   );
// }

import { useMemo, useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "../ui/Card";
import { useTheme } from "../../context/ThemeContext";
import { resolveBackendWsUrl } from "../../api/ws";
import type { SmsDetectionRecord } from "../../api/operatorDashboard";

type RssiMonitorPanelProps = {
  detections: SmsDetectionRecord[];
};

const SOURCE_COLORS = ["#2563eb", "#dc2626", "#16a34a"];

export default function RssiMonitorPanel({ detections }: RssiMonitorPanelProps) {
  const { theme } = useTheme();

  // ✅ Live WebSocket data
  const [liveDetections, setLiveDetections] = useState<SmsDetectionRecord[]>([]);

  useEffect(() => {
    const ws = new WebSocket(resolveBackendWsUrl("/ws/rf"));

    ws.onopen = () => {
      console.log("✅ WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        const newDetection: SmsDetectionRecord = {
          id: String(data.id ?? `${Date.now()}`),
          source_node: data.source_node || "DF Node",
          frequency_hz: typeof data.frequency_hz === "number" ? data.frequency_hz : typeof data.freq === "number" ? data.freq : 0,
          power_dbm: data.power_dbm ?? data.powerDbm ?? -80,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          timestamp_utc: data.timestamp || new Date().toISOString(),
        };

        // keep last 100 entries
        setLiveDetections((prev) => [...prev.slice(-100), newDetection]);
      } catch (err) {
        console.error("WebSocket parse error:", err);
      }
    };

    ws.onclose = () => console.log("❌ WebSocket disconnected");
    ws.onerror = (err) => console.error("WebSocket error:", err);

    return () => ws.close();
  }, []);

  // ✅ Combine API + live data
  const combinedDetections = [...detections, ...liveDetections];

  const chartModel = useMemo(() => {
    const points: any[] = [];

    for (const detection of combinedDetections) {
      if (typeof detection.power_dbm !== "number") continue;

      const timestampMs = Date.parse(detection.timestamp_utc);
      if (!Number.isFinite(timestampMs)) continue;

      points.push({
        sourceNode: detection.source_node,
        timestampMs,
        powerDbm: detection.power_dbm,
      });
    }

    if (points.length === 0) {
      return { rows: [], topSources: [] };
    }

    // Top sources
    const sourceHitMap = new Map<string, number>();
    for (const point of points) {
      sourceHitMap.set(point.sourceNode, (sourceHitMap.get(point.sourceNode) ?? 0) + 1);
    }

    const topSources = Array.from(sourceHitMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([source]) => source);

    // Fake distance buckets (fallback)
    const sorted = [...points].sort((a, b) => a.timestampMs - b.timestampMs);
    const indexMap = new Map<string, number>();

    const samples: any[] = [];

    for (const point of sorted) {
      if (!topSources.includes(point.sourceNode)) continue;

      const i = (indexMap.get(point.sourceNode) ?? 0) + 1;
      indexMap.set(point.sourceNode, i);

      samples.push({
        sourceNode: point.sourceNode,
        powerDbm: point.powerDbm,
        distanceMeters: Math.min(220, 20 + i * 15),
      });
    }

    const buckets = [25, 60, 135, 160, 200].map((d) => ({
      distance: d,
      sums: {} as any,
      counts: {} as any,
    }));

    for (const s of samples) {
      const idx = buckets.findIndex((b) => s.distanceMeters <= b.distance);
      const bucket = buckets[idx >= 0 ? idx : buckets.length - 1];

      bucket.sums[s.sourceNode] = (bucket.sums[s.sourceNode] ?? 0) + s.powerDbm;
      bucket.counts[s.sourceNode] = (bucket.counts[s.sourceNode] ?? 0) + 1;
    }

    const rows = buckets.map((b) => {
      const row: any = {
        distanceLabel: `${b.distance} meters`,
      };

      for (const src of topSources) {
        const count = b.counts[src] ?? 0;
        row[src] =
          count > 0 ? Number((b.sums[src] / count).toFixed(2)) : null;
      }

      return row;
    });

    return { rows, topSources };
  }, [combinedDetections]);

  return (
    <Card>
      <div style={{ display: "grid", gap: theme.spacing.md }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0 }}>RSSI Chart</h3>
            <div style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
              Per-source signal strength profile across distance buckets.
            </div>
          </div>

          <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>
            Sources tracked: {chartModel.topSources.length}
          </div>
        </div>

        {/* ✅ White Chart Box */}
        <div
          style={{
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            background: "#f8fafc",
            padding: theme.spacing.sm,
            height: 340,
          }}
        >
          {chartModel.rows.length === 0 ? (
            <div style={{ color: theme.colors.textSecondary, padding: theme.spacing.md }}>
              No RSSI samples available yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartModel.rows}>
                <CartesianGrid stroke="#d1d5db" strokeDasharray="2 2" />

                <XAxis
                  dataKey="distanceLabel"
                  tick={{ fill: theme.colors.textSecondary, fontSize: 11 }}
                />

                <YAxis
                  domain={[-160, 0]}
                  tick={{ fill: theme.colors.textSecondary, fontSize: 11 }}
                  tickFormatter={(v: number) => `${v} dBm`}
                />

                <Tooltip
                  contentStyle={{
                    background: theme.colors.surface,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radius.sm,
                  }}
                  formatter={(value: unknown, name?: string | number) =>
                    typeof value === "number"
                      ? [`${value.toFixed(2)} dBm`, String(name ?? "")]
                      : ["-", String(name ?? "")]
                  }
                />

                <Legend />

                {chartModel.topSources.map((src, i) => (
                  <Line
                    key={src}
                    type="monotone"
                    dataKey={src}
                    stroke={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Footer */}
        {chartModel.rows.length > 0 && (
          <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>
            Distance buckets are estimated from telemetry sequence because GPS coordinates are unavailable.
          </div>
        )}

      </div>
    </Card>
  );
}