/**
 * LiveIngestPanel — Real-time CDR ingestion + live map visualization
 * Sections: Live Map | Event Feed | Alerts | Stats | Timeline Playback
 */
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "../../../context/ThemeContext";
import type { TelecomRecord } from "../model";
import { useLiveCdrStream } from "../state/useLiveCdrStream";
import type { LiveCdrEvent } from "../../../api/cdr";
import {
  Wifi, WifiOff, Play, Square, Trash2, Bell, Activity,
  Map as MapIcon, List, AlertTriangle, BarChart2,
} from "lucide-react";

// ── Leaflet icon fix ──────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDur(sec: number): string {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function makeCallerDot(isFake: boolean, network: string) {
  const color = isFake ? "#ef4444" : network === "5G" ? "#a855f7" : network === "4G" ? "#22c55e" : "#3b82f6";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="9" fill="${color}" stroke="white" stroke-width="2"/>
    ${isFake ? `<text x="10" y="14" text-anchor="middle" font-size="9" fill="white">!</text>` : ""}
  </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -10] });
}

function makeReceiverDot() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">
    <circle cx="7" cy="7" r="6" fill="#ef4444" stroke="white" stroke-width="1.5"/>
  </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [14, 14], iconAnchor: [7, 7], popupAnchor: [0, -7] });
}

// ── CSS animation ─────────────────────────────────────────────────────────────
let _injected = false;
function injectAnim() {
  if (_injected || typeof document === "undefined") return;
  _injected = true;
  const s = document.createElement("style");
  s.textContent = `
    @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }
    @keyframes liveDash { to { stroke-dashoffset: -20; } }
    .live-line { animation: liveDash 1s linear infinite; }
    @keyframes liveFade { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
    .live-entry { animation: liveFade 0.3s ease; }
  `;
  document.head.appendChild(s);
}

// ── Live map auto-fit ─────────────────────────────────────────────────────────
function LiveMapFit({ events }: { events: LiveCdrEvent[] }) {
  const map = useMap();
  const lastLen = useRef(0);
  useEffect(() => {
    if (events.length === 0 || events.length === lastLen.current) return;
    lastLen.current = events.length;
    const latest = events[0];
    if (latest?.caller.lat && latest?.caller.lng) {
      map.setView([latest.caller.lat, latest.caller.lng], map.getZoom(), { animate: true });
    }
  }, [events, map]);
  return null;
}

// ── Live connection lines ─────────────────────────────────────────────────────
function LiveConnectionLines({ events, showLines }: { events: LiveCdrEvent[]; showLines: boolean }) {
  const map = useMap();
  const groupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    injectAnim();
    if (groupRef.current) map.removeLayer(groupRef.current);
    if (!showLines || events.length === 0) return;

    const group = L.layerGroup().addTo(map);
    groupRef.current = group;

    // Only draw last 30 connections to keep map clean
    events.slice(0, 30).forEach((ev, i) => {
      if (!ev.caller.lat || !ev.receiver.lat) return;
      const age = i / 30;
      const opacity = Math.max(0.15, 1 - age * 0.85);
      const color = ev.alerts.is_fake ? "#ef4444" : ev.alerts.silent_call_type !== "None" ? "#f59e0b" : "#3b82f6";
      const line = L.polyline(
        [[ev.caller.lat, ev.caller.lng], [ev.receiver.lat, ev.receiver.lng]],
        { color, weight: i === 0 ? 2.5 : 1.5, opacity, dashArray: "6 4" }
      );
      if (i === 0) {
        line.on("add", () => {
          const el = (line as any)._path as SVGPathElement | undefined;
          if (el) el.classList.add("live-line");
        });
      }
      line.addTo(group);
    });

    return () => { map.removeLayer(group); };
  }, [events, showLines, map]);

  return null;
}

// ── Heatmap overlay ───────────────────────────────────────────────────────────
function HeatmapLayer({ cells, show }: { cells: { lat: number; lng: number; weight: number }[]; show: boolean }) {
  if (!show || cells.length === 0) return null;
  const maxW = Math.max(1, ...cells.map((c) => c.weight));
  return (
    <>
      {cells.map((c) => {
        const opacity = 0.06 + 0.35 * (c.weight / maxW);
        const hue = Math.round(240 - 240 * (c.weight / maxW));
        return (
          <Circle key={`h-${c.lat}-${c.lng}`} center={[c.lat, c.lng]} radius={700}
            pathOptions={{ color: "transparent", fillColor: `hsl(${hue},90%,55%)`, fillOpacity: opacity, weight: 0 }}
          />
        );
      })}
    </>
  );
}

// ── Sub-panels ────────────────────────────────────────────────────────────────

function LiveMap({ events, heatCells, showLines, showHeat, isDark }: {
  events: LiveCdrEvent[];
  heatCells: { lat: number; lng: number; weight: number }[];
  showLines: boolean;
  showHeat: boolean;
  isDark: boolean;
}) {
  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  // Deduplicate callers by MSISDN (show latest position)
  const callerMap = useMemo(() => {
    const m = new Map<string, LiveCdrEvent>();
    [...events].reverse().forEach((e) => m.set(e.caller.msisdn, e));
    return [...m.values()];
  }, [events]);

  return (
    <div style={{ width: "100%", height: 420, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(17,193,202,0.3)" }}>
      <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ width: "100%", height: "100%" }} zoomControl>
        <TileLayer url={tileUrl} attribution="" />
        <LiveMapFit events={events} />
        <LiveConnectionLines events={events} showLines={showLines} />
        <HeatmapLayer cells={heatCells} show={showHeat} />

        {/* Caller markers */}
        {callerMap.map((ev) => (
          <Marker key={`c-${ev.caller.msisdn}`} position={[ev.caller.lat, ev.caller.lng]}
            icon={makeCallerDot(ev.alerts.is_fake, ev.caller.network ?? "")}>
            <Popup>
              <div style={{ fontSize: 12, lineHeight: 1.8, minWidth: 180 }}>
                <b style={{ color: "#3b82f6" }}>📞 {ev.caller.msisdn}</b><br />
                {ev.caller.operator} · {ev.caller.network}<br />
                {ev.caller.place && <>{ev.caller.place}<br /></>}
                {ev.alerts.is_fake && <b style={{ color: "#ef4444" }}>⚠ FAKE SIGNAL</b>}
                {ev.alerts.silent_call_type !== "None" && <b style={{ color: "#f59e0b" }}> 👁 {ev.alerts.silent_call_type}</b>}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Receiver markers (latest 50) */}
        {events.slice(0, 50).map((ev) => (
          ev.receiver.lat && ev.receiver.lng ? (
            <Marker key={`r-${ev.id}`} position={[ev.receiver.lat, ev.receiver.lng]} icon={makeReceiverDot()}>
              <Popup>
                <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                  <b style={{ color: "#ef4444" }}>📱 {ev.receiver.msisdn || "Unknown"}</b><br />
                  From: {ev.caller.msisdn}<br />
                  {ev.call.call_type} · {fmtDur(ev.call.duration_sec)}
                </div>
              </Popup>
            </Marker>
          ) : null
        ))}
      </MapContainer>
    </div>
  );
}

function EventFeed({ events, isDark }: { events: LiveCdrEvent[]; isDark: boolean }) {
  const border = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  return (
    <div style={{ overflowY: "auto", maxHeight: 380, display: "flex", flexDirection: "column", gap: 4 }}>
      {events.length === 0 && (
        <div style={{ textAlign: "center", color: "#64748b", fontSize: 12, padding: 24 }}>
          No live events yet. Start simulation or connect WebSocket.
        </div>
      )}
      {events.map((ev, i) => {
        const isThreat = ev.alerts.is_fake || ev.alerts.silent_call_type !== "None";
        return (
          <div key={ev.id} className="live-entry"
            style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "5px 8px", borderRadius: 6,
              background: isThreat ? (isDark ? "#1a0a0a" : "#fff5f5") : "transparent",
              border: `1px solid ${isThreat ? "#ef444433" : border}`,
              opacity: i > 20 ? Math.max(0.3, 1 - (i - 20) * 0.03) : 1 }}>
            <span style={{ fontSize: 10, color: "#64748b", minWidth: 60, paddingTop: 1 }}>
              {ev.ts ? new Date(ev.ts).toLocaleTimeString() : "—"}
            </span>
            <div style={{ flex: 1, fontSize: 11 }}>
              <span style={{ fontWeight: 700, color: "#3b82f6" }}>{ev.caller.msisdn}</span>
              <span style={{ color: "#64748b" }}> → </span>
              <span style={{ fontWeight: 600, color: "#ef4444" }}>{ev.receiver.msisdn || "—"}</span>
              <span style={{ color: "#64748b" }}> · {ev.call.call_type} · {fmtDur(ev.call.duration_sec)}</span>
              {ev.caller.network && <span style={{ color: "#a855f7", marginLeft: 6 }}>{ev.caller.network}</span>}
            </div>
            {ev.alerts.is_fake && <span style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", background: "#ef444418", padding: "1px 5px", borderRadius: 4 }}>FAKE</span>}
            {ev.alerts.silent_call_type !== "None" && <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", background: "#f59e0b18", padding: "1px 5px", borderRadius: 4 }}>{ev.alerts.silent_call_type}</span>}
          </div>
        );
      })}
    </div>
  );
}

function AlertsPanel({ alerts, onDismiss, isDark }: {
  alerts: ReturnType<typeof useLiveCdrStream>["alerts"];
  onDismiss: (id: string) => void;
  isDark: boolean;
}) {
  const sevColor = (s: string) => s === "critical" ? "#ef4444" : s === "high" ? "#f97316" : "#f59e0b";
  return (
    <div style={{ overflowY: "auto", maxHeight: 380, display: "flex", flexDirection: "column", gap: 5 }}>
      {alerts.length === 0 && <div style={{ textAlign: "center", color: "#64748b", fontSize: 12, padding: 24 }}>No active alerts</div>}
      {alerts.map((a) => (
        <div key={a.id} className="live-entry"
          style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${sevColor(a.severity)}44`, background: isDark ? "#1a0a0a" : "#fff5f5", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <AlertTriangle size={12} color={sevColor(a.severity)} />
              <span style={{ fontSize: 10, fontWeight: 700, color: sevColor(a.severity), textTransform: "uppercase" }}>{a.severity}</span>
              <span style={{ fontSize: 10, color: "#64748b" }}>{new Date(a.ts).toLocaleTimeString()}</span>
            </div>
            <div style={{ fontSize: 12 }}>{a.message}</div>
          </div>
          <button onClick={() => onDismiss(a.id)} style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, cursor: "pointer", border: "none", background: "transparent", color: "#64748b" }}>✕</button>
        </div>
      ))}
    </div>
  );
}

function StatsPanel({ stats, isDark }: { stats: ReturnType<typeof useLiveCdrStream>["stats"]; isDark: boolean }) {
  const items = [
    { label: "Total Events", value: stats.totalEvents, color: "#11C1CA" },
    { label: "Active Callers", value: stats.activeCallers, color: "#3b82f6" },
    { label: "Voice", value: stats.voiceCount, color: "#22c55e" },
    { label: "SMS", value: stats.smsCount, color: "#a855f7" },
    { label: "Data", value: stats.dataCount, color: "#06b6d4" },
    { label: "Fake Signals", value: stats.fakeCount, color: "#ef4444" },
    { label: "Silent Calls", value: stats.silentCount, color: "#f59e0b" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
        {items.map((it) => (
          <div key={it.label} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${it.color}33`, background: `${it.color}0d`, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: it.color }}>{it.value}</div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{it.label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#64748b", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span>Top caller: <b style={{ color: "#3b82f6" }}>{stats.topCaller}</b></span>
        <span>Top receiver: <b style={{ color: "#ef4444" }}>{stats.topReceiver}</b></span>
        <span>Last event: <b>{stats.lastEventTs !== "—" ? new Date(stats.lastEventTs).toLocaleTimeString() : "—"}</b></span>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

type LiveTab = "map" | "feed" | "alerts" | "stats";

const LIVE_TABS: { id: LiveTab; icon: React.ReactNode; label: string }[] = [
  { id: "map",    icon: <MapIcon size={12} />,    label: "Live Map" },
  { id: "feed",   icon: <List size={12} />,       label: "Event Feed" },
  { id: "alerts", icon: <Bell size={12} />,       label: "Alerts" },
  { id: "stats",  icon: <BarChart2 size={12} />,  label: "Stats" },
];

type Props = { records: TelecomRecord[] };

export default function LiveIngestPanel({ records }: Props) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";
  const stream = useLiveCdrStream();
  const [activeTab, setActiveTab] = useState<LiveTab>("map");
  const [showLines, setShowLines] = useState(true);
  const [showHeat, setShowHeat] = useState(false);
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Activity size={16} color="#11C1CA" />
            Live CDR Stream
            {stream.connected && (
              <span style={{ fontSize: 11, background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e55", borderRadius: 10, padding: "1px 8px", fontWeight: 700 }}>
                ● LIVE
              </span>
            )}
            {stream.alerts.length > 0 && (
              <span style={{ fontSize: 11, background: "#ef444422", color: "#ef4444", border: "1px solid #ef444455", borderRadius: 10, padding: "1px 8px", fontWeight: 700 }}>
                {stream.alerts.length} alerts
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>
            {stream.stats.totalEvents} events · {stream.stats.activeCallers} callers · real-time map updates
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {/* WS connect/disconnect */}
          <button
            onClick={stream.connected ? stream.disconnect : stream.connect}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: "pointer", border: "none",
              background: stream.connected ? "#ef444422" : "#22c55e22",
              color: stream.connected ? "#ef4444" : "#22c55e" }}>
            {stream.connected ? <><WifiOff size={12} /> Disconnect</> : <><Wifi size={12} /> Connect WS</>}
          </button>

          {/* Simulation */}
          <button
            onClick={stream.simulating ? stream.stopSimulation : () => stream.startSimulation(records)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: "pointer", border: "none",
              background: stream.simulating ? "#f59e0b22" : "rgba(17,193,202,0.15)",
              color: stream.simulating ? "#f59e0b" : "#11C1CA" }}>
            {stream.simulating ? <><Square size={12} /> Stop Sim</> : <><Play size={12} /> Simulate Live</>}
          </button>

          {/* Map toggles */}
          <button onClick={() => setShowLines((v) => !v)}
            style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: "pointer",
              background: showLines ? "rgba(59,130,246,0.15)" : "transparent",
              border: `1px solid ${showLines ? "#3b82f655" : border}`,
              color: showLines ? "#3b82f6" : theme.colors.textSecondary }}>
            Lines
          </button>
          <button onClick={() => setShowHeat((v) => !v)}
            style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: "pointer",
              background: showHeat ? "rgba(239,68,68,0.15)" : "transparent",
              border: `1px solid ${showHeat ? "#ef444455" : border}`,
              color: showHeat ? "#ef4444" : theme.colors.textSecondary }}>
            Heatmap
          </button>

          {/* Clear */}
          <button onClick={stream.clearEvents}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: "pointer",
              border: `1px solid ${border}`, background: "transparent", color: theme.colors.textSecondary }}>
            <Trash2 size={11} /> Clear
          </button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: "flex", background: theme.colors.surfaceAlt, border: `1px solid ${border}`, borderRadius: 8, overflow: "hidden" }}>
        {LIVE_TABS.map(({ id, icon, label }) => {
          const badge = id === "alerts" && stream.alerts.length > 0 ? stream.alerts.length : null;
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: "none", borderRadius: 0, flex: 1, justifyContent: "center", position: "relative",
                color: activeTab === id ? theme.colors.primary : theme.colors.textSecondary,
                borderBottom: activeTab === id ? `2px solid ${theme.colors.primary}` : "2px solid transparent",
                background: activeTab === id ? `${theme.colors.primary}10` : "transparent" }}>
              {icon}{label}
              {badge !== null && (
                <span style={{ position: "absolute", top: 4, right: 6, fontSize: 9, fontWeight: 700, background: "#ef4444", color: "#fff", borderRadius: 8, padding: "0 4px", minWidth: 14, textAlign: "center" }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div style={{ border: `1px solid ${border}`, borderRadius: 10, padding: 12 }}>
        {activeTab === "map" && (
          <LiveMap events={stream.liveEvents} heatCells={stream.heatCells} showLines={showLines} showHeat={showHeat} isDark={isDark} />
        )}
        {activeTab === "feed" && (
          <EventFeed events={stream.liveEvents} isDark={isDark} />
        )}
        {activeTab === "alerts" && (
          <AlertsPanel alerts={stream.alerts} onDismiss={stream.dismissAlert} isDark={isDark} />
        )}
        {activeTab === "stats" && (
          <StatsPanel stats={stream.stats} isDark={isDark} />
        )}
      </div>

      {/* Simulation pulse indicator */}
      {stream.simulating && (
        <div style={{ fontSize: 11, color: "#f59e0b", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", animation: "livePulse 1s infinite" }} />
          Simulation running · {stream.stats.totalEvents} events injected
        </div>
      )}
    </div>
  );
}
