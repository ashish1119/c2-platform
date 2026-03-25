export type SavedMapView = {
  center: [number, number];
  zoom: number;
};

export type DrawShapeType = "polygon" | "polyline" | "circle";

export type PersistedDrawShape = {
  type: DrawShapeType | "marker";
  color?: string;
  points?: Array<[number, number]>;
  center?: [number, number];
  radiusM?: number;
  bookmarkText?: string;
  createdAt?: string;
};

export type AssetTypeSettings = {
  label: string;
  symbol: string;
  shape: "circle" | "hex" | "diamond" | "square" | "shield" | "triangle";
  markerColor: string;
  markerSize: number;
};

export type BaseMapOption = {
  id: string;
  label: string;
  url: string;
  darkUrl?: string;
  attribution: string;
  subdomains?: string | string[];
  maxZoom?: number;
  useDarkFilter?: boolean;
  requiresQuadKey?: boolean;
};

export const DELHI_CENTER: [number, number] = [28.7041, 77.1025];
export const MAP_SAVED_VIEW_KEY = "ui.operator.map.savedView";
export const DRAW_SHAPES_STORAGE_KEY = "ui.operator.map.drawShapes.v1";
export const MAP_NODE_LABELS_VISIBLE_KEY = "ui.operator.map.nodeLabelsVisible";
export const JAMMER_POPUP_ALPHA_KEY = "ui.operator.map.jammerPopupAlpha";
export const JAMMER_RANGE_COLOR_KEY = "ui.operator.map.jammerRangeColor";
export const DF_RANGE_COLOR_KEY = "ui.operator.map.dfRangeColor";
export const DEFAULT_JAMMER_POPUP_ALPHA = 0.5;
export const DEFAULT_JAMMER_RANGE_COLOR = "#ef4444";
export const DEFAULT_DF_RANGE_COLOR = "#2563eb";
export const MIN_JAMMER_POPUP_ALPHA = 0.2;
export const MAX_JAMMER_POPUP_ALPHA = 0.95;
export const JAMMER_RANGE_SPOKE_COUNT = 12;
export const JAMMER_SIGNAL_RING_COUNT = 6;
export const JAMMER_SIGNAL_PULSE_STEPS = 5;
export const TCP_DF_LINE_DISTANCE_METERS = 10_000;
export const OFFLINE_LOCAL_TILE_URL =
  (((import.meta as any).env?.VITE_OFFLINE_TILE_URL as string | undefined)?.trim() || "/tiles/{z}/{x}/{y}.png");
export const OFFLINE_GRID_TILE_DATA_URI =
  "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256' viewBox='0 0 256 256'%3E%3Crect width='256' height='256' fill='%23f8fafc'/%3E%3Cpath d='M0 0H256M0 64H256M0 128H256M0 192H256M0 255H256M0 0V256M64 0V256M128 0V256M192 0V256M255 0V256' stroke='%23d1d5db' stroke-width='1'/%3E%3Ctext x='128' y='132' text-anchor='middle' font-family='Arial,sans-serif' font-size='14' fill='%236b7280'%3EOFFLINE%3C/text%3E%3C/svg%3E";

export const ASSET_TYPE_SETTINGS: Record<string, AssetTypeSettings> = {
  C2_NODE: { label: "C2 Node", symbol: "C2", shape: "hex", markerColor: "#1d4ed8", markerSize: 34 },
  RELAY: { label: "Relay", symbol: "R", shape: "square", markerColor: "#0d9488", markerSize: 32 },
  EO_SENSOR: { label: "EO Sensor", symbol: "EO", shape: "diamond", markerColor: "#7c3aed", markerSize: 32 },
  RADAR: { label: "Radar", symbol: "RD", shape: "triangle", markerColor: "#f97316", markerSize: 32 },
  SENSOR: { label: "Sensor", symbol: "S", shape: "circle", markerColor: "#16a34a", markerSize: 30 },
  DIRECTION_FINDER: { label: "Direction Finder", symbol: "DF", shape: "shield", markerColor: "#2563eb", markerSize: 34 },
  JAMMER: { label: "Jammer", symbol: "J", shape: "circle", markerColor: "#ca8a04", markerSize: 32 },
};

export const ASSET_TYPE_ORDER = [
  "C2_NODE",
  "RELAY",
  "EO_SENSOR",
  "RADAR",
  "SENSOR",
  "DIRECTION_FINDER",
  "JAMMER",
];

export const DEFAULT_ASSET_TYPE_SETTINGS: AssetTypeSettings = {
  label: "Asset",
  symbol: "A",
  shape: "circle",
  markerColor: "#334155",
  markerSize: 28,
};

export const TRIANGULATION_RAY_COLORS = ["#ef4444", "#0ea5e9", "#22c55e", "#f59e0b", "#e11d48", "#8b5cf6", "#14b8a6"];

export const MODULE_ID_OPTIONS = ["1", "2", "3", "4"];
export const GAIN_OPTIONS = Array.from({ length: 35 }, (_, index) => String(index + 1));
export const JAMMING_CODE_OPTIONS: Array<{ code: number; name: string }> = [
  { code: 0, name: "CW" },
  { code: 1, name: "TBS_868" },
  { code: 2, name: "TBS_915" },
  { code: 3, name: "TBS_868+915" },
  { code: 4, name: "ELRS_868" },
  { code: 5, name: "ELRS_915" },
  { code: 6, name: "ELRS_2450_A" },
  { code: 7, name: "ELRS_868+915" },
  { code: 8, name: "TBS+ELRS_A" },
  { code: 9, name: "GNSS_70M" },
  { code: 10, name: "OFDM_5M" },
  { code: 11, name: "OFDM_10M" },
  { code: 12, name: "OFDM_20M" },
  { code: 13, name: "OFDM_70M" },
  { code: 14, name: "OFDM_100M" },
  { code: 15, name: "OFDM_150M" },
  { code: 16, name: "OFDM_140M" },
  { code: 17, name: "OFDM_200M" },
  { code: 18, name: "LFM_5M" },
  { code: 19, name: "LFM_10M" },
];

export type JammerPopupControlState = {
  moduleId: string;
  jammingCode: string;
  frequency: string;
  gain: string;
};

export const DEFAULT_JAMMER_POPUP_CONTROL_STATE: JammerPopupControlState = {
  moduleId: "1",
  jammingCode: "0",
  frequency: "",
  gain: "35",
};

export const BASE_MAP_OPTIONS: BaseMapOption[] = [
  {
    id: "osm",
    label: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    subdomains: ["a", "b", "c"],
    maxZoom: 19,
    useDarkFilter: true,
  },
  {
    id: "opentopo",
    label: "OpenTopoMap",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap",
    subdomains: ["a", "b", "c"],
    maxZoom: 17,
    useDarkFilter: true,
  },
  {
    id: "google-road",
    label: "Google Road",
    url: "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    attribution: "&copy; Google",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    maxZoom: 20,
    useDarkFilter: true,
  },
  {
    id: "google-sat",
    label: "Google Satellite",
    url: "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    attribution: "&copy; Google",
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    maxZoom: 20,
    useDarkFilter: true,
  },
  {
    id: "bing-road",
    label: "Bing Road",
    url: "https://ecn.t{s}.tiles.virtualearth.net/tiles/r{quadkey}.jpeg?g=129&n=z",
    attribution: "&copy; Microsoft Bing",
    subdomains: ["0", "1", "2", "3"],
    maxZoom: 19,
    useDarkFilter: true,
    requiresQuadKey: true,
  },
  {
    id: "carto",
    label: "Carto Positron",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    darkUrl: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    subdomains: ["a", "b", "c", "d"],
    maxZoom: 20,
  },
  {
    id: "offline-local",
    label: "Offline Local Tiles",
    url: OFFLINE_LOCAL_TILE_URL,
    attribution: "Offline local tiles",
    maxZoom: 20,
  },
  {
    id: "offline-blank",
    label: "Offline Grid",
    url: OFFLINE_GRID_TILE_DATA_URI,
    attribution: "Offline mode",
    maxZoom: 22,
  },
];
