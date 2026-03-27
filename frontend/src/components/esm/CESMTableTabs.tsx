// import React, { useState, useMemo, useEffect, useRef } from "react";
// //import AppLayout from "../../components/layout/AppLayout";
// //import PageContainer from "../../components/layout/PageContainer";
// import Card from "../../components/ui/Card";

// function InterceptListTable() {
//   return (
//     <table style={{ width: "100%", borderCollapse: "collapse", color: "#ffffff" }}>
//       <thead>
//         <tr style={{ background: "#192a3f" }}>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Id</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Status</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>First Seen</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Carrier</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>BW</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Duration</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Power</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>SNR</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>DOA</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>DOA Avg</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>DOA Std.</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Peak</th>
//         </tr>
//       </thead>
//       <tbody>
//         <tr>
//           <td colSpan={11} style={{ padding: 10, textAlign: "center" }}>
//             Dummy Intercept Data
//           </td>
//         </tr>
//       </tbody>
//     </table>
//   );
// }


// function TargetListTable() {
//   return (
//     <table style={{ width: "100%", borderCollapse: "collapse", color: "#ffffff" }}>
//       <thead>
//         <tr style={{ background: "#192a3f" }}>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>ID</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Name</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Status</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>First Seen</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Carrier</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>BW</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Duration</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Power</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>SNR</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>RF Type</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>DOA</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>DOA Avg</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>DOA Std.</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Peak</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Dynamics</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Distance</th>
//         </tr>
//       </thead>
//       <tbody> 
//         {/* {TargetData.map((row, idx) => (
//           <tr key={row.id} style={{ background: idx % 2 === 0 ? "#122033" : "#0f1a2a" }}>
//             <td style={{ padding: 8, border: "1px solid #32475a" }}>{row.frequency}</td>
//             <td style={{ padding: 8, border: "1px solid #32475a" }}>{row.bearing}</td>
//             <td style={{ padding: 8, border: "1px solid #32475a" }}>{row.rssi}</td>
//             <td style={{ padding: 8, border: "1px solid #32475a" }}>{row.snr}</td>
//             <td style={{ padding: 8, border: "1px solid #32475a" }}>{row.duration}</td>
//             <td style={{ padding: 8, border: "1px solid #32475a" }}>
//               <button style={{ marginRight: 4 }}>Play</button>
//               <button>Details</button> 
//             </td>
//           </tr>
//         ))} */}
//         <tr>
//           <td colSpan={20} style={{ padding: 10, textAlign: "center" }}>
//             Dummy Target Data
//           </td>
//         </tr>
//       </tbody>
//     </table>
//   );
// }


// function UnidentifiedListTable() {
//   return (
//     <table style={{ width: "100%", borderCollapse: "collapse", color: "#ffffff" }}>
//       <thead>
//         <tr style={{ background: "#192a3f" }}>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Id</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Status</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>First Seen</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Carrier</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>BW</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Duration</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Power</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>SNR</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>DOA</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>DOA Avg</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>DOA Std.</th>
//           <th style={{ padding: 8, border: "1px solid #32475a" }}>Peak</th>
//         </tr>
//       </thead>
//       <tbody>
//         <tr>
//           <td colSpan={11} style={{ padding: 10, textAlign: "center" }}>
//             Dummy Unidentified Data
//           </td>
//         </tr>
//       </tbody>
//     </table>
//   );
// }

// function CompassDF() {
//   return (
//     <div style={{ display: "flex", color: "#fff", padding: 20 }}>

//       {/* LEFT SIDE */}
//       <div style={{ flex: 1 }}>

//         {/* ROW 1 */}
//         <div style={{ display: "flex", gap: 40, marginBottom: 20 }}>
//           <div>
//             <div>ID</div>
//             <div style={{ borderBottom: "2px solid #fff", width: 100 }}></div>
//             <div>N/A</div>
//           </div>

//           <div>
//             <div>Frequency</div>
//             <div style={{ borderBottom: "2px solid #fff", width: 120 }}></div>
//             <div>N/A</div>
//           </div>
//         </div>

//         {/* ROW 2 */}
//         <div style={{ display: "flex", gap: 40, marginBottom: 20 }}>
//           <div>
//             <div>DOA</div>
//             <div style={{ borderBottom: "2px solid #fff", width: 100 }}></div>
//             <div>N/A</div>
//           </div>

//           <div>
//             <div>DOA Average</div>
//             <div style={{ borderBottom: "2px solid #fff", width: 120 }}></div>
//             <div>N/A</div>
//           </div>
//         </div>

//         {/* ROW 3 */}
//         <div style={{ display: "flex", gap: 40 }}>
//           <div>
//             <div>Quality</div>
//             <div style={{ borderBottom: "2px solid #fff", width: 100 }}></div>
//             <div>N/A</div>
//           </div>

//           <div>
//             <div>Power</div>
//             <div style={{ borderBottom: "2px solid #fff", width: 120 }}></div>
//             <div>N/A</div>
//           </div>
//         </div>

//       </div>

//       {/* RIGHT SIDE COMPASS */}
//       <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
        
//         <div
//           style={{
//             width: 300,
//             height: 300,
//             borderRadius: "50%",
//             border: "2px solid #fff",
//             position: "relative"
//           }}
//         >

//           {/* TICKS (major + minor) */}
//           {Array.from({ length: 72 }).map((_, i) => {
//             const angle = i * 5; // every 5°
//             const isMajor = angle % 30 === 0;

//             return (
//               <div
//                 key={i}
//                 style={{
//                   position: "absolute",
//                   width: isMajor ? 2 : 1,
//                   height: isMajor ? 20 : 10,
//                   background: "white",
//                   top: "50%",
//                   left: "50%",
//                   transformOrigin: "bottom center",
//                   transform: `rotate(${angle}deg) translate(-50%, -140px)`,
//                   opacity: isMajor ? 0.8 : 0.3
//                 }}
//               />
//             );
//           })}

//           {/* DEGREE LABELS (OUTSIDE) */}
//           {[
//             "000","030","060","090","120","150",
//             "180","210","240","270","300","330"
//           ].map((deg, i) => {
//             const angle = i * 30 * (Math.PI / 180);
//             const radius = 170; // OUTSIDE radius

//             const x = 150 + radius * Math.sin(angle);
//             const y = 150 - radius * Math.cos(angle);

//             return (
//               <div
//                 key={deg}
//                 style={{
//                   position: "absolute",
//                   left: x,
//                   top: y,
//                   transform: "translate(-50%, -50%)",
//                   fontSize: 12,
//                   fontWeight: "bold"
//                 }}
//               >
//                 {deg}
//               </div>
//             );
//           })}

//         </div>

//       </div>
//     </div>
//   );
// }

// export default function CESMTableTabs() {
//   const [activeSubTab, setActiveSubTab] = useState(0);
//   const subTabs = ["INTERCEPT LIST", "TARGET LIST", "UNIDENTIFIED LIST", "COMPASS DF"];

//   return (
//     <Card>
//       <div style={{ marginTop: 16 }}>
                        
//       {/* Sub-tabs */}
//       <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
//         {subTabs.map((tab, idx) => (
//           <button
//             key={tab}
//             onClick={() => setActiveSubTab(idx)}
//             style={{
//               padding: "6px 12px",
//               borderRadius: 4,
//               border: "none",
//               background: activeSubTab === idx ? "#1976d2" : "#e0e0e0",
//               color: activeSubTab === idx ? "#fff" : "#333",
//               fontWeight: 600,
//               cursor: "pointer",
//             }}
//           >
//             {tab}
//           </button>
//         ))}
//       </div>

//       {/* <InterceptTable /> */}
//       {activeSubTab === 0 && <InterceptListTable />}

//       {activeSubTab === 1 && <TargetListTable />}

//       {activeSubTab === 2 && <UnidentifiedListTable />}

//       {/*{activeSubTab === 3 && (
//         <div style={{ padding: 20 }}>COMPASS DF (Dummy Table)</div>
//       )}*/}
//       {activeSubTab === 3 && <CompassDF />}
//       </div>
//     </Card>
//   );
// }


import React, { useState, useEffect } from "react";
import Card from "../../components/ui/Card";

type RFDataType = {
  id: number;
  freq: number;
  power: number;
  snr: number;
  lat?: number;
  lon?: number;
  DOA: number;
};

// ✅ reusable styles
const thStyle = {
  padding: 8,
  border: "1px solid #32475a",
  background: "#192a3f",
  position: "sticky" as const,
  top: 0,
  zIndex: 2,
};

const tdStyle = {
  padding: 8,
  border: "1px solid #32475a",
};

// ✅ INTERCEPT TABLE (UPDATED)
function InterceptListTable({
  data,
  highlightIds,
}: {
  data: RFDataType[];
  highlightIds: number[];
}) {
  return (
    <div
      style={{
        maxHeight: "400px",
        overflowY: "auto",
        overflowX: "auto",
        border: "1px solid #32475a",
      }}
    >
      <table
        style={{
          width: "100%",
          minWidth: "1200px",
          borderCollapse: "collapse",
          color: "#ffffff",
        }}
      >
        <thead>
          <tr>
            <th style={thStyle}>Id</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>First Seen</th>
            <th style={thStyle}>Carrier</th>
            <th style={thStyle}>BW</th>
            <th style={thStyle}>Duration</th>
            <th style={thStyle}>Power</th>
            <th style={thStyle}>SNR</th>
            <th style={thStyle}>DOA</th>
            <th style={thStyle}>DOA Avg</th>
            <th style={thStyle}>DOA Std.</th>
            <th style={thStyle}>Peak</th>
          </tr>
        </thead>

        <tbody>
          {data && data.length > 0 ? (
            data.map((row, idx) => {
              const isNew = highlightIds.includes(row.id);

              return (
                <tr
                  key={row.id}
                  style={{
                    background: isNew
                      ? "#00ffcc33"
                      : idx % 2 === 0
                      ? "#122033"
                      : "#0f1a2a",
                    boxShadow: isNew ? "0 0 10px #00ffcc" : "none",
                    transition: "all 0.5s ease",
                  }}
                >
                  <td style={tdStyle}>{row.id}</td>
                  <td style={{ ...tdStyle, color: "lime" }}>ACTIVE</td>
                  <td style={tdStyle}>
                    {new Date().toLocaleTimeString()}
                  </td>
                  <td style={tdStyle}>{row.freq}</td>
                  <td style={tdStyle}>-</td>
                  <td style={tdStyle}>-</td>
                  <td style={tdStyle}>{row.power}</td>
                  <td style={tdStyle}>{row.snr}</td>
                  <td style={tdStyle}>{row.DOA !== undefined ? row.DOA.toFixed(2) : "-"}</td>
                  <td style={tdStyle}>-</td>
                  <td style={tdStyle}>-</td>
                  <td style={tdStyle}>-</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={12} style={{ padding: 10, textAlign: "center" }}>
                Dummy Intercept Data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}


// ✅ MAIN COMPONENT
export default function CESMTableTabs() {
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [rfData, setRfData] = useState<RFDataType[]>([]);
  const [highlightIds, setHighlightIds] = useState<number[]>([]);

  const subTabs = [
    "INTERCEPT LIST",
    "TARGET LIST",
    "UNIDENTIFIED LIST",
    "COMPASS DF",
  ];

  useEffect(() => {
    const token = localStorage.getItem("token");

    console.log("TOKEN:", token);

    const ws = new WebSocket(
      `ws://localhost:8000/ws/rf-data?token=${token}` //use this for local development
    );

    ws.onopen = () => console.log("✅ WS Connected");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      setRfData((prev) => {
        const updated = [data, ...prev].slice(0, 50);
        return updated;
      });

      setHighlightIds((prev) => [...prev, data.id]);

      setTimeout(() => {
        setHighlightIds((prev) =>
          prev.filter((id) => id !== data.id)
        );
      }, 2000);
    };

    ws.onerror = (err) => console.log("❌ WS Error:", err);
    ws.onclose = () => console.log("❌ WS Closed");

    return () => ws.close();
  }, []);

  return (
    <Card>
      <div style={{ marginTop: 16 }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {subTabs.map((tab, idx) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(idx)}
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                border: "none",
                background: activeSubTab === idx ? "#1976d2" : "#e0e0e0",
                color: activeSubTab === idx ? "#fff" : "#333",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* INTERCEPT TABLE */}
        {activeSubTab === 0 && (
          <InterceptListTable
            data={rfData}
            highlightIds={highlightIds}
          />
        )}

        {activeSubTab === 1 && <div>Target List (unchanged)</div>}
        {activeSubTab === 2 && <div>Unidentified List (unchanged)</div>}
        {activeSubTab === 3 && <div>Compass DF (unchanged)</div>}
      </div>
    </Card>
  );
}