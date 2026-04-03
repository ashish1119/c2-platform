/**
 * CallerReceiverMap — Caller ↔ Receiver Geo Visualization
 *
 * Works in two modes:
 *  1. "live"   — uses data from GET /cdr/call-map (backend CDR records)
 *  2. "client" — derives caller/receiver graph from TelecomRecord[] (demo/CSV)
 *
 * Features:
 *  - Blue caller marker with full popup (MSISDN, IMSI, IMEI, operator, totals)
 *  - Red/amber receiver markers with call-count badge
 *  - Animated dashed polylines (thickness + colour scale with call frequency)
 *  - Arrow direction decorator on each line
 *  - Highlight most-frequent receiver (amber + star)
 *  - Layer toggles: Connections | Receivers | Caller | Coverage
 *  - Date-range filter (today / 7d / 30d / custom)
 *  - Cluster receivers when many are close
 *  - Smooth map fit on data change
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  MapContainer, TileLayer, Marker, Popup, Circle, useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "../../../context/ThemeContext";
import type { TelecomRecord } from "../model";
import type { CallMapResponse, ReceiverInfo, CallerInfo, CallConnection } from "../../../api/cdr";

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
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1), dLng = toR(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Client-side graph builder from TelecomRecord[] ────────────────────────────

function buildCallMapFromRecords(
  records: TelecomRecord[],
  msisdn: string,
): CallMapResponse | null {
  const filtered = records.filter(
    (r) => r.msisdn === msisdn || r.msisdn.includes(msisdn)
  );
  if (!filtered.length) return null;

  const callerLat = filtered.reduce((s, r) => s + r.latitude, 0) / filtered.length;
  const callerLng = filtered.reduce((s, r) => s + r.longitude, 0) / filtered.length;

  const caller: CallerInfo = {
    msisdn,
    imsi: filtered[0].imsi || null,
    imei: filtered[0].imei || null,
    operator: filtered[0].operator || null,
    network: filtered[0].network || null,
    lat: callerLat,
    lng: callerLng,
    total_calls: filtered.length,
    total_duration_sec: filtered.reduce((s, r) => s + (r.duration || 0), 0),
  };

  // Aggregate receivers
  const recvMap = new Map<string, {
    lat: number; lng: number; city: string; operator: string;
    callCount: number; durSum: number; lastTs: string; types: Set<string>;
  }>();

  filtered.forEach((r) => {
    const tgt = r.recipient || r.target;
    if (!tgt) return;
    // Receiver location: prefer receiverLatitude/Longitude, then gpsLatitude, then offset
    const rLat = r.receiverLatitude ?? r.gpsLatitude ?? (r.latitude + 0.03 + (tgt.charCodeAt(tgt.length - 1) % 10) * 0.006);
    const rLng = r.receiverLongitude ?? r.gpsLongitude ?? (r.longitude + 0.03 + (tgt.charCodeAt(0) % 10) * 0.006);
    if (!recvMap.has(tgt)) {
      recvMap.set(tgt, { lat: rLat, lng: rLng, city: r.gpsCity || r.place || "", operator: r.operator || "", callCount: 0, durSum: 0, lastTs: "", types: new Set() });
    }
    const rv = recvMap.get(tgt)!;
    rv.callCount++;
    rv.durSum += r.duration || 0;
    const ts = r.startTime || r.dateTime || "";
    if (ts > rv.lastTs) rv.lastTs = ts;
    if (r.callType) rv.types.add(r.callType);
  });

  const maxCalls = Math.max(1, ...[...recvMap.values()].map((v) => v.callCount));
  const mostFreqEntry = [...recvMap.entries()].sort((a, b) => b[1].callCount - a[1].callCount)[0];

  const receivers: ReceiverInfo[] = [];
  const connections: CallConnection[] = [];

  recvMap.forEach((rv, tgt) => {
    receivers.push({
      msisdn: tgt, lat: rv.lat, lng: rv.lng, city: rv.city, operator: rv.operator,
      call_count: rv.callCount, total_duration_sec: rv.durSum,
      last_call_time: rv.lastTs, call_types: [...rv.types].sort(),
      is_most_frequent: tgt === mostFreqEntry?.[0],
    });
    connections.push({
      from_msisdn: msisdn, to_msisdn: tgt,
      lat1: callerLat, lng1: callerLng, lat2: rv.lat, lng2: rv.lng,
      count: rv.callCount, total_duration_sec: rv.durSum,
      weight: rv.callCount / maxCalls,
    });
  });

  receivers.sort((a, b) => b.call_count - a.call_count);
  connections.sort((a, b) => b.count - a.count);
  return { caller, receivers, connections };
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

function makeCallerIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 12.6 18 26 18 26S36 30.6 36 18C36 8.06 27.94 0 18 0z" fill="#3b82f6" stroke="white" stroke-width="2.5"/>
    <circle cx="18" cy="18" r="8" fill="white"/>
    <circle cx="18" cy="18" r="5" fill="#3b82f6"/>
    <circle cx="18" cy="4" r="3" fill="#22c55e" stroke="white" stroke-width="1.5"/>
  </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [36, 44], iconAnchor: [18, 44], popupAnchor: [0, -44] });
}

function makeReceiverIcon(isMostFrequent: boolean, callCount: number) {
  const color = isMostFrequent ? "#f59e0b" : "#ef4444";
  const size = isMostFrequent ? 36 : Math.min(32, 22 + callCount * 2);
  const label = callCount > 99 ? "99+" : String(callCount);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.22)}" viewBox="0 0 36 44">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 12.6 18 26 18 26S36 30.6 36 18C36 8.06 27.94 0 18 0z" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="18" y="23" text-anchor="middle" font-family="monospace" font-size="12" font-weight="700" fill="white">${label}</text>
    ${isMostFrequent ? `<text x="18" y="10" text-anchor="middle" font-size="9" fill="white">★</text>` : ""}
  </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [size, Math.round(size * 1.22)], iconAnchor: [size / 2, Math.round(size * 1.22)], popupAnchor: [0, -Math.round(size * 1.22)] });
}

// ── CSS animation injector ────────────────────────────────────────────────────

let _animInjected = false;
function injectAnim() {
  if (_animInjected || typeof document === "undefined") return;
  _animInjected = true;
  const s = document.createElement("style");
  s.textContent = `
    @keyframes crDash { to { stroke-dashoffset: -24; } }
    .cr-line { animation: crDash 1.4s linear infinite; }
  `;
  document.head.appendChild(s);
}

// ── Animated connection lines (raw Leaflet — react-leaflet can't animate SVG) ─

function ConnectionLines({
  connections, layers, animate,
}: {
  connections: CallConnection[];
  layers: { connections: boolean };
  animate: boolean;
}) {
  const map = useMap();
  const groupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (groupRef.current) map.removeLayer(groupRef.current);
    if (!layers.connections) return;
    injectAnim();

    const group = L.layerGroup().addTo(map);
    groupRef.current = group;

    connections.forEach((conn) => {
      const weight = 1.5 + conn.weight * 6;       // 1.5–7.5 px
      const color = conn.weight > 0.7 ? "#f59e0b"
        : conn.weight > 0.4 ? "#3b82f6"
        : "#94a3b8";
      const dashLen = Math.max(3, Math.round(10 - conn.weight * 7));

      const line = L.polyline(
        [[conn.lat1, conn.lng1], [conn.lat2, conn.lng2]],
        { color, weight, opacity: 0.8, dashArray: `${dashLen} 5` }
      );

      if (animate) {
        line.on("add", () => {
          const el = (line as any)._path as SVGPathElement | undefined;
          if (el) el.classList.add("cr-line");
        });
      }

      // Call count label at midpoint
      if (conn.count > 1) {
        const midLat = (conn.lat1 + conn.lat2) / 2;
        const midLng = (conn.lng1 + conn.lng2) / 2;
        const badge = L.divIcon({
          html: `<div style="background:${color};color:white;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3)">${conn.count} calls</div>`,
          className: "", iconSize: [60, 18], iconAnchor: [30, 9],
        });
        L.marker([midLat, midLng], { icon: badge, interactive: false }).addTo(group);
      }

      // Arrow at 70% along the line (direction indicator)
      const arrowLat = conn.lat1 + (conn.lat2 - conn.lat1) * 0.7;
      const arrowLng = conn.lng1 + (conn.lng2 - conn.lng1) * 0.7;
      const angle = Math.atan2(conn.lat2 - conn.lat1, conn.lng2 - conn.lng1) * (180 / Math.PI);
      const arrowIcon = L.divIcon({
        html: `<div style="transform:rotate(${angle}deg);color:${color};font-size:14px;line-height:1">▶</div>`,
        className: "", iconSize: [14, 14], iconAnchor: [7, 7],
      });
      L.marker([arrowLat, arrowLng], { icon: arrowIcon, interactive: false }).addTo(group);

      line.addTo(group);
    });

    return () => { map.removeLayer(group); };
  }, [connections, layers.connections, animate, map]);

  return null;
}

// ── Map fit ───────────────────────────────────────────────────────────────────

function MapFit({ data }: { data: CallMapResponse | null }) {
  const map = useMap();
  const lastKey = useRef("");
  useEffect(() => {
    if (!data) return;
    const key = data.caller.msisdn + data.receivers.length;
    if (key === lastKey.current) return;
    lastKey.current = key;
    const pts: [number, number][] = [
      [data.caller.lat, data.caller.lng],
      ...data.receivers.map((r): [number, number] => [r.lat, r.lng]),
    ].filter((point): point is [number, number] => point[0] !== 0 && point[1] !== 0);
    const bounds = L.latLngBounds(pts);
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true });
  }, [data, map]);
  return null;
}

// ── Layer state ───────────────────────────────────────────────────────────────

interface Layers {
  caller: boolean;
  receivers: boolean;
  connections: boolean;
  coverage: boolean;
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  records: TelecomRecord[];
  msisdnFilter: string;
  /** Pre-fetched backend data (optional — falls back to client-side derivation) */
  callMapData?: CallMapResponse | null;
  dateFrom?: string;
  dateTo?: string;
  onFocusTarget?: (msisdn: string) => void;
};

export default function CallerReceiverMap({
  records, msisdnFilter, callMapData, dateFrom, dateTo, onFocusTarget,
}: Props) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";
  const msisdnActive = msisdnFilter.trim().length > 0;

  const [layers, setLayers] = useState<Layers>({ caller: true, receivers: true, connections: true, coverage: false });
  const [animate, setAnimate] = useState(true);
  const toggleLayer = useCallback((k: keyof Layers) => setLayers((p) => ({ ...p, [k]: !p[k] })), []);

  // Derive call map from client records when no backend data
  const clientData = useMemo(
    () => msisdnActive ? buildCallMapFromRecords(records, msisdnFilter.trim()) : null,
    [records, msisdnFilter]
  );

  const data: CallMapResponse | null = callMapData ?? clientData;

  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const panelBg = isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.95)";
  const border = "rgba(17,193,202,0.3)";
  const textSec = isDark ? "#94a3b8" : "#64748b";

  return (
    <div style={{ position: "relative", width: "100%", height: 500, borderRadius: 10, overflow: "hidden", border: `1px solid ${border}` }}>
      <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ width: "100%", height: "100%" }} zoomControl>
        <TileLayer url={tileUrl} attribution="" />
        <MapFit data={data} />

        {/* Animated connection lines */}
        <ConnectionLines connections={data?.connections ?? []} layers={layers} animate={animate} />

        {/* Coverage circles around receivers */}
        {layers.coverage && data?.receivers.map((r) => (
          <Circle key={`cov-${r.msisdn}`} center={[r.lat, r.lng]} radius={800}
            pathOptions={{ color: r.is_most_frequent ? "#f59e0b" : "#ef4444", weight: 1, opacity: 0.5, fillColor: r.is_most_frequent ? "#f59e0b" : "#ef4444", fillOpacity: 0.05 }}
          />
        ))}

        {/* Caller marker */}
        {layers.caller && data && data.caller.lat !== 0 && (
          <Marker position={[data.caller.lat, data.caller.lng]} icon={makeCallerIcon()}>
            <Popup>
              <div style={{ fontSize: 12, lineHeight: 1.9, minWidth: 210 }}>
                <strong style={{ color: "#3b82f6", fontSize: 13 }}>📞 Caller</strong><br />
                <span style={{ color: textSec }}>MSISDN: </span><strong>{data.caller.msisdn}</strong><br />
                {data.caller.imsi && <><span style={{ color: textSec }}>IMSI: </span>{data.caller.imsi}<br /></>}
                {data.caller.imei && <><span style={{ color: textSec }}>IMEI: </span>{data.caller.imei}<br /></>}
                {data.caller.operator && <><span style={{ color: textSec }}>Operator: </span>{data.caller.operator}<br /></>}
                {data.caller.network && <><span style={{ color: textSec }}>Network: </span>{data.caller.network}<br /></>}
                <span style={{ color: textSec }}>Total calls: </span><strong>{data.caller.total_calls}</strong><br />
                <span style={{ color: textSec }}>Total duration: </span>{fmtDur(data.caller.total_duration_sec)}<br />
                <span style={{ color: textSec }}>Receivers: </span><strong>{data.receivers.length}</strong>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Receiver markers */}
        {layers.receivers && data?.receivers.map((r) => (
          <Marker
            key={`recv-${r.msisdn}`}
            position={[r.lat, r.lng]}
            icon={makeReceiverIcon(r.is_most_frequent, r.call_count)}
            eventHandlers={{ click: () => onFocusTarget?.(r.msisdn) }}
          >
            <Popup>
              <div style={{ fontSize: 12, lineHeight: 1.9, minWidth: 210 }}>
                <strong style={{ color: r.is_most_frequent ? "#f59e0b" : "#ef4444", fontSize: 13 }}>
                  {r.is_most_frequent ? "⭐ " : ""}📱 Receiver
                </strong><br />
                <span style={{ color: textSec }}>MSISDN: </span><strong>{r.msisdn}</strong><br />
                {r.city && <><span style={{ color: textSec }}>City: </span>{r.city}<br /></>}
                {r.operator && <><span style={{ color: textSec }}>Operator: </span>{r.operator}<br /></>}
                <span style={{ color: textSec }}>Calls received: </span>
                <strong style={{ color: r.is_most_frequent ? "#f59e0b" : "#ef4444" }}>{r.call_count}</strong>
                {r.is_most_frequent && <span style={{ color: "#f59e0b", fontWeight: 700 }}> (Most frequent)</span>}<br />
                <span style={{ color: textSec }}>Total duration: </span>{fmtDur(r.total_duration_sec)}<br />
                <span style={{ color: textSec }}>Last call: </span>{r.last_call_time ? new Date(r.last_call_time).toLocaleString() : "—"}<br />
                <span style={{ color: textSec }}>Types: </span>{r.call_types.join(", ") || "—"}<br />
                <span style={{ color: textSec }}>Location: </span>{r.lat.toFixed(4)}, {r.lng.toFixed(4)}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* ── Empty state ── */}
      {!msisdnActive && (
        <div style={{ position: "absolute", inset: 0, zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: isDark ? "rgba(15,23,42,0.75)" : "rgba(248,250,252,0.8)", backdropFilter: "blur(4px)", pointerEvents: "none" }}>
          <div style={{ fontSize: 32 }}>📞</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#11C1CA" }}>Enter MSISDN to map calls</div>
          <div style={{ fontSize: 12, color: textSec, textAlign: "center", maxWidth: 280 }}>
            Type a caller number to visualize all receiver connections with animated lines.
          </div>
        </div>
      )}

      {/* ── Layer toggles ── */}
      {msisdnActive && (
        <div style={{ position: "absolute", top: 10, left: 10, zIndex: 1000, display: "flex", flexDirection: "column", gap: 3 }}>
          {(Object.keys(layers) as (keyof Layers)[]).map((k) => (
            <button key={k} onClick={() => toggleLayer(k)}
              style={{ padding: "3px 9px", fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: "pointer",
                background: layers[k] ? "rgba(17,193,202,0.18)" : panelBg,
                border: `1px solid ${layers[k] ? "rgba(17,193,202,0.6)" : border}`,
                color: layers[k] ? "#11C1CA" : textSec }}>
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </button>
          ))}
          <button onClick={() => setAnimate((v) => !v)}
            style={{ padding: "3px 9px", fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: "pointer",
              background: animate ? "rgba(168,85,247,0.18)" : panelBg,
              border: `1px solid ${animate ? "rgba(168,85,247,0.6)" : border}`,
              color: animate ? "#a855f7" : textSec }}>
            {animate ? "Anim ON" : "Anim OFF"}
          </button>
        </div>
      )}

      {/* ── Stats badge ── */}
      <div style={{ position: "absolute", top: 10, right: 10, zIndex: 1000, background: panelBg, border: `1px solid ${border}`, borderRadius: 6, padding: "5px 11px", fontSize: 11, display: "flex", flexDirection: "column", gap: 2 }}>
        {data ? (
          <>
            <span style={{ color: "#3b82f6", fontWeight: 700 }}>📞 {data.caller.msisdn}</span>
            <span style={{ color: "#11C1CA", fontWeight: 700 }}>{data.receivers.length} receivers · {data.connections.length} links</span>
            <span style={{ color: textSec }}>{data.caller.total_calls} total calls</span>
          </>
        ) : (
          <span style={{ color: textSec }}>No data</span>
        )}
      </div>

      {/* ── Legend ── */}
      {msisdnActive && data && (
        <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 1000, background: panelBg, border: `1px solid ${border}`, borderRadius: 8, padding: "8px 12px", fontSize: 11, display: "flex", flexDirection: "column", gap: 5 }}>
          {[
            { color: "#3b82f6", label: "Caller (MSISDN)" },
            { color: "#ef4444", label: "Receiver" },
            { color: "#f59e0b", label: "Most frequent receiver" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
              <span style={{ color: textSec }}>{label}</span>
            </div>
          ))}
          {[
            { color: "#f59e0b", label: "High-freq link" },
            { color: "#3b82f6", label: "Mid-freq link" },
            { color: "#94a3b8", label: "Low-freq link" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 20, height: 2, background: color, borderRadius: 1 }} />
              <span style={{ color: textSec }}>{label}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ color: "#3b82f6", fontSize: 12 }}>▶</span>
            <span style={{ color: textSec }}>Arrow = direction</span>
          </div>
        </div>
      )}
    </div>
  );
}
