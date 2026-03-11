
// import { useEffect, useState, useMemo } from "react";
// import AppLayout from "../components/layout/AppLayout";
// import PageContainer from "../components/layout/PageContainer";
// import AlertTable from "../components/AlertTable";
// import { getAssets, type AssetRecord } from "../api/assets";
// import { getHeatMap, getRFSignals, getTriangulation, type HeatCell, type RFSignal, type TriangulationResult } from "../api/rf";
// import { useTheme } from "../context/ThemeContext";

// import {
//   ResponsiveContainer,
//   PieChart,
//   Pie,
//   Tooltip,
//   Legend,
//   Cell
// } from "recharts";

// export default function OperatorDashboard() {
//   const { theme } = useTheme();

//   const [assets, setAssets] = useState<AssetRecord[]>([]);
//   const [signals, setSignals] = useState<RFSignal[]>([]);
//   const [heatCells, setHeatCells] = useState<HeatCell[]>([]);
//   const [triangulation, setTriangulation] = useState<TriangulationResult | null>(null);

//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     const load = async () => {
//       try {
//         setError(null);

//         const [assetsRes, signalsRes, heatRes, triangulationRes] = await Promise.all([
//           getAssets(),
//           getRFSignals(),
//           getHeatMap(),
//           getTriangulation(),
//         ]);

//         setAssets(assetsRes.data);
//         setSignals(signalsRes.data);
//         setHeatCells(heatRes.data);
//         setTriangulation(triangulationRes.data);
//       } catch {
//         setError("Failed to load operator data.");
//       } finally {
//         setLoading(false);
//       }
//     };

//     load();
//     const interval = setInterval(load, 15000);
//     return () => clearInterval(interval);
//   }, []);

//   // ✅ Calculate modulation counts
//   const modulationData = useMemo(() => {
//     let AM = 0;
//     let FM = 0;
//     let Others = 0;

//     signals.forEach((signal) => {
//       const mod = signal.modulation?.toUpperCase();

//       if (mod === "AM") AM++;
//       else if (mod === "FM") FM++;
//       else Others++;
//     });

//     return [
//       { name: "AM", value: AM },
//       { name: "FM", value: FM },
//       { name: "Others", value: Others },
//     ];
//   }, [signals]);

//   const COLORS = ["#3b82f6", "#10b981", "#f59e0b"];

//   return (
//     <AppLayout>
//       <PageContainer title="Operations Center">

//         {loading && (
//           <div style={{ marginBottom: theme.spacing.md, color: theme.colors.textSecondary }}>
//             Loading operational feeds...
//           </div>
//         )}

//         {error && (
//           <div style={{ marginBottom: theme.spacing.md, color: theme.colors.danger }}>
//             {error}
//           </div>
//         )}

//         <div
//           style={{
//             display: "grid",
//             gridTemplateColumns: "1fr 1fr",
//             gap: theme.spacing.lg,
//             marginBottom: theme.spacing.xl,
//           }}
//         >

//           {/* PIE CHART */}
//           <div>
//             <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>
//               Modulation Distribution
//             </h3>

//             <div
//               style={{
//                 height: 320,
//                 background: theme.colors.surfaceAlt,
//                 border: `1px solid ${theme.colors.border}`,
//                 borderRadius: theme.radius.md,
//                 padding: theme.spacing.sm,
//               }}
//             >
//               <ResponsiveContainer width="100%" height="100%">
//                 <PieChart>
//                   <Pie
//                     data={modulationData}
//                     dataKey="value"
//                     nameKey="name"
//                     outerRadius={110}
//                     label
//                   >
//                     {modulationData.map((entry, index) => (
//                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
//                     ))}
//                   </Pie>

//                   <Tooltip />
//                   <Legend />
//                 </PieChart>
//               </ResponsiveContainer>
//             </div>
//           </div>

//           {/* RF SIGNAL TABLE */}
//           <div>
//             <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>
//               RF Signals
//             </h3>

//             <table
//               style={{
//                 width: "100%",
//                 borderCollapse: "collapse",
//                 background: theme.colors.surfaceAlt,
//                 border: `1px solid ${theme.colors.border}`,
//                 borderRadius: theme.radius.md,
//                 overflow: "hidden",
//               }}
//             >
//               <thead>
//                 <tr>
//                   <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Frequency</th>
//                   <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Modulation</th>
//                   <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Power</th>
//                   <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Timestamp</th>
//                 </tr>
//               </thead>

//               <tbody>
//                 {signals.slice(0, 20).map((signal) => (
//                   <tr key={signal.id}>
//                     <td style={{ padding: theme.spacing.sm }}>{signal.frequency}</td>
//                     <td style={{ padding: theme.spacing.sm }}>{signal.modulation}</td>
//                     <td style={{ padding: theme.spacing.sm }}>{signal.power_level}</td>
//                     <td style={{ padding: theme.spacing.sm }}>
//                       {new Date(signal.detected_at).toLocaleString()}
//                     </td>
//                   </tr>
//                 ))}

//                 {signals.length === 0 && (
//                   <tr>
//                     <td style={{ padding: theme.spacing.sm }} colSpan={4}>
//                       No RF signals available.
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>

//         </div>

//         {/* HEAT MAP TABLE */}
//         <div style={{ marginBottom: theme.spacing.xl }}>
//           <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>
//             Heat Map Density Cells
//           </h3>

//           <table
//             style={{
//               width: "100%",
//               borderCollapse: "collapse",
//               background: theme.colors.surfaceAlt,
//               border: `1px solid ${theme.colors.border}`,
//               borderRadius: theme.radius.md,
//               overflow: "hidden",
//             }}
//           >
//             <thead>
//               <tr>
//                 <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Latitude</th>
//                 <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Longitude</th>
//                 <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Density</th>
//               </tr>
//             </thead>

//             <tbody>
//               {heatCells.slice(0, 20).map((cell, index) => (
//                 <tr key={`${cell.latitude_bucket}-${cell.longitude_bucket}-${index}`}>
//                   <td style={{ padding: theme.spacing.sm }}>{cell.latitude_bucket}</td>
//                   <td style={{ padding: theme.spacing.sm }}>{cell.longitude_bucket}</td>
//                   <td style={{ padding: theme.spacing.sm }}>{cell.density}</td>
//                 </tr>
//               ))}

//               {heatCells.length === 0 && (
//                 <tr>
//                   <td style={{ padding: theme.spacing.sm }} colSpan={3}>
//                     No heat map cells available.
//                   </td>
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </div>

//         <AlertTable />

//       </PageContainer>
//     </AppLayout>
//   );
// }


// import { useEffect, useState, useMemo } from "react";
// import AppLayout from "../components/layout/AppLayout";
// import PageContainer from "../components/layout/PageContainer";
// import AlertTable from "../components/AlertTable";
// import { getAssets, type AssetRecord } from "../api/assets";
// import { getHeatMap, getRFSignals, getTriangulation, type HeatCell, type RFSignal, type TriangulationResult } from "../api/rf";
// import { useTheme } from "../context/ThemeContext";

// import {
//   ResponsiveContainer,
//   PieChart,
//   Pie,
//   Tooltip,
//   Legend,
//   Cell,
//   ScatterChart,
//   Scatter,
//   XAxis,
//   YAxis,
//   CartesianGrid,
// } from "recharts";

// export default function OperatorDashboard() {
//   const { theme } = useTheme();

//   const [assets, setAssets] = useState<AssetRecord[]>([]);
//   const [signals, setSignals] = useState<RFSignal[]>([]);
//   const [heatCells, setHeatCells] = useState<HeatCell[]>([]);
//   const [triangulation, setTriangulation] = useState<TriangulationResult | null>(null);

//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     const load = async () => {
//       try {
//         setError(null);

//         const [assetsRes, signalsRes, heatRes, triangulationRes] = await Promise.all([
//           getAssets(),
//           getRFSignals(),
//           getHeatMap(),
//           getTriangulation(),
//         ]);

//         setAssets(assetsRes.data);
//         setSignals(signalsRes.data);
//         setHeatCells(heatRes.data);
//         setTriangulation(triangulationRes.data);
//       } catch {
//         setError("Failed to load operator data.");
//       } finally {
//         setLoading(false);
//       }
//     };

//     load();
//     const interval = setInterval(load, 15000);
//     return () => clearInterval(interval);
//   }, []);

//   // PIE CHART DATA
//   const modulationData = useMemo(() => {
//     let AM = 0;
//     let FM = 0;
//     let Others = 0;

//     signals.forEach((signal) => {
//       const mod = signal.modulation?.toUpperCase();

//       if (mod === "AM") AM++;
//       else if (mod === "FM") FM++;
//       else Others++;
//     });

//     return [
//       { name: "AM", value: AM },
//       { name: "FM", value: FM },
//       { name: "Others", value: Others },
//     ];
//   }, [signals]);

//   const COLORS = ["#3b82f6", "#10b981", "#f59e0b"];

//   return (
//     <AppLayout>
//       <PageContainer title="Operations Center">

//         {loading && (
//           <div style={{ marginBottom: theme.spacing.md, color: theme.colors.textSecondary }}>
//             Loading operational feeds...
//           </div>
//         )}

//         {error && (
//           <div style={{ marginBottom: theme.spacing.md, color: theme.colors.danger }}>
//             {error}
//           </div>
//         )}

//         {/* TOP SECTION */}
//         <div
//           style={{
//             display: "grid",
//             gridTemplateColumns: "1fr 1fr",
//             gap: theme.spacing.lg,
//             marginBottom: theme.spacing.xl,
//           }}
//         >

//           {/* MODULATION PIE CHART */}
//           <div>
//             <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>
//               Modulation Distribution
//             </h3>

//             <div
//               style={{
//                 height: 320,
//                 background: theme.colors.surfaceAlt,
//                 border: `1px solid ${theme.colors.border}`,
//                 borderRadius: theme.radius.md,
//                 padding: theme.spacing.sm,
//               }}
//             >
//               <ResponsiveContainer width="100%" height="100%">
//                 <PieChart>
//                   <Pie
//                     data={modulationData}
//                     dataKey="value"
//                     nameKey="name"
//                     outerRadius={110}
//                     label
//                   >
//                     {modulationData.map((entry, index) => (
//                       <Cell key={index} fill={COLORS[index % COLORS.length]} />
//                     ))}
//                   </Pie>

//                   <Tooltip />
//                   <Legend />
//                 </PieChart>
//               </ResponsiveContainer>
//             </div>
//           </div>

//           {/* RF SIGNAL TABLE */}
//           <div>
//             <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>
//               RF Signals
//             </h3>

//             <table
//               style={{
//                 width: "100%",
//                 borderCollapse: "collapse",
//                 background: theme.colors.surfaceAlt,
//                 border: `1px solid ${theme.colors.border}`,
//                 borderRadius: theme.radius.md,
//               }}
//             >
//               <thead>
//                 <tr>
//                   <th style={{ padding: theme.spacing.sm }}>Frequency</th>
//                   <th style={{ padding: theme.spacing.sm }}>Modulation</th>
//                   <th style={{ padding: theme.spacing.sm }}>Power</th>
//                   <th style={{ padding: theme.spacing.sm }}>Timestamp</th>
//                 </tr>
//               </thead>

//               <tbody>
//                 {signals.slice(0, 20).map((signal) => (
//                   <tr key={signal.id}>
//                     <td style={{ padding: theme.spacing.sm }}>{signal.frequency}</td>
//                     <td style={{ padding: theme.spacing.sm }}>{signal.modulation}</td>
//                     <td style={{ padding: theme.spacing.sm }}>{signal.power_level}</td>
//                     <td style={{ padding: theme.spacing.sm }}>
//                       {new Date(signal.detected_at).toLocaleString()}
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>

//         </div>

//         {/* HEAT MAP VISUALIZATION */}
//         <div style={{ marginBottom: theme.spacing.xl }}>
//           <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>
//             RF Heat Map Density
//           </h3>

//           <div
//             style={{
//               height: 350,
//               background: theme.colors.surfaceAlt,
//               border: `1px solid ${theme.colors.border}`,
//               borderRadius: theme.radius.md,
//               padding: theme.spacing.sm,
//             }}
//           >
//             <ResponsiveContainer width="100%" height="100%">
//               <ScatterChart>
//                 <CartesianGrid />
//                 <XAxis
//                   type="number"
//                   dataKey="longitude_bucket"
//                   name="Longitude"
//                 />
//                 <YAxis
//                   type="number"
//                   dataKey="latitude_bucket"
//                   name="Latitude"
//                 />

//                 <Tooltip cursor={{ strokeDasharray: "3 3" }} />

//                 <Scatter
//                   name="Signal Density"
//                   data={heatCells}
//                   fill="#ef4444"
//                 />
//               </ScatterChart>
//             </ResponsiveContainer>
//           </div>
//         </div>

//         <AlertTable />

//       </PageContainer>
//     </AppLayout>
//   );
// }



import { useEffect, useState, useMemo } from "react";
import AppLayout from "../components/layout/AppLayout";
import PageContainer from "../components/layout/PageContainer";
import AlertTable from "../components/AlertTable";

import { getAssets, type AssetRecord } from "../api/assets";
import { getHeatMap, getRFSignals, getTriangulation, type HeatCell, type RFSignal, type TriangulationResult } from "../api/rf";

import { useTheme } from "../context/ThemeContext";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  Legend,
  Cell
} from "recharts";

import { MapContainer, TileLayer, Marker, Polyline, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function OperatorDashboard() {

  const { theme } = useTheme();

  const [signals, setSignals] = useState<RFSignal[]>([]);
  const [heatCells, setHeatCells] = useState<HeatCell[]>([]);
  const [triangulation, setTriangulation] = useState<TriangulationResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {

    const load = async () => {

      try {

        setError(null);

        const [signalsRes, heatRes, triangulationRes] = await Promise.all([
          getRFSignals(),
          getHeatMap(),
          getTriangulation(),
        ]);

        setSignals(signalsRes.data);
        setHeatCells(heatRes.data);
        setTriangulation(triangulationRes.data);

      } catch {
        setError("Failed to load operator data.");
      }

      setLoading(false);
    };

    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);

  }, []);

  const modulationData = useMemo(() => {

    let AM = 0;
    let FM = 0;
    let Others = 0;

    signals.forEach((s) => {

      const mod = s.modulation?.toUpperCase();

      if (mod === "AM") AM++;
      else if (mod === "FM") FM++;
      else Others++;

    });

    return [
      { name: "AM", value: AM },
      { name: "FM", value: FM },
      { name: "Others", value: Others },
    ];

  }, [signals]);

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b"];

  return (

    <AppLayout>
      <PageContainer title="Operations Center">

        {loading && <div>Loading...</div>}
        {error && <div style={{ color: "red" }}>{error}</div>}

        {/* TOP DASHBOARD */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: theme.spacing.lg,
            marginBottom: theme.spacing.xl,
          }}
        >

          {/* PIE CHART */}
          <div>
            <h3>Modulation Distribution</h3>

            <div style={{
              height: 320,
              background: theme.colors.surfaceAlt,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              padding: theme.spacing.sm
            }}>

              <ResponsiveContainer width="100%" height="100%">

                <PieChart>

                  <Pie
                    data={modulationData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={110}
                    label
                  >
                    {modulationData.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>

                  <Tooltip />
                  <Legend />

                </PieChart>

              </ResponsiveContainer>

            </div>
          </div>

          {/* RF SIGNAL TABLE */}
          <div>

            <h3>RF Signals</h3>

            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              background: theme.colors.surfaceAlt,
              border: `1px solid ${theme.colors.border}`
            }}>

              <thead>
                <tr>
                  <th>Frequency</th>
                  <th>Modulation</th>
                  <th>Power</th>
                  <th>Timestamp</th>
                </tr>
              </thead>

              <tbody>

                {signals.slice(0, 20).map((signal) => (

                  <tr key={signal.id}>
                    <td>{signal.frequency}</td>
                    <td>{signal.modulation}</td>
                    <td>{signal.power_level}</td>
                    <td>{new Date(signal.detected_at).toLocaleString()}</td>
                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </div>

        {/* RF TRIANGULATION MAP */}

        <div style={{ marginBottom: theme.spacing.xl }}>

          <h3>RF Triangulation Map</h3>

          <div style={{
            height: 500,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md
          }}>

            <MapContainer
              center={[12.97, 77.59]}
              zoom={12}
              style={{ height: "100%", width: "100%" }}
            >

              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* ANTENNA RAYS */}
              {triangulation?.rays.map((ray, i) => (

                <Polyline
                  key={i}
                  positions={[
                    [ray.source_latitude, ray.source_longitude],
                    [ray.end_latitude, ray.end_longitude]
                  ]}
                  color="red"
                />

              ))}

              {/* ANTENNA LOCATIONS */}
              {triangulation?.rays.map((ray, i) => (

                <Marker
                  key={"src" + i}
                  position={[ray.source_latitude, ray.source_longitude]}
                />

              ))}

              {/* HEAT DENSITY */}
              {heatCells.map((cell, i) => (

                <CircleMarker
                  key={i}
                  center={[cell.latitude_bucket, cell.longitude_bucket]}
                  radius={5 + cell.density * 2}
                  color="orange"
                />

              ))}

            </MapContainer>

          </div>

        </div>

        <AlertTable />

      </PageContainer>
    </AppLayout>
  );
}