import React, { useState } from "react";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import CESMSpectrum from "../../components/esm/CESMSpectrum";
import CESMWaterfall from "../../components/esm/CESMWaterfall";
import CESMTableTabs from "../../components/esm/CESMTableTabs";

const TABS = ["C-ESM MAIN","C-ESM ZOOM","POLAR DF","RECORDINGS","TARGET DATABASE","SYS EVENTS","C-UAS"];

const MENU_ITEMS = [
  { name: "Streaming Server" },
  { name: "Frequency Settings", sub: ["Frequency_Plan"] },
  { name: "Detection Settings", sub: ["Detection_Plan"] },
  { name: "Target Settings" },
  { name: "Recorder" },
  { name: "Direction Finding" },
  { name: "Signal Analysis" },
  { name: "Intercept Control" },
  { name: "System Status" },
];

const SYS_EVENTS = [
  { ts: "2026-03-13T05:42:54Z", node: "R5506", level: "ERROR", msg: "Receiver CRITICAL event" },
  { ts: "2026-03-13T05:42:53Z", node: "R5506", level: "ERROR", msg: "Unable to connect to one (or more) receiver" },
  { ts: "2026-03-13T05:42:42Z", node: "R5506", level: "ERROR", msg: "Receiver CRITICAL event" },
  { ts: "2026-03-13T05:42:32Z", node: "R5506", level: "ERROR", msg: "Unable to connect to one (or more) receiver" },
  { ts: "2026-03-13T05:42:22Z", node: "R5506", level: "ERROR", msg: "Receiver CRITICAL event" },
];

const BG = "#020617";
const PANEL = "#0B1220";
const CYAN = "#00E5FF";
const BORDER = "rgba(0,229,255,0.15)";
const BDIM = "rgba(0,229,255,0.08)";

function Placeholder({ label }: { label: string }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:360, gap:12, background:`linear-gradient(180deg,${BG} 0%,${PANEL} 100%)`, border:`1px solid ${BORDER}`, borderRadius:10 }}>
      <div style={{ width:40, height:40, borderRadius:"50%", border:`1px solid ${BORDER}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:"#334155" }} />
      </div>
      <div style={{ fontSize:12, fontWeight:700, fontFamily:"monospace", color:"#334155", letterSpacing:"1px" }}>{label}</div>
      <div style={{ fontSize:10, fontFamily:"monospace", color:"#1e293b" }}>AWAITING DATA</div>
    </div>
  );
}

function SysEvents() {
  return (
    <div style={{ background:`linear-gradient(180deg,${BG} 0%,${PANEL} 100%)`, border:`1px solid ${BORDER}`, borderRadius:10, overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px", borderBottom:`1px solid ${BDIM}`, background:"rgba(0,229,255,0.04)" }}>
        <div style={{ width:6, height:6, borderRadius:"50%", background:"#ef4444", boxShadow:"0 0 6px #ef4444" }} />
        <span style={{ fontSize:11, fontWeight:700, color:CYAN, letterSpacing:"1.5px", fontFamily:"monospace" }}>SYSTEM EVENTS LOG</span>
        <span style={{ marginLeft:"auto", fontSize:10, fontFamily:"monospace", color:"#ef4444" }}>{SYS_EVENTS.length} ERRORS</span>
      </div>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead>
          <tr>
            {["TIMESTAMP","SOURCE NODE","LEVEL","MESSAGE"].map(h => (
              <th key={h} style={{ padding:"8px 12px", textAlign:"left", borderBottom:`1px solid ${BDIM}`, background:"rgba(0,229,255,0.04)", color:CYAN, fontSize:10, fontWeight:700, fontFamily:"monospace", letterSpacing:"0.8px" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SYS_EVENTS.map((r, i) => (
            <tr key={i} style={{ background: i%2===0 ? "rgba(2,6,23,0.6)" : "rgba(11,18,32,0.6)" }}>
              <td style={{ padding:"8px 12px", borderBottom:`1px solid ${BDIM}`, fontSize:11, fontFamily:"monospace", color:"#475569" }}>{r.ts}</td>
              <td style={{ padding:"8px 12px", borderBottom:`1px solid ${BDIM}`, fontSize:11, fontFamily:"monospace", color:"#94a3b8" }}>{r.node}</td>
              <td style={{ padding:"8px 12px", borderBottom:`1px solid ${BDIM}` }}>
                <span style={{ fontSize:10, fontWeight:700, fontFamily:"monospace", color:"#ef4444", background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)", padding:"2px 7px", borderRadius:3 }}>{r.level}</span>
              </td>
              <td style={{ padding:"8px 12px", borderBottom:`1px solid ${BDIM}`, fontSize:11, fontFamily:"monospace", color:"#64748b" }}>{r.msg}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OperatorSMSPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeMenu, setActiveMenu] = useState(0);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [hovered, setHovered] = useState<number | null>(null);

  const toggle = (i: number) => setExpanded(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <AppLayout>
      <PageContainer title="Operator SMS">
        <div style={{ display:"flex", minHeight:"calc(100vh - 120px)", background:BG, borderRadius:12, border:`1px solid ${BORDER}`, overflow:"hidden", boxShadow:"0 0 40px rgba(0,229,255,0.04)" }}>

          {/* LEFT PANEL */}
          <div style={{ width:200, flexShrink:0, background:"linear-gradient(180deg,#060e1f 0%,#0B1220 100%)", borderRight:`1px solid ${BORDER}`, display:"flex", flexDirection:"column" }}>
            <div style={{ padding:"12px 14px 10px", borderBottom:`1px solid ${BDIM}`, background:"rgba(0,229,255,0.04)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background:CYAN, boxShadow:`0 0 5px ${CYAN}` }} />
                <span style={{ fontSize:10, fontWeight:800, color:CYAN, letterSpacing:"1.5px", fontFamily:"monospace" }}>ESM MENU</span>
              </div>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"8px" }}>
              {MENU_ITEMS.map((item, idx) => {
                const active = activeMenu === idx;
                const hover = hovered === idx;
                const hasSub = (item.sub?.length ?? 0) > 0;
                const open = expanded.has(idx);
                return (
                  <div key={item.name} style={{ marginBottom:2 }}>
                    <button
                      onClick={() => hasSub ? toggle(idx) : setActiveMenu(idx)}
                      onMouseEnter={() => setHovered(idx)}
                      onMouseLeave={() => setHovered(null)}
                      style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", padding:"7px 10px", borderRadius:6, border: active ? "1px solid rgba(0,229,255,0.4)" : "1px solid transparent", background: active ? "rgba(0,229,255,0.1)" : hover ? "rgba(0,229,255,0.05)" : "transparent", color: active ? CYAN : hover ? "#94a3b8" : "#475569", fontSize:11, fontWeight: active ? 700 : 500, fontFamily:"monospace", cursor:"pointer", textAlign:"left", transition:"all 0.18s ease", boxShadow: active ? "0 0 8px rgba(0,229,255,0.12)" : "none" }}
                    >
                      <span>{item.name}</span>
                      {hasSub && <span style={{ fontSize:9, opacity:0.6, display:"inline-block", transition:"transform 0.2s", transform: open ? "rotate(90deg)" : "none" }}>{">"}</span>}
                    </button>
                    {hasSub && open && (
                      <div style={{ paddingLeft:12, paddingTop:2 }}>
                        {item.sub!.map(s => (
                          <button key={s} onClick={() => setActiveMenu(idx)} style={{ display:"block", width:"100%", padding:"5px 10px", marginBottom:1, borderRadius:4, border:"1px solid transparent", background:"transparent", color:"#334155", fontSize:10, fontFamily:"monospace", textAlign:"left", cursor:"pointer" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#334155"; }}
                          >{">"} {s}</button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ padding:"10px 14px", borderTop:`1px solid ${BDIM}`, background:"rgba(0,229,255,0.02)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background:"#22c55e", boxShadow:"0 0 4px #22c55e" }} />
                <span style={{ fontSize:9, fontFamily:"monospace", color:"#22c55e", letterSpacing:"0.5px" }}>SYSTEM ONLINE</span>
              </div>
              <div style={{ fontSize:9, fontFamily:"monospace", color:"#1e293b" }}>NODE: R5506 v2.4.1</div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"stretch", borderBottom:`1px solid ${BORDER}`, background:"rgba(0,229,255,0.02)", overflowX:"auto", flexShrink:0 }}>
              {TABS.map((tab, idx) => {
                const active = activeTab === idx;
                return (
                  <button key={tab} onClick={() => setActiveTab(idx)}
                    style={{ padding:"10px 18px", fontSize:10, fontWeight:700, fontFamily:"monospace", letterSpacing:"0.8px", cursor:"pointer", border:"none", borderBottom: active ? `2px solid ${CYAN}` : "2px solid transparent", background: active ? "rgba(0,229,255,0.08)" : "transparent", color: active ? CYAN : "#334155", transition:"all 0.2s ease", whiteSpace:"nowrap", flexShrink:0, position:"relative" }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#334155"; }}
                  >
                    {tab}
                    {active && <div style={{ position:"absolute", bottom:0, left:"20%", right:"20%", height:2, background:`linear-gradient(90deg,transparent,${CYAN},transparent)`, boxShadow:`0 0 6px ${CYAN}` }} />}
                  </button>
                );
              })}
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:16, display:"flex", flexDirection:"column", gap:12 }}>
              {activeTab === 0 && (<><CESMSpectrum /><CESMWaterfall /><CESMTableTabs /></>)}
              {activeTab === 2 && (<><Placeholder label={TABS[activeTab]} /><CESMTableTabs /></>)}
              {activeTab === 5 && <SysEvents />}
              {activeTab !== 0 && activeTab !== 2 && activeTab !== 5 && <Placeholder label={TABS[activeTab]} />}
            </div>
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  );
}