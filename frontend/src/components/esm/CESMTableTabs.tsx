// import React, { useEffect, useState, useMemo } from "react";
// import Card from "../../components/ui/Card";
// import { getSmsDetections, type SmsDetectionRecord } from "../../api/operatorDashboard";

// type RFDataType = {
//   id: number;
//   freq: number;
//   power: number;
//   snr: number;
//   lat?: number;
//   lon?: number;
//   DOA: number;
//   source_node?: string;
//   sensor_id?: string;
// };

// const thStyle = {
//   padding: 8,
//   border: "1px solid #32475a",
//   background: "#192a3f",
//   position: "sticky" as const,
//   top: 0,
//   zIndex: 2,
// };

// const tdStyle = {
//   padding: 8,
//   border: "1px solid #32475a",
// };

// function InterceptListTable({
//   data,
//   highlightIds,
// }: {
//   data: RFDataType[];
//   highlightIds: number[];
// }) {
//   return (
//     <div
//       style={{
//         maxHeight: "400px",
//         overflowY: "auto",
//         overflowX: "auto",
//         border: "1px solid #32475a",
//       }}
//     >
//       <table
//         style={{
//           width: "100%",
//           minWidth: "1200px",
//           borderCollapse: "collapse",
//           color: "#ffffff",
//         }}
//       >
//         <thead>
//           <tr>
//             <th style={thStyle}>Id</th>
//             <th style={thStyle}>Status</th>
//             <th style={thStyle}>First Seen</th>
//             <th style={thStyle}>Carrier</th>
//             <th style={thStyle}>BW</th>
//             <th style={thStyle}>Duration</th>
//             <th style={thStyle}>Power</th>
//             <th style={thStyle}>SNR</th>
//             <th style={thStyle}>DOA</th>
//             <th style={thStyle}>DOA Avg</th>
//             <th style={thStyle}>DOA Std.</th>
//             <th style={thStyle}>Peak</th>
//           </tr>
//         </thead>

//         <tbody>
//           {data.length > 0 ? (
//             data.map((row, idx) => {
//               const isNew = highlightIds.includes(row.id);

//               return (
//                 <tr
//                   key={row.id}
//                   style={{
//                     background: isNew
//                       ? "#00ffcc33"
//                       : idx % 2 === 0
//                       ? "#122033"
//                       : "#0f1a2a",
//                     boxShadow: isNew ? "0 0 10px #00ffcc" : "none",
//                     transition: "all 0.5s ease",
//                   }}
//                 >
//                   <td style={tdStyle}>{row.id}</td>
//                   <td style={{ ...tdStyle, color: "lime" }}>ACTIVE</td>
//                   <td style={tdStyle}>
//                     {new Date().toLocaleTimeString()}
//                   </td>
//                   <td style={tdStyle}>{row.freq}</td>
//                   <td style={tdStyle}>-</td>
//                   <td style={tdStyle}>-</td>
//                   <td style={tdStyle}>{row.power}</td>
//                   <td style={tdStyle}>{row.snr}</td>
//                   <td style={tdStyle}>{row.DOA !== undefined ? row.DOA.toFixed(2) : "-"}</td>
//                   <td style={tdStyle}>-</td>
//                   <td style={tdStyle}>-</td>
//                   <td style={tdStyle}>-</td>
//                 </tr>
//               );
//             })
//           ) : (
//             <tr>
//               <td colSpan={12} style={{ padding: 10, textAlign: "center" }}>
//                 No Detection Data
//               </td>
//             </tr>
//           )}
//         </tbody>
//       </table>
//     </div>
//   );
// }

// export default function CESMTableTabs() {
//   const [activeSubTab, setActiveSubTab] = useState(0);
//   const [rfData, setRfData] = useState<RFDataType[]>([]);
//   const [highlightIds, setHighlightIds] = useState<number[]>([]);
//   const [loading, setLoading] = useState(true);

//   const subTabs = [
//     "INTERCEPT LIST",
//     "TARGET LIST",
//     "UNIDENTIFIED LIST",
//     "COMPASS DF",
//   ];

//   // Fetch SMS detections for DF North Node 1
//   useEffect(() => {
//     const fetchDetections = async () => {
//       try {
//         setLoading(true);
//         const response = await getSmsDetections({
//           limit: 50,
//           source_node: "DF North Node 1",
//         });
        
//         if (Array.isArray(response.data)) {
//           const converted = (response.data as SmsDetectionRecord[]).map((det, idx) => ({
//             id: idx + 1,
//             freq: det.frequency_hz || 0,
//             power: det.power_dbm || 0,
//             snr: det.snr || 0,
//             lat: det.latitude,
//             lon: det.longitude,
//             DOA: det.doa_azimuth_deg || 0,
//             source_node: "DF North Node 1",
//             sensor_id: "df-north-01",
//           }));
//           setRfData(converted);
//         }
//       } catch (error) {
//         console.error("Failed to fetch detections:", error);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchDetections();
    
//     // Poll every 5 seconds for updates
//     const interval = setInterval(fetchDetections, 5000);
//     return () => clearInterval(interval);
//   }, []);

//   return (
//     <Card>
//       <div style={{ marginTop: 16 }}>
//         {/* Tabs */}
//         <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
//           {subTabs.map((tab, idx) => (
//             <button
//               key={tab}
//               onClick={() => setActiveSubTab(idx)}
//               style={{
//                 padding: "6px 12px",
//                 borderRadius: 4,
//                 border: "none",
//                 background: activeSubTab === idx ? "#1976d2" : "#e0e0e0",
//                 color: activeSubTab === idx ? "#fff" : "#333",
//                 fontWeight: 600,
//                 cursor: "pointer",
//               }}
//             >
//               {tab}
//             </button>
//           ))}
//           {loading && <span style={{ marginLeft: "auto", color: "#666" }}>Loading...</span>}
//         </div>

//         {activeSubTab === 0 && (
//           <InterceptListTable
//             data={rfData}
//             highlightIds={highlightIds}
//           />
//         )}

//         {activeSubTab === 1 && <div style={{ padding: "20px", color: "#999" }}>Target List (unchanged)</div>}
//         {activeSubTab === 2 && <div style={{ padding: "20px", color: "#999" }}>Unidentified List (unchanged)</div>}
//         {activeSubTab === 3 && <div style={{ padding: "20px", color: "#999" }}>Compass DF (unchanged)</div>}
//       </div>
//     </Card>
//   );
// }


// import React, { useEffect, useState } from "react";
// import Card from "../../components/ui/Card";

// type RFDataType = {
//   id: number;
//   freq: number;
//   power: number;
//   snr: number;
//   lat?: number;
//   lon?: number;
//   DOA: number;
//   source_node?: string;
//   sensor_id?: string;
// };

// const thStyle = {
//   padding: 8,
//   border: "1px solid #32475a",
//   background: "#192a3f",
//   position: "sticky" as const,
//   top: 0,
//   zIndex: 2,
// };

// const tdStyle = {
//   padding: 8,
//   border: "1px solid #32475a",
// };

// function InterceptListTable({
//   data,
//   highlightIds,
// }: {
//   data: RFDataType[];
//   highlightIds: number[];
// }) {
//   return (
//     <div
//       style={{
//         maxHeight: "400px",
//         overflowY: "auto",
//         overflowX: "auto",
//         border: "1px solid #32475a",
//       }}
//     >
//       <table
//         style={{
//           width: "100%",
//           minWidth: "1200px",
//           borderCollapse: "collapse",
//           color: "#ffffff",
//         }}
//       >
//         <thead>
//           <tr>
//             <th style={thStyle}>Id</th>
//             <th style={thStyle}>Status</th>
//             <th style={thStyle}>First Seen</th>
//             <th style={thStyle}>Carrier</th>
//             <th style={thStyle}>BW</th>
//             <th style={thStyle}>Duration</th>
//             <th style={thStyle}>Power</th>
//             <th style={thStyle}>SNR</th>
//             <th style={thStyle}>DOA</th>
//             <th style={thStyle}>DOA Avg</th>
//             <th style={thStyle}>DOA Std.</th>
//             <th style={thStyle}>Peak</th>
//           </tr>
//         </thead>

//         <tbody>
//           {data.length > 0 ? (
//             data.map((row, idx) => {
//               const isNew = highlightIds.includes(row.id);

//               return (
//                 <tr
//                   key={row.id}
//                   style={{
//                     background: isNew
//                       ? "#00ffcc33"
//                       : idx % 2 === 0
//                       ? "#122033"
//                       : "#0f1a2a",
//                     boxShadow: isNew ? "0 0 10px #00ffcc" : "none",
//                     transition: "all 0.5s ease",
//                   }}
//                 >
//                   <td style={tdStyle}>{row.id}</td>
//                   <td style={{ ...tdStyle, color: "lime" }}>LIVE</td>
//                   <td style={tdStyle}>
//                     {new Date().toLocaleTimeString()}
//                   </td>
//                   <td style={tdStyle}>{row.freq}</td>
//                   <td style={tdStyle}>-</td>
//                   <td style={tdStyle}>-</td>
//                   <td style={tdStyle}>{row.power}</td>
//                   <td style={tdStyle}>{row.snr}</td>
//                   <td style={tdStyle}>
//                     {row.DOA !== undefined
//                       ? row.DOA.toFixed(2)
//                       : "-"}
//                   </td>
//                   <td style={tdStyle}>-</td>
//                   <td style={tdStyle}>-</td>
//                   <td style={tdStyle}>-</td>
//                 </tr>
//               );
//             })
//           ) : (
//             <tr>
//               <td colSpan={12} style={{ padding: 10, textAlign: "center" }}>
//                 No Detection Data
//               </td>
//             </tr>
//           )}
//         </tbody>
//       </table>
//     </div>
//   );
// }

// export default function CESMTableTabs() {
//   const [activeSubTab, setActiveSubTab] = useState(0);
//   const [rfData, setRfData] = useState<RFDataType[]>([]);
//   const [highlightIds, setHighlightIds] = useState<number[]>([]);
//   const [loading, setLoading] = useState(true);

//   const subTabs = [
//     "INTERCEPT LIST",
//     "TARGET LIST",
//     "UNIDENTIFIED LIST",
//     "COMPASS DF",
//   ];

//   useEffect(() => {
//     const ws = new WebSocket("ws://localhost:8000/ws/rf");

//     ws.onopen = () => {
//       console.log("✅ WebSocket Connected");
//       setLoading(false);
//     };

//     ws.onmessage = (event) => {
//       try {
//         const message = JSON.parse(event.data);
//         const newDataArray = Array.isArray(message)
//           ? message
//           : [message];

//         const converted = newDataArray.map((det: any) => ({
//           id: Date.now() + Math.random(),
//           freq: det.frequency_hz || 0,
//           power: det.power_dbm || 0,
//           snr: det.snr || 0,
//           lat: det.latitude,
//           lon: det.longitude,
//           DOA: det.doa_azimuth_deg || 0,
//           source_node: det.source_node || "DF North Node 1",
//           sensor_id: det.sensor_id || "df-north-01",
//         }));

//         setRfData((prev) => {
//           const updated = [...converted, ...prev].slice(0, 50);

//           const newIds = converted.map((d) => d.id);
//           setHighlightIds(newIds);

//           setTimeout(() => {
//             setHighlightIds([]);
//           }, 2000);

//           return updated;
//         });
//       } catch (err) {
//         console.error("❌ WebSocket parse error:", err);
//       }
//     };

//     ws.onerror = (err) => {
//       console.error("❌ WebSocket error:", err);
//     };

//     ws.onclose = () => {
//       console.log("🔌 WebSocket disconnected");
//     };

//     return () => {
//       ws.close();
//     };
//   }, []);

//   return (
//     <Card>
//       <div style={{ marginTop: 16 }}>
//         {/* Tabs */}
//         <div
//           style={{
//             display: "flex",
//             gap: 8,
//             marginTop: 16,
//             alignItems: "center",
//           }}
//         >
//           {subTabs.map((tab, idx) => (
//             <button
//               key={tab}
//               onClick={() => setActiveSubTab(idx)}
//               style={{
//                 padding: "6px 12px",
//                 borderRadius: 4,
//                 border: "none",
//                 background:
//                   activeSubTab === idx ? "#1976d2" : "#e0e0e0",
//                 color: activeSubTab === idx ? "#fff" : "#333",
//                 fontWeight: 600,
//                 cursor: "pointer",
//               }}
//             >
//               {tab}
//             </button>
//           ))}
//           {loading && (
//             <span style={{ marginLeft: "auto", color: "#666" }}>
//               Connecting...
//             </span>
//           )}
//         </div>

//         {activeSubTab === 0 && (
//           <InterceptListTable
//             data={rfData}
//             highlightIds={highlightIds}
//           />
//         )}

//         {activeSubTab === 1 && (
//           <div style={{ padding: "20px", color: "#999" }}>
//             Target List (unchanged)
//           </div>
//         )}
//         {activeSubTab === 2 && (
//           <div style={{ padding: "20px", color: "#999" }}>
//             Unidentified List (unchanged)
//           </div>
//         )}
//         {activeSubTab === 3 && (
//           <div style={{ padding: "20px", color: "#999" }}>
//             Compass DF (unchanged)
//           </div>
//         )}
//       </div>
//     </Card>
//   );
// }


import React, { useEffect, useState } from "react";
import Card from "../../components/ui/Card";

type RFDataType = {
  id: number;
  freq: number;
  power: number;
  snr: number;
  lat?: number;
  lon?: number;
  DOA: number;
  status?: string;
  timestamp?: string;
};

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
          {data.length > 0 ? (
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

                  {/* STATUS */}
                  <td
                    style={{
                      ...tdStyle,
                      color:
                        row.status === "NEW"
                          ? "lime"
                          : row.status === "UPDATE"
                          ? "orange"
                          : row.status === "HOLD"
                          ? "yellow"
                          : "red",
                    }}
                  >
                    {row.status}
                  </td>

                  {/* TIME */}
                  <td style={tdStyle}>
                    {row.timestamp
                      ? new Date(row.timestamp).toLocaleTimeString()
                      : "-"}
                  </td>

                  <td style={tdStyle}>{row.freq}</td>
                  <td style={tdStyle}>-</td>
                  <td style={tdStyle}>-</td>
                  <td style={tdStyle}>{row.power}</td>
                  <td style={tdStyle}>{row.snr}</td>
                  <td style={tdStyle}>
                    {row.DOA !== undefined
                      ? row.DOA.toFixed(2)
                      : "-"}
                  </td>
                  <td style={tdStyle}>-</td>
                  <td style={tdStyle}>-</td>
                  <td style={tdStyle}>-</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={12} style={{ padding: 10, textAlign: "center" }}>
                No Detection Data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function CESMTableTabs() {
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [rfData, setRfData] = useState<RFDataType[]>([]);
  const [highlightIds, setHighlightIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const subTabs = [
    "INTERCEPT LIST",
    "TARGET LIST",
    "UNIDENTIFIED LIST",
    "COMPASS DF",
  ];

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws/rf");

    ws.onopen = () => {
      console.log("✅ WebSocket Connected");
      setLoading(false);
    };

    ws.onmessage = (event) => {
      try {
        // 🔥 NDJSON support
        const lines = event.data.split("\n").filter(Boolean);
        const parsedData = lines.map((line: string) =>
          JSON.parse(line)
        );

        const converted: RFDataType[] = parsedData.map((det: any): RFDataType => ({
          id: det.id,
          freq: det.freq || 0,
          power: det.power || 0,
          snr: det.snr || 0,
          lat: det.lat,
          lon: det.lon,
          DOA: det.doa || 0,
          status: det.status,
          timestamp: det.timestamp,
        }));

        setRfData((prev) => {
          let updated = [...prev];

          converted.forEach((item: RFDataType) => {
            const index = updated.findIndex(
              (d) => d.id === item.id
            );

            if (item.status === "OBSOLETE") {
              updated = updated.filter((d) => d.id !== item.id);
            } else if (index !== -1) {
              updated[index] = item;
            } else {
              updated.unshift(item);
            }
          });

          updated = updated.slice(0, 50);

          const newIds = converted
            .filter((d: RFDataType) => d.status === "NEW")
            .map((d: RFDataType) => d.id);

          setHighlightIds(newIds);

          setTimeout(() => {
            setHighlightIds([]);
          }, 2000);

          return updated;
        });
      } catch (err) {
        console.error("❌ WebSocket parse error:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("❌ WebSocket error:", err);
    };

    ws.onclose = () => {
      console.log("🔌 WebSocket disconnected");
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <Card>
      <div style={{ marginTop: 16 }}>
        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 16,
            alignItems: "center",
          }}
        >
          {subTabs.map((tab, idx) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(idx)}
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                border: "none",
                background:
                  activeSubTab === idx ? "#1976d2" : "#e0e0e0",
                color: activeSubTab === idx ? "#fff" : "#333",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {tab}
            </button>
          ))}
          {loading && (
            <span style={{ marginLeft: "auto", color: "#666" }}>
              Connecting...
            </span>
          )}
        </div>

        {activeSubTab === 0 && (
          <InterceptListTable
            data={rfData}
            highlightIds={highlightIds}
          />
        )}

        {activeSubTab === 1 && (
          <div style={{ padding: "20px", color: "#999" }}>
            Target List (unchanged)
          </div>
        )}
        {activeSubTab === 2 && (
          <div style={{ padding: "20px", color: "#999" }}>
            Unidentified List (unchanged)
          </div>
        )}
        {activeSubTab === 3 && (
          <div style={{ padding: "20px", color: "#999" }}>
            Compass DF (unchanged)
          </div>
        )}
      </div>
    </Card>
  );
}