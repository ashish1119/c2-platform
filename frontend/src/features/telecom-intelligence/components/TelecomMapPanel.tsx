import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "../../../context/ThemeContext";
import type { TelecomRecord } from "../model";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function makeIcon(color: string, size = 26) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.3)}" viewBox="0 0 26 34">
    <path d="M13 0C5.82 0 0 5.82 0 13c0 9.1 13 21 13 21S26 22.1 26 13C26 5.82 20.18 0 13 0z" fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="13" cy="13" r="5" fill="white"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [size, Math.round(size * 1.3)],
    iconAnchor: [size / 2, Math.round(size * 1.3)],
    popupAnchor: [0, -Math.round(size * 1.3)],
  });
}

const CALLER_ICON     = makeIcon("#3B82F6", 28);
const RECEIVER_ICON   = makeIcon("#22C55E", 24);
const SUSPICIOUS_ICON = makeIcon("#EF4444", 28);

// Resets map to India center when MSISDN is cleared
function MapReset({ active }: { active: boolean }) {
  const map = useMap();
  const wasActive = useRef(active);
  useEffect(() => {
    if (wasActive.current && !active) {
      map.setView([20.5937, 78.9629], 5, { animate: true });
    }
    wasActive.current = active;
  }, [active, map]);
  return null;
}

// Fits bounds when filtered records change
function MapFit({ records, fitKey }: { records: TelecomRecord[]; fitKey: string }) {
  const map = useMap();
  const lastKey = useRef("");
  useEffect(() => {
    if (fitKey === lastKey.current || records.length === 0) return;
    lastKey.current = fitKey;
    const pts: [number, number][] = [];
    records.forEach((r) => {
      if (r.latitude && r.longitude) pts.push([r.latitude, r.longitude]);
      const rLat = r.receiverLatitude ?? r.latitude + 0.05;
      const rLng = r.receiverLongitude ?? r.longitude + 0.05;
      pts.push([rLat, rLng]);
    });
    const bounds = L.latLngBounds(pts);
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13, animate: true });
  }, [fitKey, records, map]);
  return null;
}

type Props = {
  records: TelecomRecord[];
  selectedRecord: TelecomRecord | null;
  msisdnFilter: string;           // ← NEW: gate connections on this
  onSelect: (id: string) => void;
  onFocusTarget?: (number: string) => void;
};

export default function TelecomMapPanel({
  records,
  selectedRecord,
  msisdnFilter,
  onSelect,
  onFocusTarget,
}: Props) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";

  // MSISDN gate: only render connections when a number is entered
  const msisdnActive = msisdnFilter.trim().length > 0;

  // Records to plot — only when MSISDN is active
  const mapRecords = useMemo(
    () => (msisdnActive ? records : []),
    [msisdnActive, records]
  );

  const fitKey = useMemo(
    () => mapRecords.map((r) => r.id).join(",").slice(0, 200),
    [mapRecords]
  );

  // Cluster receivers by rounded location
  const receiverClusters = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number; recs: TelecomRecord[] }>();
    mapRecords.forEach((r) => {
      const rLat = r.receiverLatitude ?? r.latitude + 0.05;
      const rLng = r.receiverLongitude ?? r.longitude + 0.05;
      const key = `${rLat.toFixed(2)},${rLng.toFixed(2)}`;
      if (!m.has(key)) m.set(key, { lat: rLat, lng: rLng, recs: [] });
      m.get(key)!.recs.push(r);
    });
    return Array.from(m.values());
  }, [mapRecords]);

  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const center: [number, number] = [20.5937, 78.9629];

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 420,          // fixed height — no layout blowout
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid rgba(17,193,202,0.4)",
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
      }}
    >
      <MapContainer
        center={center}
        zoom={5}
        style={{ width: "100%", height: "100%" }}
        zoomControl
      >
        <TileLayer url={tileUrl} attribution="" />
        <MapReset active={msisdnActive} />
        {msisdnActive && <MapFit records={mapRecords} fitKey={fitKey} />}

        {/* RED connection lines — only when MSISDN active */}
        {mapRecords.map((r) => {
          const rLat = r.receiverLatitude ?? r.latitude + 0.05;
          const rLng = r.receiverLongitude ?? r.longitude + 0.05;
          const isSuspicious = r.fake || r.silentCallType !== "None";
          const isSelected = selectedRecord?.id === r.id;
          return (
            <Polyline
              key={`line-${r.id}`}
              positions={[[r.latitude, r.longitude], [rLat, rLng]]}
              pathOptions={{
                color: "#EF4444",
                weight: isSuspicious ? 3 : isSelected ? 3 : 1.5,
                opacity: isSelected ? 0.95 : isSuspicious ? 0.85 : 0.55,
                dashArray: r.fake ? "6 4" : undefined,
              }}
            />
          );
        })}

        {/* Caller markers */}
        {mapRecords.map((r) => {
          const isSuspicious = r.fake || r.silentCallType !== "None";
          return (
            <Marker
              key={`caller-${r.id}`}
              position={[r.latitude, r.longitude]}
              icon={isSuspicious ? SUSPICIOUS_ICON : CALLER_ICON}
              eventHandlers={{ click: () => onSelect(r.id) }}
            >
              <Popup>
                <div style={{ fontSize: 12, lineHeight: 1.8, minWidth: 170 }}>
                  <strong style={{ color: "#3B82F6" }}>{r.msisdn}</strong><br />
                  <span style={{ color: "#64748B" }}>→ Target: </span>
                  <span
                    style={{ color: "#22C55E", cursor: onFocusTarget ? "pointer" : "default", fontWeight: 600 }}
                    onClick={() => onFocusTarget?.(r.target)}
                  >
                    {r.target || "—"}
                  </span><br />
                  {r.callType} · {Math.floor(r.duration / 60)}m {r.duration % 60}s<br />
                  {r.place && <>{r.place}<br /></>}
                  {r.operator} · {r.network}<br />
                  {r.fake && <span style={{ color: "#EF4444", fontWeight: 700 }}>⚠ FAKE SIGNAL<br /></span>}
                  {r.silentCallType !== "None" && (
                    <span style={{ color: "#F59E0B", fontWeight: 700 }}>👁 {r.silentCallType}<br /></span>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Receiver markers — clustered */}
        {receiverClusters.map(({ lat, lng, recs }) => {
          const count = recs.length;
          return (
            <Marker
              key={`recv-${lat.toFixed(4)}-${lng.toFixed(4)}`}
              position={[lat, lng]}
              icon={
                count > 1
                  ? L.divIcon({
                      html: `<div style="background:#22C55E;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${count}</div>`,
                      className: "",
                      iconSize: [28, 28],
                      iconAnchor: [14, 14],
                    })
                  : RECEIVER_ICON
              }
              eventHandlers={{
                click: () => { if (recs[0]?.target && onFocusTarget) onFocusTarget(recs[0].target); },
              }}
            >
              <Popup>
                <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                  <strong style={{ color: "#22C55E" }}>
                    Receiver{count > 1 ? ` (${count} calls)` : ""}
                  </strong><br />
                  {recs.slice(0, 5).map((r) => (
                    <div key={r.id}>
                      <span
                        style={{ color: "#22C55E", cursor: onFocusTarget ? "pointer" : "default", fontWeight: 600 }}
                        onClick={() => onFocusTarget?.(r.target)}
                      >
                        {r.target}
                      </span>
                      {" · "}{r.callType}
                    </div>
                  ))}
                  {count > 5 && <div style={{ color: "#64748B" }}>+{count - 5} more</div>}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Heatmap density circles */}
        {mapRecords.map((r) => (
          <CircleMarker
            key={`heat-${r.id}`}
            center={[r.latitude, r.longitude]}
            radius={14}
            pathOptions={{
              color: "transparent",
              fillColor: r.fake || r.silentCallType !== "None" ? "#EF4444" : "#3B82F6",
              fillOpacity: 0.07,
              weight: 0,
            }}
          />
        ))}
      </MapContainer>

      {/* ── Empty state overlay — shown when no MSISDN entered ── */}
      {!msisdnActive && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            background: isDark ? "rgba(15,23,42,0.72)" : "rgba(248,250,252,0.75)",
            backdropFilter: "blur(4px)",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: 32 }}>📡</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#11C1CA" }}>
            Enter MSISDN to visualize connections
          </div>
          <div style={{ fontSize: 12, color: isDark ? "#94A3B8" : "#64748B", textAlign: "center", maxWidth: 260 }}>
            Type a mobile number in the MSISDN filter above to plot caller → receiver connections on the map.
          </div>
        </div>
      )}

      {/* Legend — only when active */}
      {msisdnActive && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            zIndex: 1000,
            background: isDark ? "rgba(15,23,42,0.9)" : "rgba(255,255,255,0.95)",
            border: "1px solid rgba(17,193,202,0.3)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 11,
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          {[
            { color: "#3B82F6", label: "Caller (MSISDN)" },
            { color: "#22C55E", label: "Receiver / Target" },
            { color: "#EF4444", label: "Suspicious" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
              <span>{label}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 20, height: 2, background: "#EF4444", borderRadius: 1 }} />
            <span>Red line = connection</span>
          </div>
        </div>
      )}

      {/* Count badge */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 1000,
          background: isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.9)",
          border: "1px solid rgba(17,193,202,0.3)",
          borderRadius: 6,
          padding: "4px 10px",
          fontSize: 11,
          color: msisdnActive ? "#11C1CA" : "#64748B",
          fontWeight: 600,
        }}
      >
        {msisdnActive ? `${mapRecords.length} connections` : "No MSISDN selected"}
      </div>
    </div>
  );
}
