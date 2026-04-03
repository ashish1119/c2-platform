// import { useState } from "react";
// import {
//   MapContainer,
//   TileLayer,
//   Marker,
//   Polyline,
//   Circle,
// } from "react-leaflet";
// import "leaflet/dist/leaflet.css";

// type Sensor = {
//   id: string;
//   name: string;
//   lat: number;
//   lng: number;
//   color: string;
//   angle: number;
// };

// export default function DFMonitoringConsole() {
//   const [running, setRunning] = useState(true);

//   const sensors: Sensor[] = [
//     {
//       id: "DF-01",
//       name: "Delhi Site",
//       lat: 28.6139,
//       lng: 77.2090,
//       color: "green",
//       angle: 40,
//     },
//     {
//       id: "DF-02",
//       name: "Mumbai Site",
//       lat: 19.0760,
//       lng: 72.8777,
//       color: "orange",
//       angle: 120,
//     },
//     {
//       id: "DF-03",
//       name: "DF Node 3",
//       lat: 23.0225,
//       lng: 72.5714,
//       color: "red",
//       angle: 200,
//     },
//   ];

//   const center = [22.5, 78.9]; // India center

//   // Create bearing lines
//   const createLine = (sensor: Sensor) => {
//     const distance = 5; // length
//     const angleRad = (sensor.angle * Math.PI) / 180;

//     const endLat = sensor.lat + distance * Math.cos(angleRad);
//     const endLng = sensor.lng + distance * Math.sin(angleRad);

//     return [
//       [sensor.lat, sensor.lng],
//       [endLat, endLng],
//     ] as [number, number][];
//   };

//   // Fake triangulation center
//   const triangulatedPoint: [number, number] = [23, 77];

//   return (
//     <div style={{ display: "flex", height: "100vh" }}>
      
//       {/* LEFT PANEL */}
//       <div style={{ width: 250, background: "#1e293b", color: "white", padding: 10 }}>
//         <h3>DF Tree</h3>

//         {sensors.map((s) => (
//           <div key={s.id} style={{ marginBottom: 10 }}>
//             <input type="checkbox" defaultChecked /> {s.id}
//           </div>
//         ))}
//       </div>

//       {/* MAIN MAP */}
//       <div style={{ flex: 1 }}>
//         {/* TOP BAR */}
//         <div
//           style={{
//             display: "flex",
//             justifyContent: "space-between",
//             padding: 10,
//             background: "#0f172a",
//             color: "white",
//           }}
//         >
//           <div>
//             <button onClick={() => setRunning(true)}>▶ Play</button>
//             <button onClick={() => setRunning(false)}>⏸ Pause</button>
//             <button onClick={() => window.location.reload()}>⟳ Reset</button>
//           </div>

//           <div>Time Range: Last 30 mins</div>
//         </div>

//         {/* MAP */}
//         <MapContainer center={center} zoom={5} style={{ height: "90%" }}>
//           <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

//           {/* Sensors */}
//           {sensors.map((s) => (
//             <Marker key={s.id} position={[s.lat, s.lng]} />
//           ))}

//           {/* Bearing Lines */}
//           {running &&
//             sensors.map((s) => (
//               <Polyline
//                 key={s.id}
//                 positions={createLine(s)}
//                 pathOptions={{ color: s.color }}
//               />
//             ))}

//           {/* Heat Zone */}
//           <Circle
//             center={triangulatedPoint}
//             radius={200000}
//             pathOptions={{ color: "red", fillOpacity: 0.4 }}
//           />

//           {/* Center point */}
//           <Marker position={triangulatedPoint} />
//         </MapContainer>
//       </div>

//       {/* RIGHT PANEL */}
//       <div style={{ width: 300, background: "#111827", color: "white", padding: 10 }}>
//         <h3>Signal & Analytics</h3>

//         <p>Active DFs: 3</p>
//         <p>Strongest: DF-02</p>
//         <p>Avg Strength: -64 dBm</p>

//         <h4>Event Log</h4>
//         <ul>
//           <li>DF-02 Signal Spike</li>
//           <li>DF-03 Fault</li>
//           <li>DF-01 Updated</li>
//         </ul>
//       </div>
//     </div>
//   );
// }


import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Sensor = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  color: string;
  angle: number;
};

export default function DFMonitoringConsole() {
  const [running, setRunning] = useState(true);

  const sensors: Sensor[] = [
    {
      id: "DF-01",
      name: "Delhi Site",
      lat: 28.6139,
      lng: 77.2090,
      color: "green",
      angle: 40,
    },
    {
      id: "DF-02",
      name: "Mumbai Site",
      lat: 19.0760,
      lng: 72.8777,
      color: "orange",
      angle: 120,
    },
    {
      id: "DF-03",
      name: "DF Node 3",
      lat: 23.0225,
      lng: 72.5714,
      color: "red",
      angle: 200,
    },
  ];

  const center: [number, number] = [22.5, 78.9];

  const createLine = (sensor: Sensor) => {
    const distance = 5;
    const angleRad = (sensor.angle * Math.PI) / 180;

    const endLat = sensor.lat + distance * Math.cos(angleRad);
    const endLng = sensor.lng + distance * Math.sin(angleRad);

    return [
      [sensor.lat, sensor.lng],
      [endLat, endLng],
    ] as [number, number][];
  };

  const triangulatedPoint: [number, number] = [23, 77];

  return (
    <div
      style={{
        display: "flex",
        height: "100%", // ✅ FIXED (no more overlap)
        overflow: "hidden",
      }}
    >
      {/* LEFT PANEL */}
      <div
        style={{
          width: 220,
          background: "#1e293b",
          color: "white",
          padding: 10,
        }}
      >
        <h3>DF Tree</h3>

        {sensors.map((s) => (
          <div key={s.id} style={{ marginBottom: 10 }}>
            <input type="checkbox" defaultChecked /> {s.id}
          </div>
        ))}
      </div>

      {/* MAIN MAP */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {/* TOP BAR */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: 10,
            background: "#0f172a",
            color: "white",
          }}
        >
          <div>
            <button onClick={() => setRunning(true)}>▶ Play</button>
            <button onClick={() => setRunning(false)}>⏸ Pause</button>
            <button onClick={() => window.location.reload()}>⟳ Reset</button>
          </div>

          <div>Time Range: Last 30 mins</div>
        </div>

        {/* MAP */}
        <div style={{ flex: 1 }}>
          <MapContainer
            center={center}
            zoom={5}
            style={{ height: "100%", width: "100%" }} // ✅ FIXED
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {/* Sensors */}
            {sensors.map((s) => (
              <Marker key={s.id} position={[s.lat, s.lng]} />
            ))}

            {/* Bearing Lines */}
            {running &&
              sensors.map((s) => (
                <Polyline
                  key={s.id}
                  positions={createLine(s)}
                  pathOptions={{ color: s.color }}
                />
              ))}

            {/* Heat Zone */}
            <Circle
              center={triangulatedPoint}
              radius={200000}
              pathOptions={{ color: "red", fillOpacity: 0.4 }}
            />

            {/* Target */}
            <Marker position={triangulatedPoint} />
          </MapContainer>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div
        style={{
          width: 260,
          background: "#111827",
          color: "white",
          padding: 10,
        }}
      >
        <h3>Signal & Analytics</h3>

        <p>Active DFs: 3</p>
        <p>Strongest: DF-02</p>
        <p>Avg Strength: -64 dBm</p>

        <h4>Event Log</h4>
        <ul>
          <li>DF-02 Signal Spike</li>
          <li>DF-03 Fault</li>
          <li>DF-01 Updated</li>
        </ul>
      </div>
    </div>
  );
}