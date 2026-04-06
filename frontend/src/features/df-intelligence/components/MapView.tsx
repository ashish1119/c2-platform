import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DFDevice } from "../hooks/useDFData";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const C = { bg: "#060d1a", border: "#0e2a45", cyan: "#00e5ff", green: "#00ff88", warn: "#f59e0b", danger: "#ef4444", muted: "#3d6080" };

// Target location (triangulated)
const TARGET = { lat: 19.4, lng: 73.2 };

function makeStationIcon(status: DFDevice["status"], active: boolean) {
  const color = status === "active" ? (active ? "#00e5ff" : "#00ff88") : status === "scanning" ? "#f59e0b" : "#ef4444";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="14" fill="${color}22" stroke="${color}" stroke-width="2"/>
    <circle cx="16" cy="16" r="6" fill="${color}" stroke="white" stroke-width="1.5"/>
    ${active ? `<circle cx="16" cy="16" r="14" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="4 3" opacity="0.5"/>` : ""}
  </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] });
}

function makeTargetIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="16" fill="rgba(239,68,68,0.15)" stroke="#ef4444" stroke-width="2"/>
    <circle cx="18" cy="18" r="8" fill="rgba(239,68,68,0.3)" stroke="#ef4444" stroke-width="1.5"/>
    <circle cx="18" cy="18" r="3" fill="#ef4444"/>
    <line x1="18" y1="2" x2="18" y2="10" stroke="#ef4444" stroke-width="1.5"/>
    <line x1="18" y1="26" x2="18" y2="34" stroke="#ef4444" stroke-width="1.5"/>
    <line x1="2" y1="18" x2="10" y2="18" stroke="#ef4444" stroke-width="1.5"/>
    <line x1="26" y1="18" x2="34" y2="18" stroke="#ef4444" stroke-width="1.5"/>
  </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -18] });
}

// Animated bearing line injector
let _animInjected = false;
function injectDFAnim() {
  if (_animInjected || typeof document === "undefined") return;
  _animInjected = true;
  const s = document.createElement("style");
  s.textContent = `
    @keyframes dfDash { to { stroke-dashoffset: -20; } }
    .df-bearing-line { animation: dfDash 1.2s linear infinite; }
  `;
  document.head.appendChild(s);
}

function BearingLines({ devices }: { devices: DFDevice[] }) {
  const map = useMap();
  const groupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    injectDFAnim();
    if (groupRef.current) map.removeLayer(groupRef.current);
    const group = L.layerGroup().addTo(map);
    groupRef.current = group;

    devices.filter(d => d.status !== "offline").forEach((d) => {
      const rad = (d.bearing * Math.PI) / 180;
      const len = 1.8;
      const endLat = d.lat + len * Math.cos(rad);
      const endLng = d.lng + len * Math.sin(rad);
      const color = d.status === "active" ? "#00e5ff" : "#f59e0b";

      const line = L.polyline([[d.lat, d.lng], [endLat, endLng]], {
        color, weight: 2, opacity: 0.8, dashArray: "8 5",
      });
      line.on("add", () => {
        const el = (line as any)._path as SVGPathElement | undefined;
        if (el) el.classList.add("df-bearing-line");
      });
      line.addTo(group);

      // Triangulation line to target
      L.polyline([[d.lat, d.lng], [TARGET.lat, TARGET.lng]], {
        color: "#ef444455", weight: 1, dashArray: "4 6",
      }).addTo(group);
    });

    return () => { map.removeLayer(group); };
  }, [devices, map]);

  return null;
}

type Props = { devices: DFDevice[]; activeId: string };

export default function MapView({ devices, activeId }: Props) {
  const center: [number, number] = [19.2, 73.3];

  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, background: "rgba(0,229,255,0.04)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.cyan, boxShadow: `0 0 6px ${C.cyan}` }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: C.cyan, letterSpacing: "1.5px", fontFamily: "monospace" }}>TACTICAL MAP · DF TRIANGULATION</span>
        <span style={{ marginLeft: "auto", fontSize: 9, fontFamily: "monospace", color: C.muted }}>
          {devices.filter(d => d.status !== "offline").length} STATIONS ACTIVE
        </span>
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer center={center} zoom={7} style={{ width: "100%", height: "100%" }} zoomControl>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="" />
          <BearingLines devices={devices} />

          {/* Coverage circles */}
          {devices.filter(d => d.status !== "offline").map(d => (
            <Circle key={`cov-${d.id}`} center={[d.lat, d.lng]}
              radius={d.scanRange * 1000}
              pathOptions={{ color: d.id === activeId ? "#00e5ff" : "#00ff8840", weight: 1, fillOpacity: 0.04, opacity: 0.4 }}
            />
          ))}

          {/* DF Station markers */}
          {devices.map(d => (
            <Marker key={d.id} position={[d.lat, d.lng]} icon={makeStationIcon(d.status, d.id === activeId)}>
              <Popup>
                <div style={{ fontSize: 12, lineHeight: 1.8, minWidth: 160, background: "#0b1a2e", color: "#c8dff0", padding: 8, borderRadius: 6 }}>
                  <b style={{ color: "#00e5ff" }}>{d.name}</b><br />
                  Status: <b style={{ color: d.status === "active" ? "#00ff88" : d.status === "scanning" ? "#f59e0b" : "#ef4444" }}>{d.status.toUpperCase()}</b><br />
                  Location: {d.location}<br />
                  {d.status !== "offline" && <>Freq: <b>{d.frequency} MHz</b><br />Signal: <b>{d.signalDbm.toFixed(0)} dBm</b><br />Bearing: <b>{d.bearing.toFixed(0)}°</b></>}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Target marker */}
          <Marker position={[TARGET.lat, TARGET.lng]} icon={makeTargetIcon()}>
            <Popup>
              <div style={{ fontSize: 12, background: "#0b1a2e", color: "#c8dff0", padding: 8, borderRadius: 6 }}>
                <b style={{ color: "#ef4444" }}>⚠ TARGET LOCATION</b><br />
                Triangulated from {devices.filter(d => d.status !== "offline").length} stations
              </div>
            </Popup>
          </Marker>
        </MapContainer>

        {/* Legend */}
        <div style={{ position: "absolute", bottom: 12, right: 12, zIndex: 1000, background: "rgba(6,13,26,0.92)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 10, fontFamily: "monospace", display: "flex", flexDirection: "column", gap: 5 }}>
          {[
            { color: C.cyan,    label: "Active Station" },
            { color: "#f59e0b", label: "Scanning" },
            { color: "#ef4444", label: "Target / Offline" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 4px ${color}` }} />
              <span style={{ color: C.muted }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
