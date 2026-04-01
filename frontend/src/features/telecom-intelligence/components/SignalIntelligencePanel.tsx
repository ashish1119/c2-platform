/**
 * SignalIntelligencePanel — Signal Capture & Intercept module.
 * Sections: Device List | Target Monitor | Map View | Detection Log | Alerts | Timeline
 */
import React, { useState, useMemo, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "../../../context/ThemeContext";
import type { TelecomRecord } from "../model";
import {
  useSignalIntelligence,
  type DetectedDevice,
  type InterceptedTarget,
  type SignalAlert,
} from "../state/useSignalIntelligence";
import {
  Radio, Target, Map as MapIcon, List, Bell, Clock,
  RefreshCw, Wifi, WifiOff, AlertTriangle, CheckCircle,
  Eye, EyeOff, Crosshair, Activity, BarChart2,
} from "lucide-react";
import SignalChartsPanel from "./signal/SignalChartsPanel";

// ── Leaflet icon fix ──────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Signal badge ──────────────────────────────────────────────────────────────
function SignalBadge({ strength }: { strength: string }) {
  const color = strength === "Strong" ? "#22c55e" : strength === "Medium" ? "#f59e0b" : "#ef4444";
  const bars = strength === "Strong" ? 3 : strength === "Medium" ? 2 : 1;
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, marginLeft: 4 }}>
      {[1, 2, 3].map((b) => (
        <span key={b} style={{ width: 4, height: 4 + b * 3, background: b <= bars ? color : "#334155", borderRadius: 1, display: "inline-block" }} />
      ))}
    </span>
  );
}

// ── Alert severity badge ──────────────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: string }) {
  const color = severity === "high" ? "#ef4444" : severity === "medium" ? "#f59e0b" : "#3b82f6";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: `${color}22`, color, border: `1px solid ${color}55` }}>
      {severity.toUpperCase()}
    </span>
  );
}

// ── Map fit helper ────────────────────────────────────────────────────────────
function MapFit({ points }: { points: [number, number][] }) {
  const map = useMap();
  const lastLen = useRef(0);
  useEffect(() => {
    if (points.length === 0 || points.length === lastLen.current) return;
    lastLen.current = points.length;
    const bounds = L.latLngBounds(points);
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: true });
  }, [points, map]);
  return null;
}

// ── Device marker icons ───────────────────────────────────────────────────────
function makeDeviceIcon(intercepted: boolean, strength: string, fake: boolean) {
  const color = intercepted ? "#ef4444" : fake ? "#f97316" : strength === "Strong" ? "#22c55e" : strength === "Medium" ? "#f59e0b" : "#94a3b8";
  const ring = intercepted ? `<circle cx="18" cy="18" r="16" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-dasharray="4 2"/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="14" fill="${color}" stroke="white" stroke-width="2"/>
    ${ring}
    <text x="18" y="23" text-anchor="middle" font-family="monospace" font-size="11" font-weight="700" fill="white">${intercepted ? "🎯" : "📡"}</text>
  </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -18] });
}

// ── Sub-panels ────────────────────────────────────────────────────────────────

function DeviceListPanel({
  devices, onIntercept, onRelease, isDark,
}: {
  devices: DetectedDevice[];
  onIntercept: (imsi: string) => void;
  onRelease: (imsi: string) => void;
  isDark: boolean;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return devices.filter(
      (d) => !q || d.msisdn.includes(q) || d.imsi.includes(q) || d.imei.includes(q) || d.operator.toLowerCase().includes(q)
    );
  }, [devices, search]);

  const border = "rgba(17,193,202,0.2)";
  const bg = isDark ? "#0f172a" : "#f8fafc";
  const rowBg = isDark ? "#1e293b" : "#fff";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search MSISDN / IMSI / IMEI..."
        style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${border}`, background: bg, color: isDark ? "#e2e8f0" : "#1e293b", fontSize: 12, outline: "none" }}
      />
      <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: "#64748b", fontSize: 12, padding: 24 }}>No devices detected. Click "Scan Devices".</div>
        )}
        {filtered.map((d) => (
          <div key={d.id} style={{ background: d.isIntercepted ? (isDark ? "#1a0a0a" : "#fff5f5") : rowBg, border: `1px solid ${d.isIntercepted ? "#ef444455" : border}`, borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: d.isIntercepted ? "#ef4444" : "#11C1CA" }}>{d.msisdn || d.imsi}</span>
                {d.isFake && <span style={{ fontSize: 10, background: "#f9731622", color: "#f97316", border: "1px solid #f9731655", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>FAKE</span>}
                <SignalBadge strength={d.signalStrength} />
              </div>
              <button
                onClick={() => d.isIntercepted ? onRelease(d.imsi) : onIntercept(d.imsi)}
                style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 5, cursor: "pointer", border: "none", background: d.isIntercepted ? "#ef444422" : "#11C1CA22", color: d.isIntercepted ? "#ef4444" : "#11C1CA" }}
              >
                {d.isIntercepted ? "Release" : "Intercept"}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span>IMSI: {d.imsi}</span>
              <span>{d.operator} · {d.network}</span>
              <span>{d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}</span>
              <span style={{ color: d.status === "Active" ? "#22c55e" : "#94a3b8" }}>{d.status}</span>
              <span style={{ color: d.signalStrength === "Strong" ? "#22c55e" : d.signalStrength === "Medium" ? "#f59e0b" : "#ef4444" }}>{d.signalDbm} dBm</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TargetMonitorPanel({
  targets, onRelease, isDark,
}: {
  targets: InterceptedTarget[];
  onRelease: (imsi: string) => void;
  isDark: boolean;
}) {
  const border = "rgba(239,68,68,0.3)";
  const rowBg = isDark ? "#1a0a0a" : "#fff5f5";

  if (targets.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10, color: "#64748b" }}>
        <Crosshair size={32} color="#ef444455" />
        <div style={{ fontSize: 13, fontWeight: 600 }}>No targets intercepted</div>
        <div style={{ fontSize: 11 }}>Click "Intercept" on a device to start monitoring</div>
      </div>
    );
  }

  return (
    <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      {targets.map((t) => (
        <div key={t.id} style={{ background: rowBg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#ef4444" }}>🎯 {t.msisdn}</span>
              <SignalBadge strength={t.signalStrength} />
              {t.isFake && <span style={{ fontSize: 10, background: "#f9731622", color: "#f97316", border: "1px solid #f9731655", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>FAKE</span>}
            </div>
            <button onClick={() => onRelease(t.imsi)} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 5, cursor: "pointer", border: "1px solid #ef444455", background: "transparent", color: "#ef4444" }}>
              Release
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 16px", fontSize: 11, color: "#94a3b8" }}>
            <span>IMSI: <b style={{ color: isDark ? "#e2e8f0" : "#1e293b" }}>{t.imsi}</b></span>
            <span>IMEI: <b style={{ color: isDark ? "#e2e8f0" : "#1e293b" }}>{t.imei}</b></span>
            <span>Operator: <b style={{ color: isDark ? "#e2e8f0" : "#1e293b" }}>{t.operator}</b></span>
            <span>Network: <b style={{ color: isDark ? "#e2e8f0" : "#1e293b" }}>{t.network} · {t.band}</b></span>
            <span>Calls: <b style={{ color: "#22c55e" }}>{t.totalCalls}</b></span>
            <span>SMS: <b style={{ color: "#3b82f6" }}>{t.totalSms}</b></span>
            <span>Signal: <b style={{ color: t.signalStrength === "Strong" ? "#22c55e" : t.signalStrength === "Medium" ? "#f59e0b" : "#ef4444" }}>{t.signalStrength} ({t.signalDbm} dBm)</b></span>
            <span>Path pts: <b style={{ color: "#a855f7" }}>{t.movementPath.length}</b></span>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
            Location: <b style={{ color: isDark ? "#e2e8f0" : "#1e293b" }}>{t.latitude.toFixed(5)}, {t.longitude.toFixed(5)}</b>
          </div>
          {t.connectedNumbers.length > 0 && (
            <div style={{ marginTop: 5, fontSize: 11 }}>
              <span style={{ color: "#64748b" }}>Connected: </span>
              {t.connectedNumbers.slice(0, 4).map((n) => (
                <span key={n} style={{ marginRight: 6, color: "#11C1CA", fontWeight: 600 }}>{n}</span>
              ))}
              {t.connectedNumbers.length > 4 && <span style={{ color: "#64748b" }}>+{t.connectedNumbers.length - 4} more</span>}
            </div>
          )}
          {t.alerts.length > 0 && (
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
              {t.alerts.slice(0, 2).map((a) => (
                <div key={a.id} style={{ fontSize: 11, color: a.severity === "high" ? "#ef4444" : "#f59e0b", display: "flex", alignItems: "center", gap: 5 }}>
                  <AlertTriangle size={11} /> {a.message}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SignalMapPanel({
  devices, targets, isDark,
}: {
  devices: DetectedDevice[];
  targets: InterceptedTarget[];
  isDark: boolean;
}) {
  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const allPoints = useMemo((): [number, number][] =>
    devices.filter((d) => d.latitude && d.longitude).map((d) => [d.latitude, d.longitude]),
    [devices]
  );

  const targetSet = useMemo(() => new Set(targets.map((t) => t.imsi)), [targets]);

  return (
    <div style={{ width: "100%", height: 420, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(17,193,202,0.3)" }}>
      <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ width: "100%", height: "100%" }} zoomControl>
        <TileLayer url={tileUrl} attribution="" />
        {allPoints.length > 0 && <MapFit points={allPoints} />}

        {/* Coverage heatmap circles */}
        {devices.map((d) => (
          <Circle key={`cov-${d.id}`} center={[d.latitude, d.longitude]} radius={800}
            pathOptions={{ color: "transparent", fillColor: d.isIntercepted ? "#ef4444" : d.signalStrength === "Strong" ? "#22c55e" : d.signalStrength === "Medium" ? "#f59e0b" : "#94a3b8", fillOpacity: 0.06, weight: 0 }}
          />
        ))}

        {/* Movement paths for intercepted targets */}
        {targets.map((t) =>
          t.movementPath.length > 1 ? (
            <Polyline key={`path-${t.imsi}`}
              positions={t.movementPath.map((p) => [p.lat, p.lng] as [number, number])}
              pathOptions={{ color: "#ef4444", weight: 2, opacity: 0.7, dashArray: "4 3" }}
            />
          ) : null
        )}

        {/* Call connection lines for intercepted targets */}
        {targets.map((t) =>
          t.connectedNumbers.slice(0, 3).map((_, i) => {
            const angle = (i / 3) * Math.PI * 2;
            const endLat = t.latitude + 0.08 * Math.cos(angle);
            const endLng = t.longitude + 0.08 * Math.sin(angle);
            return (
              <Polyline key={`call-${t.imsi}-${i}`}
                positions={[[t.latitude, t.longitude], [endLat, endLng]]}
                pathOptions={{ color: "#a855f7", weight: 1.5, opacity: 0.5, dashArray: "3 4" }}
              />
            );
          })
        )}

        {/* Device markers */}
        {devices.map((d) => (
          <Marker key={`dev-${d.id}`} position={[d.latitude, d.longitude]}
            icon={makeDeviceIcon(d.isIntercepted, d.signalStrength, d.isFake)}
          >
            <Popup>
              <div style={{ fontSize: 12, lineHeight: 1.8, minWidth: 180 }}>
                <b style={{ color: d.isIntercepted ? "#ef4444" : "#11C1CA" }}>{d.isIntercepted ? "🎯 TARGET" : "📡 Device"}</b><br />
                MSISDN: <b>{d.msisdn}</b><br />
                IMSI: {d.imsi}<br />
                {d.operator} · {d.network} · {d.band}<br />
                Signal: <b style={{ color: d.signalStrength === "Strong" ? "#22c55e" : d.signalStrength === "Medium" ? "#f59e0b" : "#ef4444" }}>{d.signalStrength} ({d.signalDbm} dBm)</b><br />
                Status: <b style={{ color: d.status === "Active" ? "#22c55e" : "#94a3b8" }}>{d.status}</b>
                {d.isFake && <><br /><b style={{ color: "#f97316" }}>⚠ FAKE DEVICE</b></>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function DetectionLogPanel({ log, isDark }: { log: ReturnType<typeof useSignalIntelligence>["log"]; isDark: boolean }) {
  const border = "rgba(17,193,202,0.15)";
  const rowBg = isDark ? "#1e293b" : "#fff";
  return (
    <div style={{ overflowY: "auto", height: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
      {log.length === 0 && <div style={{ textAlign: "center", color: "#64748b", fontSize: 12, padding: 24 }}>No events yet. Run a scan.</div>}
      {log.map((entry) => (
        <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "120px 140px 1fr 80px 80px", gap: 8, alignItems: "center", background: rowBg, border: `1px solid ${border}`, borderRadius: 6, padding: "5px 10px", fontSize: 11 }}>
          <span style={{ color: "#64748b" }}>{new Date(entry.ts).toLocaleTimeString()}</span>
          <span style={{ color: "#11C1CA", fontFamily: "monospace" }}>{entry.imsi.slice(0, 12)}</span>
          <span style={{ color: "#94a3b8" }}>{entry.latitude.toFixed(4)}, {entry.longitude.toFixed(4)}</span>
          <span style={{ color: "#a855f7" }}>{entry.network}</span>
          <span style={{ color: entry.event === "INTERCEPTED" ? "#ef4444" : entry.event === "Released" ? "#f59e0b" : "#22c55e", fontWeight: 700 }}>{entry.event}</span>
        </div>
      ))}
    </div>
  );
}

function AlertsPanel({
  alerts, onDismiss, onClearAll, isDark,
}: {
  alerts: SignalAlert[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  isDark: boolean;
}) {
  const border = "rgba(17,193,202,0.15)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>🚨 {alerts.length} Active Alerts</span>
        {alerts.length > 0 && (
          <button onClick={onClearAll} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, cursor: "pointer", border: `1px solid ${border}`, background: "transparent", color: "#64748b" }}>
            Clear All
          </button>
        )}
      </div>
      <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
        {alerts.length === 0 && <div style={{ textAlign: "center", color: "#64748b", fontSize: 12, padding: 24 }}>No active alerts</div>}
        {alerts.map((a) => (
          <div key={a.id} style={{ background: isDark ? "#1a0a0a" : "#fff5f5", border: `1px solid ${a.severity === "high" ? "#ef444455" : "#f59e0b55"}`, borderRadius: 8, padding: "7px 10px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <AlertTriangle size={12} color={a.severity === "high" ? "#ef4444" : "#f59e0b"} />
                <SeverityBadge severity={a.severity} />
                <span style={{ fontSize: 10, color: "#64748b" }}>{new Date(a.ts).toLocaleTimeString()}</span>
              </div>
              <div style={{ fontSize: 12, color: isDark ? "#e2e8f0" : "#1e293b" }}>{a.message}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>MSISDN: {a.msisdn} · IMSI: {a.imsi}</div>
            </div>
            <button onClick={() => onDismiss(a.id)} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, cursor: "pointer", border: "none", background: "transparent", color: "#64748b" }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelinePanel({ log, isDark }: { log: ReturnType<typeof useSignalIntelligence>["log"]; isDark: boolean }) {
  const grouped = useMemo(() => {
    const m = new Map<string, typeof log>();
    for (const e of log) {
      const date = e.ts.slice(0, 10);
      if (!m.has(date)) m.set(date, []);
      m.get(date)!.push(e);
    }
    return [...m.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [log]);

  return (
    <div style={{ overflowY: "auto", height: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
      {grouped.length === 0 && <div style={{ textAlign: "center", color: "#64748b", fontSize: 12, padding: 24 }}>No timeline data yet.</div>}
      {grouped.map(([date, entries]) => (
        <div key={date}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#11C1CA", marginBottom: 6, borderBottom: "1px solid rgba(17,193,202,0.2)", paddingBottom: 4 }}>{date}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 12, borderLeft: "2px solid rgba(17,193,202,0.2)" }}>
            {entries.map((e) => (
              <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 11 }}>
                <span style={{ color: "#64748b", minWidth: 70 }}>{new Date(e.ts).toLocaleTimeString()}</span>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.event === "INTERCEPTED" ? "#ef4444" : e.event === "Released" ? "#f59e0b" : "#22c55e", flexShrink: 0 }} />
                <span style={{ color: isDark ? "#e2e8f0" : "#1e293b" }}>{e.event}</span>
                <span style={{ color: "#11C1CA", fontFamily: "monospace" }}>{e.imsi.slice(0, 12)}</span>
                <span style={{ color: "#64748b" }}>{e.network}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

type SigTab = "devices" | "targets" | "map" | "log" | "alerts" | "timeline" | "charts";

const SIG_TABS: { id: SigTab; icon: React.ReactNode; label: string }[] = [
  { id: "devices",  icon: <Radio size={13} />,       label: "Devices" },
  { id: "targets",  icon: <Target size={13} />,      label: "Targets" },
  { id: "map",      icon: <MapIcon size={13} />,     label: "Map" },
  { id: "charts",   icon: <BarChart2 size={13} />,   label: "Signal Charts" },
  { id: "log",      icon: <List size={13} />,        label: "Log" },
  { id: "alerts",   icon: <Bell size={13} />,        label: "Alerts" },
  { id: "timeline", icon: <Clock size={13} />,       label: "Timeline" },
];

type Props = { records: TelecomRecord[]; msisdn?: string; dateFrom?: string; dateTo?: string };

export default function SignalIntelligencePanel({ records, msisdn = "", dateFrom, dateTo }: Props) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";
  const sig = useSignalIntelligence(records);
  const [activeTab, setActiveTab] = useState<SigTab>("devices");

  const border = "rgba(17,193,202,0.25)";
  const panelBg = isDark ? "rgba(15,23,42,0.6)" : "rgba(248,250,252,0.8)";

  const btnBase: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 5,
    padding: "5px 11px", borderRadius: 6, fontSize: 12, fontWeight: 600,
    cursor: "pointer", border: `1px solid ${border}`, background: "transparent",
    transition: "all 0.15s",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Radio size={16} color="#11C1CA" /> Signal Intelligence
            {sig.alerts.length > 0 && (
              <span style={{ fontSize: 11, background: "#ef444422", color: "#ef4444", border: "1px solid #ef444455", borderRadius: 10, padding: "1px 7px", fontWeight: 700 }}>
                {sig.alerts.length} alerts
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>
            {sig.devices.length} devices detected · {sig.targets.length} intercepted
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={sig.scan}
            disabled={sig.scanning}
            style={{ ...btnBase, background: sig.scanning ? "transparent" : "rgba(17,193,202,0.15)", color: sig.scanning ? "#64748b" : "#11C1CA", border: `1px solid ${sig.scanning ? border : "rgba(17,193,202,0.5)"}` }}
          >
            <RefreshCw size={12} style={{ animation: sig.scanning ? "spin 1s linear infinite" : "none" }} />
            {sig.scanning ? "Scanning..." : "Scan Devices"}
          </button>

          <button
            onClick={() => sig.setAutoRefresh(!sig.autoRefresh)}
            style={{ ...btnBase, background: sig.autoRefresh ? "rgba(34,197,94,0.15)" : "transparent", color: sig.autoRefresh ? "#22c55e" : "#64748b", border: `1px solid ${sig.autoRefresh ? "#22c55e55" : border}` }}
          >
            {sig.autoRefresh ? <Wifi size={12} /> : <WifiOff size={12} />}
            {sig.autoRefresh ? "Live" : "Auto-Refresh"}
          </button>

          {/* KPI chips */}
          {[
            { label: "Devices", value: sig.devices.length, color: "#11C1CA" },
            { label: "Targets", value: sig.targets.length, color: "#ef4444" },
            { label: "Alerts",  value: sig.alerts.length,  color: "#f59e0b" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: `${color}15`, border: `1px solid ${color}40`, color }}>
              {value} {label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: "flex", background: theme.colors.surfaceAlt, border: `1px solid ${border}`, borderRadius: 8, overflow: "hidden" }}>
        {SIG_TABS.map(({ id, icon, label }) => {
          const badge = id === "alerts" && sig.alerts.length > 0 ? sig.alerts.length : id === "targets" && sig.targets.length > 0 ? sig.targets.length : null;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                ...btnBase, border: "none", borderRadius: 0, flex: 1, justifyContent: "center",
                color: activeTab === id ? theme.colors.primary : theme.colors.textSecondary,
                borderBottom: activeTab === id ? `2px solid ${theme.colors.primary}` : "2px solid transparent",
                background: activeTab === id ? `${theme.colors.primary}10` : "transparent",
                position: "relative",
              }}
            >
              {icon}{label}
              {badge !== null && (
                <span style={{ position: "absolute", top: 4, right: 6, fontSize: 9, fontWeight: 700, background: id === "alerts" ? "#ef4444" : "#11C1CA", color: "#fff", borderRadius: 8, padding: "0 4px", minWidth: 14, textAlign: "center" }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div style={{ background: panelBg, border: `1px solid ${border}`, borderRadius: 10, padding: 12, minHeight: 460 }}>
        {activeTab === "devices" && (
          <DeviceListPanel devices={sig.devices} onIntercept={sig.intercept} onRelease={sig.release} isDark={isDark} />
        )}
        {activeTab === "targets" && (
          <TargetMonitorPanel targets={sig.targets} onRelease={sig.release} isDark={isDark} />
        )}
        {activeTab === "map" && (
          <SignalMapPanel devices={sig.devices} targets={sig.targets} isDark={isDark} />
        )}
        {activeTab === "charts" && (
          <SignalChartsPanel records={records} msisdn={msisdn} dateFrom={dateFrom} dateTo={dateTo} />
        )}
        {activeTab === "log" && (
          <DetectionLogPanel log={sig.log} isDark={isDark} />
        )}
        {activeTab === "alerts" && (
          <AlertsPanel alerts={sig.alerts} onDismiss={sig.dismissAlert} onClearAll={sig.clearAlerts} isDark={isDark} />
        )}
        {activeTab === "timeline" && (
          <TimelinePanel log={sig.log} isDark={isDark} />
        )}
      </div>

      {/* CSS for spinner */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
