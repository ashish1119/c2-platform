import React, { useState, useMemo, useEffect, useRef } from "react";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";

import CESMSpectrum from "../../components/esm/CESMSpectrum";
import CESMWaterfall from "../../components/esm/CESMWaterfall";
import CESMTableTabs from "../../components/esm/CESMTableTabs";

// If you use Recharts, install it: npm install recharts
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const tabs = [
  "C-ESM MAIN",
  "C-ESM ZOOM",
  "POLAR DF",
  "RECORDINGS",
  "TARGET DATABASE",
  "SYS EVENTS",
  "C-UAS",
];

const internalMenuItems = [
  { name : "Streaming Server"},
  { name : "Frequency Settings", subItems: ["Frequency_Plan"]},
  { name : "Detection Settings", subItems: ["Detection_Plan"]},
  { name : "Target Settings"},
  { name : "Recorder"},
  { name : "Direction Finding"},
  {name: "Signal Analysis"},
  {name: "Intercept Control"},
  {name: "System Status"},
];


{/* const TargetData = [
  { id: 1, frequency: "450.5 MHz", bearing: "120°", rssi: "-80 dBm", snr: "15 dB", duration: "5s", actions: "Play | Details" },
  { id: 2, frequency: "136.0 MHz", bearing: "90°", rssi: "-75 dBm", snr: "18 dB", duration: "10s", actions: "Play | Details" },
  // Add more mock data as needed
]; */}


const sysEventsData = [
  { timestamp: "2026-03-13T05:42:54Z", sourceNode: "R5506", level: "ERROR", message: "Receiver CRITICAL event" },
  { timestamp: "2026-03-13T05:42:53Z", sourceNode: "R5506", level: "ERROR", message: "Unable to connect to one (or more) receiver" },
  { timestamp: "2026-03-13T05:42:42Z", sourceNode: "R5506", level: "ERROR", message: "Receiver CRITICAL event" },
  { timestamp: "2026-03-13T05:42:32Z", sourceNode: "R5506", level: "ERROR", message: "Unable to connect to one (or more) receiver" },
  { timestamp: "2026-03-13T05:42:22Z", sourceNode: "R5506", level: "ERROR", message: "Receiver CRITICAL event" },
];


{/*function InterceptListTable() {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", color: "#ffffff" }}>
      <thead>
        <tr style={{ background: "#192a3f" }}>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Id</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Status</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>First Seen</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Carrier</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>BW</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Duration</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Power</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>SNR</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>DOA</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>DOA Avg</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>DOA Std.</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Peak</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td colSpan={11} style={{ padding: 10, textAlign: "center" }}>
            Dummy Intercept Data
          </td>
        </tr>
      </tbody>
    </table>
  );
}*/}


{/*function TargetListTable() {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", color: "#ffffff" }}>
      <thead>
        <tr style={{ background: "#192a3f" }}>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>ID</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Name</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Status</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>First Seen</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Carrier</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>BW</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Duration</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Power</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>SNR</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>RF Type</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>DOA</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>DOA Avg</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>DOA Std.</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Peak</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Dynamics</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Distance</th>
        </tr>
      </thead>
      <tbody>*/}
        {/* {TargetData.map((row, idx) => (
          <tr key={row.id} style={{ background: idx % 2 === 0 ? "#122033" : "#0f1a2a" }}>
            <td style={{ padding: 8, border: "1px solid #32475a" }}>{row.frequency}</td>
            <td style={{ padding: 8, border: "1px solid #32475a" }}>{row.bearing}</td>
            <td style={{ padding: 8, border: "1px solid #32475a" }}>{row.rssi}</td>
            <td style={{ padding: 8, border: "1px solid #32475a" }}>{row.snr}</td>
            <td style={{ padding: 8, border: "1px solid #32475a" }}>{row.duration}</td>
            <td style={{ padding: 8, border: "1px solid #32475a" }}>
              <button style={{ marginRight: 4 }}>Play</button>
              <button>Details</button> 
            </td>
          </tr>
        ))} */}
        {/*<tr>
          <td colSpan={20} style={{ padding: 10, textAlign: "center" }}>
            Dummy Target Data
          </td>
        </tr>
      </tbody>
    </table>
  );
}*/}



{/*function UnidentifiedListTable() {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", color: "#ffffff" }}>
      <thead>
        <tr style={{ background: "#192a3f" }}>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Id</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Status</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>First Seen</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Carrier</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>BW</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Duration</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Power</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>SNR</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>DOA</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>DOA Avg</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>DOA Std.</th>
          <th style={{ padding: 8, border: "1px solid #32475a" }}>Peak</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td colSpan={11} style={{ padding: 10, textAlign: "center" }}>
            Dummy Unidentified Data
          </td>
        </tr>
      </tbody>
    </table>
  );
}*/}



export default function OperatorSMSPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeMenu, setActiveMenu] = useState(0);

  const [expandedMenus, setExpandedMenus] = useState<Set<number>>(new Set());

  {/*const [activeSubTab, setActiveSubTab] = useState(0);
  const subTabs = ["INTERCEPT LIST", "TARGET LIST", "UNIDENTIFIED LIST", "COMPASS DF"];

  const spectrumData = useMemo(() => Array.from({ length: 100 }, (_, i) => ({
    freq: 400 + i * 1,
    level: Math.random() * 20 - 120 + (i === 50 ? 30 : 0),
   })),[]);
   
  const waterfallData = useMemo(() => Array.from({ length: 40 }, (_, t) =>
    Array.from({ length: 100 }, (_, f) => ({
        freq: 400 + f * 1,
        time: t,
        intensity: Math.random() * 100 + (f === 50 ? 200 : 0),
    }))
   ),[]); */}

  return (
    <AppLayout>
      <PageContainer title="Operator SMS">
        <div style={{ display: "flex", minHeight: "calc(100vh - 200px)" }}>
        <div style={{ padding: 24, flex: 1, display: "flex" }}>
          {/* Internal Sidebar */}
          {/* <div style={{ width: "200px", background: "#f5f5f5", padding: 16, borderRight: "1px solid #ddd" }}> */}
          <div style={{ width: "200px", background: "#1e293b", padding: 16, borderRight: "1px solid #334155" }}>

            <h3 style={{ marginBottom: 16 }}>ESM Menu</h3>
            {internalMenuItems.map((item, idx) => (
                <div key={item.name}>
                    <button
                    onClick={() => {
                        if (item.subItems && item.subItems.length > 0) {
                        // Toggle expand/collapse for items with subItems
                        setExpandedMenus((prev) => {
                            const next = new Set(prev);
                            if (next.has(idx)) next.delete(idx);
                            else next.add(idx);
                            return next;
                        });
                    } else {
                        // Regular items just get selected
                        setActiveMenu(idx);
                    }
                }}
                style={{
                    display: "block",
                    width: "100%",
                    padding: 8,
                    marginBottom: 4,
                    border: "none",
                    background: activeMenu === idx ? "#1976d2" : "#e0e0e0",
                    color: activeMenu === idx ? "#fff" : "#333",
                    textAlign: "left",
                    cursor: "pointer",
                }}
            >
                {(item.subItems?.length ?? 0) > 0 && (expandedMenus.has(idx) ? "−" : "+")} {item.name}
            </button>
            {item.subItems && expandedMenus.has(idx) && (
                <div style={{ paddingLeft: 20 }}>
                    {item.subItems.map((subItem) => (
                        <button
                            key={subItem}
                            onClick={() => setActiveMenu(idx)} // Or handle subItem selection
                            style={{
                                display: "block",
                                width: "100%",
                                padding: 6,
                                marginBottom: 2,
                                border: "none",
                                background: "#f0f0f0",
                                color: "#555",
                                fontSize: 12,
                                textAlign: "left",
                                cursor: "pointer",
                            }}
                        >
                            {subItem}
                        </button>
                    ))}
                </div>
            )}
        </div>
    ))}
          </div>
          {/* Main Content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {tabs.map((tab, idx) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(idx)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 4,
                    border: "none",
                    background: activeTab === idx ? "#1976d2" : "#e0e0e0",
                    color: activeTab === idx ? "#fff" : "#333",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Main Tab Content (C-ESM Main) */}
            {activeTab === 0 && (
              <>
                {/*<Card>
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={spectrumData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="freq" tick={{ fill: "#ffffff" }} tickLine={{ stroke: "rgba(255,255,255,0.3)" }} axisLine={{ stroke: "rgba(255,255,255,0.5)" }} label={{ value: "Freq [MHz]", position: "insideBottomRight", offset: -6, fill: "#ffffff" }} />
                        <YAxis domain={[-140, 0]} tick={{ fill: "#ffffff" }} tickLine={{ stroke: "rgba(255,255,255,0.3)" }} axisLine={{ stroke: "rgba(255,255,255,0.5)" }} label={{ value: "Level [dBm]", angle: -90, position: "insideLeft", fill: "#ffffff" }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="level" stroke="#00eaff" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card> 

                <Card>
                  <div style={{ height: 220, position: "relative" }}>
                    <canvas
                      width={800}
                      height={220}
                      style={{ width: "100%", height: "100%", background: "#001024" }}
                      ref={el => {
                        if (el) {
                          const ctx = el.getContext("2d");
                          if (ctx) {
                            for (let t = 0; t < waterfallData.length; t++) {
                              for (let f = 0; f < waterfallData[t].length; f++) {
                                const intensity = waterfallData[t][f].intensity;
                                const brightness = Math.round(Math.min(255, Math.max(10, (intensity / 300) * 255)));
                                ctx.fillStyle = `rgb(${Math.floor(brightness / 3)},${Math.floor(brightness / 1.5)},${brightness})`;
                                ctx.fillRect((f / waterfallData[t].length) * el.width, (t / waterfallData.length) * el.height, el.width / waterfallData[t].length, el.height / waterfallData.length);
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </Card>

                <Card>
                  <div style={{ marginTop: 16 }}>*/}
                    
                    {/* Sub-tabs */}
                    {/*<div style={{ display: "flex", gap: 8, marginTop: 16 }}>
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
                    </div>*/}

                    {/* <InterceptTable /> */}
                    {/*{activeSubTab === 0 && <InterceptListTable />}

                    {activeSubTab === 1 && <TargetListTable />}

                    {activeSubTab === 2 && <UnidentifiedListTable />}

                    {activeSubTab === 3 && (
                      <div style={{ padding: 20 }}>COMPASS DF (Dummy Table)</div>
                    )}
                  </div>
                </Card>*/}
                <CESMSpectrum />
                <CESMWaterfall />
                <CESMTableTabs />
              </>
            )}

            {activeTab === 2 && (
              <>
                <Card>
                  <div style={{ alignItems: "center", justifyContent: "center", display: "flex", minHeight: 360, color: "#999" }}>
                    <strong>{tabs[activeTab]}</strong> content placeholder (to be backed by real API data in the next step).
                  </div>
                </Card>
                <CESMTableTabs />
              </>
            )}

            {/* SYS EVENTS Tab */}
            {activeTab === 5 && (
              <Card>
                <div style={{ overflowX: "auto", minHeight: 360 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", color: "#ffffff" }}>
                    <thead>
                      <tr style={{ background: "#192a3f" }}>
                        <th style={{ padding: 10, border: "1px solid #32475a" }}>Timestamp</th>
                        <th style={{ padding: 10, border: "1px solid #32475a" }}>Source Node Name</th>
                        <th style={{ padding: 10, border: "1px solid #32475a" }}>Level</th>
                        <th style={{ padding: 10, border: "1px solid #32475a" }}>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sysEventsData.map((row, idx) => (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? "#122033" : "#0f1a2a" }}>
                          <td style={{ padding: 8, border: "1px solid #32475a" }}>{row.timestamp}</td>
                          <td style={{ padding: 8, border: "1px solid #32475a" }}>{row.sourceNode}</td>
                          <td style={{ padding: 8, border: "1px solid #32475a" }}>{row.level}</td>
                          <td style={{ padding: 8, border: "1px solid #32475a" }}>{row.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {activeTab !== 0 && activeTab !== 2 && activeTab !== 5 && (
              <Card>
                <div style={{ alignItems: "center", justifyContent: "center", display: "flex", minHeight: 360, color: "#999" }}>
                  <strong>{tabs[activeTab]}</strong> content placeholder (to be backed by real API data in the next step).
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
      </PageContainer>
    </AppLayout>
  );
}
