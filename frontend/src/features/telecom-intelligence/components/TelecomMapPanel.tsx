/**
 * TelecomMapPanel — Advanced tower visualization with realistic telecom network logic.
 *
 * Features:
 *  - Virtual tower generation from CDR records (RAN + Band + rounded lat/lng)
 *  - Coverage circles colour-coded by network type (5G/4G/LTE/3G)
 *  - Signal strength estimation via haversine distance
 *  - User ↔ Tower connection lines (thickness = signal strength)
 *  - Tower popup: ID, network, RAN, user count, avg signal, load %
 *  - Receiver clustering
 *  - Heatmap density overlay
 *  - Congestion detection + highlight
 *  - Marker clustering for dense tower areas
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../../context/ThemeContext";
import type { TelecomRecord } from "../model";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Circle,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Leaflet icon fix ──────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Constants ─────────────────────────────────────────────────────────────────

const COVERAGE_RADIUS: Record<string, number> = {
  "5G": 350,
  "4G": 1_250,
  "LTE": 2_000,
  "3G": 3_500,
};
const DEFAULT_RADIUS = 1_000;

const NETWORK_COLOR: Record<string, string> = {
  "5G": "#a855f7",
  "4G": "#22c55e",
  "LTE": "#3b82f6",
  "3G": "#f97316",
};
const DEFAULT_NET_COLOR = "#64748b";

const CONGESTION_THRESHOLD = 10;
const CLUSTER_RADIUS_DEG = 0.005; // ~500 m at equator

// ── Haversine ─────────────────────────────────────────────────────────────────

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function signalStrength(distM: number): "Strong" | "Medium" | "Weak" {
  if (distM < 200) return "Strong";
  if (distM < 1_000) return "Medium";
  return "Weak";
}

function signalLineWeight(strength: "Strong" | "Medium" | "Weak"): number {
  return strength === "Strong" ? 3 : strength === "Medium" ? 2 : 1;
}

// ── Tower aggregation (client-side from TelecomRecord[]) ──────────────────────

interface VirtualTower {
  towerId: string;
  towerLabel: string;          // human-readable TWR-XXXXXX
  lat: number;
  lng: number;
  network: string;
  ran: string;
  band: string;
  arfcn?: number;
  rxLevel?: number;            // avg Rx Level dBm
  coverageRadius: number;
  color: string;
  userCount: number;
  avgDurationSec: number;
  signalStrength: "Strong" | "Medium" | "Weak";
  rxStrength: "Strong" | "Medium" | "Weak";  // from Rx Level
  isCongested: boolean;
  loadPct: number;
  operators: string[];
  place: string;               // city/place label
  records: TelecomRecord[];
}

function buildTowers(records: TelecomRecord[]): VirtualTower[] {
  const groups = new Map<string, {
    latSum: number; lngSum: number; count: number; durSum: number;
    network: string; ran: string; band: string;
    arfcnSet: Set<number>; rxSum: number; rxCount: number;
    operators: Set<string>; places: Set<string>; records: TelecomRecord[];
  }>();

  for (const r of records) {
    if (!r.latitude || !r.longitude) continue;
    const ran = r.ran || "UNK";
    const band = r.band || "UNK";
    const key = `${ran}-${band}-${r.latitude.toFixed(2)}-${r.longitude.toFixed(2)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        latSum: 0, lngSum: 0, count: 0, durSum: 0,
        network: r.network || "4G", ran, band,
        arfcnSet: new Set(), rxSum: 0, rxCount: 0,
        operators: new Set(), places: new Set(), records: [],
      });
    }
    const g = groups.get(key)!;
    g.latSum += r.latitude;
    g.lngSum += r.longitude;
    g.count += 1;
    g.durSum += r.duration || 0;
    if (r.operator) g.operators.add(r.operator);
    if (r.place || r.gpsCity) g.places.add(r.gpsCity || r.place || "");
    if (r.arfcn) g.arfcnSet.add(r.arfcn);
    if (r.rxLevel !== undefined && r.rxLevel !== null) {
      g.rxSum += r.rxLevel;
      g.rxCount += 1;
    }
    g.records.push(r);
  }

  return Array.from(groups.entries()).map(([key, g]) => {
    const n = g.count;
    const lat = g.latSum / n;
    const lng = g.lngSum / n;
    const net = g.network;
    const radius = COVERAGE_RADIUS[net] ?? DEFAULT_RADIUS;
    const gridLat = parseFloat(lat.toFixed(2));
    const gridLng = parseFloat(lng.toFixed(2));
    const dist = haversineM(lat, lng, gridLat, gridLng);
    const loadPct = Math.min(100, (n / CONGESTION_THRESHOLD) * 100);
    const avgRx = g.rxCount > 0 ? Math.round(g.rxSum / g.rxCount) : undefined;
    const towerLabel = generateTowerId(g.ran, g.band, lat, lng);

    return {
      towerId: key,
      towerLabel,
      lat, lng,
      network: net,
      ran: g.ran,
      band: g.band,
      arfcn: g.arfcnSet.size > 0 ? [...g.arfcnSet][0] : undefined,
      rxLevel: avgRx,
      coverageRadius: radius,
      color: NETWORK_COLOR[net] ?? DEFAULT_NET_COLOR,
      userCount: n,
      avgDurationSec: Math.round(g.durSum / n),
      signalStrength: signalStrength(dist),
      rxStrength: rxLevelToStrength(avgRx),
      isCongested: n >= CONGESTION_THRESHOLD,
      loadPct: Math.round(loadPct * 10) / 10,
      operators: [...g.operators].sort(),
      place: [...g.places].filter(Boolean).join(", ") || "—",
      records: g.records,
    };
  }).sort((a, b) => b.userCount - a.userCount);
}

// ── Tower clustering (merge towers within ~500 m) ─────────────────────────────

interface TowerCluster {
  towers: VirtualTower[];
  lat: number;
  lng: number;
  isMerged: boolean;
}

function clusterTowers(towers: VirtualTower[]): TowerCluster[] {
  const used = new Set<number>();
  const clusters: TowerCluster[] = [];

  for (let i = 0; i < towers.length; i++) {
    if (used.has(i)) continue;
    const group: VirtualTower[] = [towers[i]];
    used.add(i);
    for (let j = i + 1; j < towers.length; j++) {
      if (used.has(j)) continue;
      const dist = haversineM(towers[i].lat, towers[i].lng, towers[j].lat, towers[j].lng);
      if (dist <= 500) {
        group.push(towers[j]);
        used.add(j);
      }
    }
    const lat = group.reduce((s, t) => s + t.lat, 0) / group.length;
    const lng = group.reduce((s, t) => s + t.lng, 0) / group.length;
    clusters.push({ towers: group, lat, lng, isMerged: group.length > 1 });
  }
  return clusters;
}

// ── Pulse animation injector ──────────────────────────────────────────────────

let _pulseInjected = false;
function injectPulseAnim() {
  if (_pulseInjected || typeof document === "undefined") return;
  _pulseInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes towerPulse {
      0%   { transform: scale(1);   opacity: 0.55; }
      60%  { transform: scale(2.4); opacity: 0.08; }
      100% { transform: scale(2.8); opacity: 0;    }
    }
    .tower-pulse-ring {
      position: absolute;
      border-radius: 50%;
      animation: towerPulse 2.2s ease-out infinite;
      pointer-events: none;
    }
    .tower-pulse-ring.delay1 { animation-delay: 0.7s; }
    .tower-pulse-ring.delay2 { animation-delay: 1.4s; }
    .tower-marker-wrap {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `;
  document.head.appendChild(style);
}

// ── Signal strength from Rx Level (dBm) ──────────────────────────────────────

function rxLevelToStrength(rxLevel?: number): "Strong" | "Medium" | "Weak" {
  if (rxLevel === undefined || rxLevel === null) return "Medium";
  if (rxLevel >= -70) return "Strong";
  if (rxLevel >= -85) return "Medium";
  return "Weak";
}

function signalStrengthColor(strength: "Strong" | "Medium" | "Weak"): string {
  return strength === "Strong" ? "#22c55e" : strength === "Medium" ? "#f59e0b" : "#ef4444";
}

// ── Tower ID generator ────────────────────────────────────────────────────────

function generateTowerId(ran: string, band: string, lat: number, lng: number): string {
  // Deterministic short ID from RAN + Band + grid position
  const gridLat = Math.abs(Math.round(lat * 10)) % 1000;
  const gridLng = Math.abs(Math.round(lng * 10)) % 1000;
  const prefix = ran && ran !== "UNK" ? ran.slice(0, 3).toUpperCase() : "TWR";
  return `${prefix}-${String(gridLat).padStart(3, "0")}${String(gridLng).padStart(3, "0")}`;
}

// ── SVG antenna tower icon ────────────────────────────────────────────────────

function makeTowerIcon(
  color: string,
  count: number,
  congested: boolean,
  network: string,
  rxStrength: "Strong" | "Medium" | "Weak",
  towerId: string,
) {
  injectPulseAnim();

  const sigColor = signalStrengthColor(rxStrength);
  const pulseColor = congested ? "#ef4444" : color;
  const glowColor = congested ? "rgba(239,68,68,0.5)" : `${color}80`;
  const size = 48;
  const halfSize = size / 2;

  // Antenna SVG — tower structure with signal arcs
  const antennaSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
      <!-- Outer glow ring -->
      <circle cx="24" cy="24" r="22" fill="${color}18" stroke="${color}50" stroke-width="1"/>
      <!-- Main circle background -->
      <circle cx="24" cy="24" r="18" fill="${color}" stroke="${congested ? "#ef4444" : "rgba(255,255,255,0.8)"}" stroke-width="${congested ? 2.5 : 1.5}"/>
      <!-- Tower mast (vertical line) -->
      <line x1="24" y1="10" x2="24" y2="34" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <!-- Tower base legs -->
      <line x1="24" y1="34" x2="16" y2="40" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="24" y1="34" x2="32" y2="40" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Cross braces -->
      <line x1="19" y1="26" x2="29" y2="26" stroke="white" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="20" y1="32" x2="28" y2="32" stroke="white" stroke-width="1.2" stroke-linecap="round"/>
      <!-- Antenna tip -->
      <circle cx="24" cy="9" r="2.5" fill="${sigColor}" stroke="white" stroke-width="1"/>
      <!-- Signal arcs (left) -->
      <path d="M 18 14 A 8 8 0 0 0 18 22" stroke="${sigColor}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.9"/>
      <path d="M 15 11 A 12 12 0 0 0 15 25" stroke="${sigColor}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.6"/>
      <!-- Signal arcs (right) -->
      <path d="M 30 14 A 8 8 0 0 1 30 22" stroke="${sigColor}" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.9"/>
      <path d="M 33 11 A 12 12 0 0 1 33 25" stroke="${sigColor}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.6"/>
      <!-- Congestion badge -->
      ${congested ? `<circle cx="38" cy="10" r="6" fill="#ef4444" stroke="white" stroke-width="1.5"/>
      <text x="38" y="14" text-anchor="middle" font-size="8" font-weight="700" fill="white">!</text>` : ""}
      <!-- User count badge -->
      <circle cx="38" cy="38" r="7" fill="${color}" stroke="white" stroke-width="1.5"/>
      <text x="38" y="42" text-anchor="middle" font-family="monospace" font-size="8" font-weight="700" fill="white">${count > 99 ? "99+" : count}</text>
    </svg>
  `;

  // Wrap with pulse rings + tower ID label
  const html = `
    <div class="tower-marker-wrap" style="width:${size}px;height:${size}px;">
      <div class="tower-pulse-ring" style="width:${size}px;height:${size}px;border:2px solid ${pulseColor};top:0;left:0;"></div>
      <div class="tower-pulse-ring delay1" style="width:${size}px;height:${size}px;border:2px solid ${pulseColor};top:0;left:0;"></div>
      ${antennaSvg}
      <div style="
        position:absolute;
        bottom:-18px;
        left:50%;
        transform:translateX(-50%);
        white-space:nowrap;
        font-size:9px;
        font-weight:700;
        font-family:monospace;
        color:${color};
        background:rgba(0,0,0,0.65);
        padding:1px 5px;
        border-radius:3px;
        border:1px solid ${color}60;
        letter-spacing:0.3px;
        pointer-events:none;
      ">${towerId}</div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "",
    iconSize: [size, size + 20],
    iconAnchor: [halfSize, halfSize],
    popupAnchor: [0, -(halfSize + 10)],
  });
}

function makeClusterIcon(count: number) {
  injectPulseAnim();
  const html = `
    <div class="tower-marker-wrap" style="width:46px;height:46px;">
      <div class="tower-pulse-ring" style="width:46px;height:46px;border:2px solid #11C1CA;top:0;left:0;"></div>
      <svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46">
        <circle cx="23" cy="23" r="21" fill="#0f172a" stroke="#11C1CA" stroke-width="2.5"/>
        <circle cx="23" cy="23" r="17" fill="#1e293b" stroke="#11C1CA40" stroke-width="1"/>
        <text x="23" y="19" text-anchor="middle" font-family="monospace" font-size="9" font-weight="700" fill="#11C1CA">CLUSTER</text>
        <text x="23" y="31" text-anchor="middle" font-family="monospace" font-size="13" font-weight="800" fill="white">${count}</text>
      </svg>
    </div>
  `;
  return L.divIcon({ html, className: "", iconSize: [46, 46], iconAnchor: [23, 23], popupAnchor: [0, -23] });
}

function makeCallerIcon(suspicious: boolean) {
  const color = suspicious ? "#ef4444" : "#3b82f6";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="28" viewBox="0 0 26 34">
    <path d="M13 0C5.82 0 0 5.82 0 13c0 9.1 13 21 13 21S26 22.1 26 13C26 5.82 20.18 0 13 0z" fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="13" cy="13" r="5" fill="white"/>
  </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [22, 28], iconAnchor: [11, 28], popupAnchor: [0, -28] });
}

// ── Map helpers ───────────────────────────────────────────────────────────────

function MapReset({ active }: { active: boolean }) {
  const map = useMap();
  const wasActive = useRef(active);
  useEffect(() => {
    if (wasActive.current && !active) map.setView([20.5937, 78.9629], 5, { animate: true });
    wasActive.current = active;
  }, [active, map]);
  return null;
}

function MapFit({ records, fitKey }: { records: TelecomRecord[]; fitKey: string }) {
  const map = useMap();
  const lastKey = useRef("");
  useEffect(() => {
    if (fitKey === lastKey.current || records.length === 0) return;
    lastKey.current = fitKey;
    const pts: [number, number][] = records
      .filter((r) => r.latitude && r.longitude)
      .map((r) => [r.latitude, r.longitude]);
    const bounds = L.latLngBounds(pts);
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13, animate: true });
  }, [fitKey, records, map]);
  return null;
}

// ── Network-map types (mirrors api/cdr.ts — no import needed, self-contained) ─

interface NMContact {
  msisdn: string;
  latitude: number;
  longitude: number;
  call_count: number;
  total_duration_sec: number;
  last_call_time: string;
  call_types: string[];
  nearest_tower_id: string | null;
  distance_to_tower_m: number | null;
  is_most_frequent: boolean;
}
interface NMTower {
  tower_id: string;
  latitude: number;
  longitude: number;
  network: string;
  ran: string;
  band: string;
  coverage_radius_m: number;
  color: string;
  user_count: number;
  connected_msisdns: string[];
}
interface NMConnection {
  from_msisdn: string;
  to_msisdn: string;
  call_count: number;
  total_duration_sec: number;
  call_types: string[];
  weight: number;
}
interface NetworkMapData {
  main_user: { msisdn: string; latitude: number; longitude: number; total_records: number; networks: string[]; operators: string[] };
  targets: NMContact[];
  connections: NMConnection[];
  towers: NMTower[];
}

// ── Network-map icons ─────────────────────────────────────────────────────────

function makeMainUserIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <path d="M16 0C7.16 0 0 7.16 0 16c0 11.2 16 24 16 24S32 27.2 32 16C32 7.16 24.84 0 16 0z" fill="#3b82f6" stroke="white" stroke-width="2.5"/>
    <circle cx="16" cy="16" r="7" fill="white"/>
    <circle cx="16" cy="16" r="4" fill="#3b82f6"/>
  </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [32, 40], iconAnchor: [16, 40], popupAnchor: [0, -40] });
}

function makeContactIcon(isMostFrequent: boolean, callCount: number) {
  const color = isMostFrequent ? "#f59e0b" : "#ef4444";
  const size = isMostFrequent ? 34 : 28;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size*1.25)}" viewBox="0 0 34 42">
    <path d="M17 0C7.61 0 0 7.61 0 17c0 11.9 17 25 17 25S34 28.9 34 17C34 7.61 26.39 0 17 0z" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="17" y="22" text-anchor="middle" font-family="monospace" font-size="11" font-weight="700" fill="white">${callCount > 99 ? "99+" : callCount}</text>
  </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [size, Math.round(size*1.25)], iconAnchor: [size/2, Math.round(size*1.25)], popupAnchor: [0, -Math.round(size*1.25)] });
}

function makeNMTowerIcon(color: string, network: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
    <rect x="2" y="2" width="26" height="26" rx="4" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="15" y="19" text-anchor="middle" font-family="monospace" font-size="9" font-weight="700" fill="white">${network}</text>
  </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15] });
}

// ── Network-map fit helper ────────────────────────────────────────────────────

function NetworkMapFit({ data }: { data: NetworkMapData | null }) {
  const map = useMap();
  const lastKey = useRef("");
  useEffect(() => {
    if (!data) return;
    const key = data.main_user.msisdn + data.targets.length;
    if (key === lastKey.current) return;
    lastKey.current = key;
    const pts: [number, number][] = [
      [data.main_user.latitude, data.main_user.longitude],
      ...data.targets.map((t): [number, number] => [t.latitude, t.longitude]),
    ].filter((point): point is [number, number] => point[0] !== 0 && point[1] !== 0);
    const bounds = L.latLngBounds(pts);
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13, animate: true });
  }, [data, map]);
  return null;
}

// ── Animated dash offset (CSS keyframe injected once) ────────────────────────
let _animInjected = false;
function injectConnectionAnim() {
  if (_animInjected || typeof document === "undefined") return;
  _animInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes dashFlow { to { stroke-dashoffset: -20; } }
    .nm-conn-line { animation: dashFlow 1.2s linear infinite; }
  `;
  document.head.appendChild(style);
}

// ── Animated polyline via raw Leaflet (react-leaflet Polyline can't animate) ─

function AnimatedConnectionLines({
  connections, mainLat, mainLng, targets,
}: {
  connections: NMConnection[];
  mainLat: number;
  mainLng: number;
  targets: NMContact[];
}) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    injectConnectionAnim();
    if (layerRef.current) { map.removeLayer(layerRef.current); }
    const group = L.layerGroup().addTo(map);
    layerRef.current = group;

    const targetMap = new Map(targets.map((t) => [t.msisdn, t]));

    connections.forEach((conn) => {
      const tgt = targetMap.get(conn.to_msisdn);
      if (!tgt || !tgt.latitude || !tgt.longitude) return;

      const weight = 1.5 + conn.weight * 5;          // 1.5–6.5 px
      const color = conn.weight > 0.7 ? "#f59e0b" : conn.weight > 0.4 ? "#3b82f6" : "#94a3b8";
      const dashLen = Math.round(8 - conn.weight * 5); // shorter dash = more frequent

      const line = L.polyline(
        [[mainLat, mainLng], [tgt.latitude, tgt.longitude]],
        { color, weight, opacity: 0.75, dashArray: `${dashLen} 4` }
      );
      // Add CSS class for animation via pane element
      line.on("add", () => {
        const el = (line as any)._path as SVGPathElement | undefined;
        if (el) el.classList.add("nm-conn-line");
      });
      line.addTo(group);
    });

    return () => { map.removeLayer(group); };
  }, [connections, mainLat, mainLng, targets, map]);

  return null;
}

// ── Layer toggles ─────────────────────────────────────────────────────────────

interface LayerState {
  towers: boolean;
  coverage: boolean;
  callers: boolean;
  connections: boolean;
  heatmap: boolean;
  // network-map layers
  nmContacts: boolean;
  nmConnections: boolean;
  nmTowers: boolean;
  nmCoverage: boolean;
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  records: TelecomRecord[];
  selectedRecord: TelecomRecord | null;
  msisdnFilter: string;
  onSelect: (id: string) => void;
  onFocusTarget?: (number: string) => void;
  /** Optional pre-fetched network-map data (from GET /cdr/network-map) */
  networkMapData?: NetworkMapData | null;
};

export default function TelecomMapPanel({ records, selectedRecord, msisdnFilter, onSelect, onFocusTarget, networkMapData = null }: Props) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";
  const msisdnActive = msisdnFilter.trim().length > 0;

  const [layers, setLayers] = useState<LayerState>({
    towers: true,
    coverage: true,
    callers: true,
    connections: true,
    heatmap: false,
    nmContacts: true,
    nmConnections: true,
    nmTowers: true,
    nmCoverage: true,
  });

  const toggleLayer = (key: keyof LayerState) =>
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  const mapRecords = useMemo(() => (msisdnActive ? records : []), [msisdnActive, records]);
  const fitKey = useMemo(() => mapRecords.map((r) => r.id).join(",").slice(0, 200), [mapRecords]);

  // Build virtual towers from filtered records
  const towers = useMemo(() => buildTowers(mapRecords), [mapRecords]);
  const clusters = useMemo(() => clusterTowers(towers), [towers]);

  // Heatmap cells
  const heatCells = useMemo(() => {
    const cells = new Map<string, { lat: number; lng: number; weight: number }>();
    for (const r of mapRecords) {
      if (!r.latitude || !r.longitude) continue;
      const key = `${r.latitude.toFixed(2)},${r.longitude.toFixed(2)}`;
      if (!cells.has(key)) cells.set(key, { lat: parseFloat(r.latitude.toFixed(2)), lng: parseFloat(r.longitude.toFixed(2)), weight: 0 });
      cells.get(key)!.weight += 1;
    }
    return [...cells.values()];
  }, [mapRecords]);

  const maxHeat = useMemo(() => Math.max(1, ...heatCells.map((c) => c.weight)), [heatCells]);

  // Stats
  const congestedCount = towers.filter((t) => t.isCongested).length;

  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const panelBg = isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.95)";
  const borderColor = "rgba(17,193,202,0.35)";
  const textSec = isDark ? "#94a3b8" : "#64748b";

  return (
    <div style={{ position: "relative", width: "100%", height: 480, borderRadius: 10, overflow: "hidden", border: `1px solid ${borderColor}` }}>
      <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ width: "100%", height: "100%" }} zoomControl>
        <TileLayer url={tileUrl} attribution="" />
        <MapReset active={msisdnActive} />
        {msisdnActive && <MapFit records={mapRecords} fitKey={fitKey} />}

        {/* ── Heatmap density overlay ── */}
        {layers.heatmap && heatCells.map((cell) => {
          const opacity = 0.08 + 0.35 * (cell.weight / maxHeat);
          const hue = Math.round(240 - 240 * (cell.weight / maxHeat)); // blue→red
          return (
            <Circle
              key={`heat-${cell.lat}-${cell.lng}`}
              center={[cell.lat, cell.lng]}
              radius={600}
              pathOptions={{ color: "transparent", fillColor: `hsl(${hue},90%,55%)`, fillOpacity: opacity, weight: 0 }}
            />
          );
        })}

        {/* ── Coverage circles ── */}
        {layers.coverage && towers.map((t) => (
          <Circle
            key={`cov-${t.towerId}`}
            center={[t.lat, t.lng]}
            radius={t.coverageRadius}
            pathOptions={{
              color: t.isCongested ? "#ef4444" : t.color,
              weight: t.isCongested ? 2.5 : 1.5,
              opacity: 0.8,
              fillColor: t.isCongested ? "#ef4444" : t.color,
              fillOpacity: t.isCongested ? 0.14 : 0.08,
              dashArray: t.isCongested ? "6 4" : undefined,
            }}
          />
        ))}

        {/* ── User ↔ Tower connection lines ── */}
        {layers.connections && mapRecords.map((r) => {
          if (!r.latitude || !r.longitude) return null;
          // Find nearest tower
          let nearest: VirtualTower | null = null;
          let minDist = Infinity;
          for (const t of towers) {
            const d = haversineM(r.latitude, r.longitude, t.lat, t.lng);
            if (d < minDist) { minDist = d; nearest = t; }
          }
          if (!nearest) return null;
          const strength = signalStrength(minDist);
          const weight = signalLineWeight(strength);
          const color = strength === "Strong" ? "#22c55e" : strength === "Medium" ? "#f59e0b" : "#ef4444";
          const isSelected = selectedRecord?.id === r.id;
          return (
            <Polyline
              key={`conn-${r.id}`}
              positions={[[r.latitude, r.longitude], [nearest.lat, nearest.lng]]}
              pathOptions={{ color, weight: isSelected ? weight + 1.5 : weight, opacity: isSelected ? 0.9 : 0.45 }}
            />
          );
        })}

        {/* ── Tower markers (clustered) ── */}
        {layers.towers && clusters.map((cluster, ci) => {
          if (cluster.isMerged) {
            // Merged cluster node
            const totalUsers = cluster.towers.reduce((s, t) => s + t.userCount, 0);
            const networks = [...new Set(cluster.towers.map((t) => t.network))].join(", ");
            return (
              <Marker
                key={`cluster-${ci}`}
                position={[cluster.lat, cluster.lng]}
                icon={makeClusterIcon(cluster.towers.length)}
              >
                <Popup>
                  <div style={{ fontSize: 12, lineHeight: 1.8, minWidth: 180 }}>
                    <strong style={{ color: "#11C1CA" }}>Tower Cluster ({cluster.towers.length} towers)</strong><br />
                    Networks: {networks}<br />
                    Total users: {totalUsers}<br />
                    {cluster.towers.some((t) => t.isCongested) && (
                      <span style={{ color: "#ef4444", fontWeight: 700 }}>⚠ Congestion detected</span>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          }

          const t = cluster.towers[0];
          return (
            <Marker
              key={`tower-${t.towerId}`}
              position={[t.lat, t.lng]}
              icon={makeTowerIcon(t.color, t.userCount, t.isCongested, t.network, t.rxStrength, t.towerLabel)}
            >
              <Popup>
                <div style={{ fontSize: 12, lineHeight: 1.9, minWidth: 220 }}>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, paddingBottom: 5, borderBottom: `1px solid ${t.color}40` }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.color, boxShadow: `0 0 6px ${t.color}` }} />
                    <strong style={{ color: t.color, fontSize: 13 }}>{t.towerLabel}</strong>
                    <span style={{ fontSize: 10, background: `${t.color}20`, color: t.color, border: `1px solid ${t.color}50`, borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>
                      {t.network}
                    </span>
                    {t.isCongested && (
                      <span style={{ fontSize: 10, background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid #ef444450", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>
                        ⚠ CONGESTED
                      </span>
                    )}
                  </div>
                  {/* Technical info */}
                  <span style={{ color: textSec }}>Operator: </span><strong>{t.operators.join(", ") || "—"}</strong><br />
                  <span style={{ color: textSec }}>Network: </span><strong>{t.network}</strong> &nbsp;|&nbsp;
                  <span style={{ color: textSec }}>Band: </span><strong>{t.band}</strong><br />
                  <span style={{ color: textSec }}>RAN: </span>{t.ran}
                  {t.arfcn !== undefined && <> &nbsp;|&nbsp; <span style={{ color: textSec }}>ARFCN: </span><strong>{t.arfcn}</strong></>}<br />
                  {/* Rx Level */}
                  <span style={{ color: textSec }}>Rx Level: </span>
                  <strong style={{ color: signalStrengthColor(t.rxStrength) }}>
                    {t.rxLevel !== undefined ? `${t.rxLevel} dBm` : "—"}
                    {" "}({t.rxStrength})
                  </strong><br />
                  {/* Signal strength visual bar */}
                  <div style={{ margin: "4px 0 6px", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: textSec, fontSize: 11 }}>Signal: </span>
                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: t.rxStrength === "Strong" ? "90%" : t.rxStrength === "Medium" ? "55%" : "25%",
                        background: signalStrengthColor(t.rxStrength),
                        borderRadius: 3,
                        boxShadow: `0 0 6px ${signalStrengthColor(t.rxStrength)}`,
                      }} />
                    </div>
                  </div>
                  {/* Location */}
                  <span style={{ color: textSec }}>Location: </span>{t.place}<br />
                  <span style={{ color: textSec }}>Coords: </span>{t.lat.toFixed(4)}, {t.lng.toFixed(4)}<br />
                  {/* Stats */}
                  <span style={{ color: textSec }}>Connected users: </span><strong>{t.userCount}</strong><br />
                  <span style={{ color: textSec }}>Avg duration: </span>{Math.floor(t.avgDurationSec / 60)}m {t.avgDurationSec % 60}s<br />
                  <span style={{ color: textSec }}>Load: </span>
                  <span style={{ color: t.isCongested ? "#ef4444" : "#22c55e", fontWeight: 700 }}>
                    {t.loadPct}%
                  </span><br />
                  <span style={{ color: textSec }}>Coverage: </span>{(t.coverageRadius / 1000).toFixed(2)} km radius
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* ── Caller markers ── */}
        {layers.callers && mapRecords.map((r) => {
          if (!r.latitude || !r.longitude) return null;
          const suspicious = r.fake || r.silentCallType !== "None";
          return (
            <Marker
              key={`caller-${r.id}`}
              position={[r.latitude, r.longitude]}
              icon={makeCallerIcon(suspicious)}
              eventHandlers={{ click: () => onSelect(r.id) }}
            >
              <Popup>
                <div style={{ fontSize: 12, lineHeight: 1.8, minWidth: 170 }}>
                  <strong style={{ color: "#3b82f6" }}>{r.msisdn}</strong><br />
                  <span style={{ color: textSec }}>→ Target: </span>
                  <span style={{ color: "#22c55e", cursor: onFocusTarget ? "pointer" : "default", fontWeight: 600 }} onClick={() => onFocusTarget?.(r.target)}>
                    {r.target || "—"}
                  </span><br />
                  {r.callType} · {Math.floor(r.duration / 60)}m {r.duration % 60}s<br />
                  {r.operator} · {r.network}<br />
                  {r.fake && <span style={{ color: "#ef4444", fontWeight: 700 }}>⚠ FAKE SIGNAL<br /></span>}
                  {r.silentCallType !== "None" && <span style={{ color: "#f59e0b", fontWeight: 700 }}>👁 {r.silentCallType}<br /></span>}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* ════════════════════════════════════════════════════════════════════
            NETWORK-MAP OVERLAY — multi-contact geo mapping + tower distance
            Rendered on top of existing layers; only active when data provided
            ════════════════════════════════════════════════════════════════ */}
        {networkMapData && (
          <>
            <NetworkMapFit data={networkMapData} />

            {/* Animated connection lines: main user → each contact */}
            {layers.nmConnections && (
              <AnimatedConnectionLines
                connections={networkMapData.connections}
                mainLat={networkMapData.main_user.latitude}
                mainLng={networkMapData.main_user.longitude}
                targets={networkMapData.targets}
              />
            )}

            {/* Tower coverage circles */}
            {layers.nmCoverage && networkMapData.towers.map((t) => (
              <Circle
                key={`nm-cov-${t.tower_id}`}
                center={[t.latitude, t.longitude]}
                radius={t.coverage_radius_m}
                pathOptions={{ color: t.color, weight: 1.5, opacity: 0.6, fillColor: t.color, fillOpacity: 0.06 }}
              />
            ))}

            {/* Tower markers */}
            {layers.nmTowers && networkMapData.towers.map((t) => (
              <Marker
                key={`nm-tower-${t.tower_id}`}
                position={[t.latitude, t.longitude]}
                icon={makeNMTowerIcon(t.color, t.network)}
              >
                <Popup>
                  <div style={{ fontSize: 12, lineHeight: 1.9, minWidth: 210 }}>
                    <strong style={{ color: t.color }}>📡 {t.tower_id}</strong><br />
                    <span style={{ color: textSec }}>Network: </span><strong>{t.network}</strong><br />
                    <span style={{ color: textSec }}>RAN: </span>{t.ran} · <span style={{ color: textSec }}>Band: </span>{t.band}<br />
                    <span style={{ color: textSec }}>Coverage: </span>{(t.coverage_radius_m / 1000).toFixed(2)} km<br />
                    <span style={{ color: textSec }}>Connected users: </span><strong>{t.user_count}</strong><br />
                    {t.connected_msisdns.length > 0 && (
                      <><span style={{ color: textSec }}>Numbers: </span>{t.connected_msisdns.slice(0, 3).join(", ")}{t.connected_msisdns.length > 3 ? ` +${t.connected_msisdns.length - 3}` : ""}</>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Main user marker — blue pin */}
            {networkMapData.main_user.latitude !== 0 && (
              <Marker
                position={[networkMapData.main_user.latitude, networkMapData.main_user.longitude]}
                icon={makeMainUserIcon()}
              >
                <Popup>
                  <div style={{ fontSize: 12, lineHeight: 1.9, minWidth: 200 }}>
                    <strong style={{ color: "#3b82f6", fontSize: 13 }}>👤 {networkMapData.main_user.msisdn}</strong><br />
                    <span style={{ color: textSec }}>Records: </span><strong>{networkMapData.main_user.total_records}</strong><br />
                    <span style={{ color: textSec }}>Networks: </span>{networkMapData.main_user.networks.join(", ")}<br />
                    <span style={{ color: textSec }}>Operators: </span>{networkMapData.main_user.operators.join(", ")}<br />
                    <span style={{ color: textSec }}>Contacts: </span><strong>{networkMapData.targets.length}</strong>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Contact markers — red/amber pins with call count badge */}
            {layers.nmContacts && networkMapData.targets.map((tgt) => {
              if (!tgt.latitude || !tgt.longitude) return null;
              const distStr = tgt.distance_to_tower_m !== null
                ? tgt.distance_to_tower_m >= 1000
                  ? `${(tgt.distance_to_tower_m / 1000).toFixed(2)} km`
                  : `${Math.round(tgt.distance_to_tower_m)} m`
                : "—";
              const durMin = Math.floor(tgt.total_duration_sec / 60);
              const durSec = tgt.total_duration_sec % 60;
              return (
                <Marker
                  key={`nm-contact-${tgt.msisdn}`}
                  position={[tgt.latitude, tgt.longitude]}
                  icon={makeContactIcon(tgt.is_most_frequent, tgt.call_count)}
                  eventHandlers={{ click: () => onFocusTarget?.(tgt.msisdn) }}
                >
                  <Popup>
                    <div style={{ fontSize: 12, lineHeight: 1.9, minWidth: 210 }}>
                      <strong style={{ color: tgt.is_most_frequent ? "#f59e0b" : "#ef4444", fontSize: 13 }}>
                        {tgt.is_most_frequent ? "⭐ " : ""}📞 {tgt.msisdn}
                      </strong><br />
                      <span style={{ color: textSec }}>Calls: </span><strong>{tgt.call_count}</strong>
                      {tgt.is_most_frequent && <span style={{ color: "#f59e0b", fontWeight: 700 }}> (Most frequent)</span>}<br />
                      <span style={{ color: textSec }}>Total duration: </span>{durMin}m {durSec}s<br />
                      <span style={{ color: textSec }}>Last call: </span>{tgt.last_call_time ? new Date(tgt.last_call_time).toLocaleString() : "—"}<br />
                      <span style={{ color: textSec }}>Types: </span>{tgt.call_types.join(", ")}<br />
                      <span style={{ color: textSec }}>Location: </span>{tgt.latitude.toFixed(4)}, {tgt.longitude.toFixed(4)}<br />
                      <span style={{ color: textSec }}>Nearest tower: </span>{tgt.nearest_tower_id ?? "—"}<br />
                      <span style={{ color: textSec }}>Tower distance: </span><strong style={{ color: "#11C1CA" }}>{distStr}</strong>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </>
        )}
      </MapContainer>

      {/* ── Empty state ── */}
      {!msisdnActive && !networkMapData && (
        <div style={{ position: "absolute", inset: 0, zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: isDark ? "rgba(15,23,42,0.72)" : "rgba(248,250,252,0.75)", backdropFilter: "blur(4px)", pointerEvents: "none" }}>
          <div style={{ fontSize: 32 }}>🗼</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#11C1CA" }}>Enter MSISDN to visualize towers</div>
          <div style={{ fontSize: 12, color: textSec, textAlign: "center", maxWidth: 280 }}>
            Type a mobile number to plot virtual cell towers, coverage areas, and user connections.
          </div>
        </div>
      )}

      {/* ── Layer toggles — split into existing / network-map groups ── */}
      {(msisdnActive || networkMapData) && (
        <div style={{ position: "absolute", top: 10, left: 10, zIndex: 1000, display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Existing layers */}
          {(["towers", "coverage", "callers", "connections", "heatmap"] as (keyof LayerState)[]).map((key) => (
            <button key={key} onClick={() => toggleLayer(key)}
              style={{ padding: "3px 9px", fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: "pointer",
                background: layers[key] ? "rgba(17,193,202,0.18)" : panelBg,
                border: `1px solid ${layers[key] ? "rgba(17,193,202,0.6)" : borderColor}`,
                color: layers[key] ? "#11C1CA" : textSec }}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
          {/* Network-map layers — only shown when data present */}
          {networkMapData && (
            <>
              <div style={{ height: 4 }} />
              {([
                ["nmContacts",    "NM: Contacts"],
                ["nmConnections", "NM: Lines"],
                ["nmTowers",      "NM: Towers"],
                ["nmCoverage",    "NM: Coverage"],
              ] as [keyof LayerState, string][]).map(([key, label]) => (
                <button key={key} onClick={() => toggleLayer(key)}
                  style={{ padding: "3px 9px", fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: "pointer",
                    background: layers[key] ? "rgba(239,68,68,0.18)" : panelBg,
                    border: `1px solid ${layers[key] ? "rgba(239,68,68,0.6)" : borderColor}`,
                    color: layers[key] ? "#ef4444" : textSec }}>
                  {label}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Stats badge ── */}
      <div style={{ position: "absolute", top: 10, right: 10, zIndex: 1000, background: panelBg, border: `1px solid ${borderColor}`, borderRadius: 6, padding: "5px 11px", fontSize: 11, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ color: "#11C1CA", fontWeight: 700 }}>{towers.length} towers · {mapRecords.length} records</span>
        {congestedCount > 0 && <span style={{ color: "#ef4444", fontWeight: 600 }}>⚠ {congestedCount} congested</span>}
        {networkMapData && (
          <span style={{ color: "#ef4444", fontWeight: 700 }}>
            🗺 {networkMapData.targets.length} contacts · {networkMapData.connections.length} links
          </span>
        )}
      </div>

      {/* ── Legend ── */}
      {(msisdnActive || networkMapData) && (
        <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 1000, background: panelBg, border: `1px solid ${borderColor}`, borderRadius: 8, padding: "10px 14px", fontSize: 11, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ fontWeight: 800, fontSize: 10, color: "#11C1CA", letterSpacing: "0.6px", marginBottom: 2 }}>NETWORK TYPE</div>
          {[
            { color: "#22c55e", label: "🟢 4G" },
            { color: "#a855f7", label: "🟣 5G" },
            { color: "#3b82f6", label: "🔵 LTE" },
            { color: "#f97316", label: "🟠 3G" },
            { color: "#ef4444", label: "🔴 Congested" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 4px ${color}` }} />
              <span style={{ color: textSec }}>{label}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${borderColor}`, margin: "3px 0" }} />
          <div style={{ fontWeight: 800, fontSize: 10, color: "#11C1CA", letterSpacing: "0.6px", marginBottom: 2 }}>SIGNAL STRENGTH (Rx Level)</div>
          {[
            { color: "#22c55e", label: "Strong (≥ −70 dBm)" },
            { color: "#f59e0b", label: "Medium (−70 to −85)" },
            { color: "#ef4444", label: "Weak (< −85 dBm)" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 20, height: 2, background: color, borderRadius: 1 }} />
              <span style={{ color: textSec }}>{label}</span>
            </div>
          ))}
          {networkMapData && (
            <>
              <div style={{ borderTop: `1px solid ${borderColor}`, margin: "3px 0" }} />
              <div style={{ fontWeight: 800, fontSize: 10, color: "#11C1CA", letterSpacing: "0.6px", marginBottom: 2 }}>NETWORK MAP</div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#3b82f6", border: "2px solid white" }} />
                <span style={{ color: textSec }}>Main user</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
                <span style={{ color: textSec }}>Contact</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
                <span style={{ color: textSec }}>Most frequent</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 20, height: 2, background: "#f59e0b", borderRadius: 1 }} />
                <span style={{ color: textSec }}>High-freq link</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 20, height: 2, background: "#94a3b8", borderRadius: 1 }} />
                <span style={{ color: textSec }}>Low-freq link</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
