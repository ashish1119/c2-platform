import React, { useState, useMemo, useEffect, useRef } from "react";
//import AppLayout from "../../components/layout/AppLayout";
//import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";

function InterceptListTable() {
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
}


function TargetListTable() {
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
      <tbody> 
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
        <tr>
          <td colSpan={20} style={{ padding: 10, textAlign: "center" }}>
            Dummy Target Data
          </td>
        </tr>
      </tbody>
    </table>
  );
}


function UnidentifiedListTable() {
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
}

function CompassDF() {
  return (
    <div style={{ display: "flex", color: "#fff", padding: 20 }}>

      {/* LEFT SIDE */}
      <div style={{ flex: 1 }}>

        {/* ROW 1 */}
        <div style={{ display: "flex", gap: 40, marginBottom: 20 }}>
          <div>
            <div>ID</div>
            <div style={{ borderBottom: "2px solid #fff", width: 100 }}></div>
            <div>N/A</div>
          </div>

          <div>
            <div>Frequency</div>
            <div style={{ borderBottom: "2px solid #fff", width: 120 }}></div>
            <div>N/A</div>
          </div>
        </div>

        {/* ROW 2 */}
        <div style={{ display: "flex", gap: 40, marginBottom: 20 }}>
          <div>
            <div>DOA</div>
            <div style={{ borderBottom: "2px solid #fff", width: 100 }}></div>
            <div>N/A</div>
          </div>

          <div>
            <div>DOA Average</div>
            <div style={{ borderBottom: "2px solid #fff", width: 120 }}></div>
            <div>N/A</div>
          </div>
        </div>

        {/* ROW 3 */}
        <div style={{ display: "flex", gap: 40 }}>
          <div>
            <div>Quality</div>
            <div style={{ borderBottom: "2px solid #fff", width: 100 }}></div>
            <div>N/A</div>
          </div>

          <div>
            <div>Power</div>
            <div style={{ borderBottom: "2px solid #fff", width: 120 }}></div>
            <div>N/A</div>
          </div>
        </div>

      </div>

      {/* RIGHT SIDE COMPASS */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
        
        <div
          style={{
            width: 300,
            height: 300,
            borderRadius: "50%",
            border: "2px solid #fff",
            position: "relative"
          }}
        >

          {/* TICKS (major + minor) */}
          {Array.from({ length: 72 }).map((_, i) => {
            const angle = i * 5; // every 5°
            const isMajor = angle % 30 === 0;

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: isMajor ? 2 : 1,
                  height: isMajor ? 20 : 10,
                  background: "white",
                  top: "50%",
                  left: "50%",
                  transformOrigin: "bottom center",
                  transform: `rotate(${angle}deg) translate(-50%, -140px)`,
                  opacity: isMajor ? 0.8 : 0.3
                }}
              />
            );
          })}

          {/* DEGREE LABELS (OUTSIDE) */}
          {[
            "000","030","060","090","120","150",
            "180","210","240","270","300","330"
          ].map((deg, i) => {
            const angle = i * 30 * (Math.PI / 180);
            const radius = 170; // OUTSIDE radius

            const x = 150 + radius * Math.sin(angle);
            const y = 150 - radius * Math.cos(angle);

            return (
              <div
                key={deg}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  transform: "translate(-50%, -50%)",
                  fontSize: 12,
                  fontWeight: "bold"
                }}
              >
                {deg}
              </div>
            );
          })}

        </div>

      </div>
    </div>
  );
}

export default function CESMTableTabs() {
  const [activeSubTab, setActiveSubTab] = useState(0);
  const subTabs = ["INTERCEPT LIST", "TARGET LIST", "UNIDENTIFIED LIST", "COMPASS DF"];

  return (
    <Card>
      <div style={{ marginTop: 16 }}>
                        
      {/* Sub-tabs */}
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

      {/* <InterceptTable /> */}
      {activeSubTab === 0 && <InterceptListTable />}

      {activeSubTab === 1 && <TargetListTable />}

      {activeSubTab === 2 && <UnidentifiedListTable />}

      {/*{activeSubTab === 3 && (
        <div style={{ padding: 20 }}>COMPASS DF (Dummy Table)</div>
      )}*/}
      {activeSubTab === 3 && <CompassDF />}
      </div>
    </Card>
  );
}