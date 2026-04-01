import api from "./axios";

export interface TowerInfo {
  tower_id: string;
  latitude: number;
  longitude: number;
  network: string;
  ran: string;
  band: string;
  coverage_radius_m: number;
  color: string;
  user_count: number;
  avg_duration_sec: number;
  signal_strength: "Strong" | "Medium" | "Weak";
  is_congested: boolean;
  load_pct: number;
  operators: string[];
}

export interface TowerAggregationResponse {
  towers: TowerInfo[];
  total_records: number;
  total_towers: number;
}

export interface HeatCell {
  lat: number;
  lng: number;
  weight: number;
}

export const getTowers = (params?: { msisdn?: string; network?: string; limit?: number }) =>
  api.get<TowerAggregationResponse>("/cdr/towers", { params });

export const getTowerHeatmap = (params?: { msisdn?: string }) =>
  api.get<{ cells: HeatCell[] }>("/cdr/heatmap", { params });

// ── Network-map types ─────────────────────────────────────────────────────────

export interface MainUserInfo {
  msisdn: string;
  latitude: number;
  longitude: number;
  total_records: number;
  networks: string[];
  operators: string[];
}

export interface ContactInfo {
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

export interface ConnectionInfo {
  from_msisdn: string;
  to_msisdn: string;
  call_count: number;
  total_duration_sec: number;
  call_types: string[];
  weight: number;
}

export interface NetworkTowerInfo {
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

export interface NetworkMapResponse {
  main_user: MainUserInfo;
  targets: ContactInfo[];
  connections: ConnectionInfo[];
  towers: NetworkTowerInfo[];
}

export const getNetworkMap = (params: {
  msisdn: string;
  start_date?: string;
  end_date?: string;
}) => api.get<NetworkMapResponse>("/cdr/network-map", { params });

// ── Call-map types ────────────────────────────────────────────────────────────

export interface CallerInfo {
  msisdn: string;
  imsi: string | null;
  imei: string | null;
  operator: string | null;
  network: string | null;
  lat: number;
  lng: number;
  total_calls: number;
  total_duration_sec: number;
}

export interface ReceiverInfo {
  msisdn: string;
  lat: number;
  lng: number;
  city: string | null;
  operator: string | null;
  call_count: number;
  total_duration_sec: number;
  last_call_time: string;
  call_types: string[];
  is_most_frequent: boolean;
}

export interface CallConnection {
  from_msisdn: string;
  to_msisdn: string;
  lat1: number;
  lng1: number;
  lat2: number;
  lng2: number;
  count: number;
  total_duration_sec: number;
  weight: number;
}

export interface CallMapResponse {
  caller: CallerInfo;
  receivers: ReceiverInfo[];
  connections: CallConnection[];
}

export const getCallMap = (params: {
  msisdn: string;
  start_date?: string;
  end_date?: string;
}) => api.get<CallMapResponse>("/cdr/call-map", { params });

// ── Live ingestion types ──────────────────────────────────────────────────────

export interface LiveCdrRecord {
  msisdn: string;
  target?: string;
  latitude: number;
  longitude: number;
  receiver_latitude?: number;
  receiver_longitude?: number;
  start_time: string;
  end_time?: string;
  duration_sec?: number;
  call_type?: string;
  operator?: string;
  network?: string;
  band?: string;
  ran?: string;
  imsi?: string;
  imei?: string;
  place?: string;
  country?: string;
  is_fake?: boolean;
  silent_call_type?: string;
}

export interface LiveCdrEvent {
  type: "cdr_live";
  id: string;
  ts: string | null;
  caller: {
    msisdn: string;
    imsi: string | null;
    imei: string | null;
    operator: string | null;
    network: string | null;
    lat: number;
    lng: number;
    place: string | null;
  };
  receiver: {
    msisdn: string | null;
    lat: number;
    lng: number;
  };
  call: {
    call_type: string;
    duration_sec: number;
    start_time: string | null;
    band: string | null;
    ran: string | null;
  };
  alerts: {
    is_fake: boolean;
    silent_call_type: string;
  };
}

export const ingestLiveCdr = (records: LiveCdrRecord[]) =>
  api.post<{ inserted: number; total: number }>("/cdr/live", { records });

export const getRecentLive = (limit = 50) =>
  api.get<any[]>("/cdr/live/recent", { params: { limit } });

export function resolveCdrWsUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:8000/cdr/ws/live";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.hostname}:8000/cdr/ws/live`;
}

// ── /cdr/connections — per-call edge list ────────────────────────────────────

export interface ConnectionEdge {
  id: string;
  receiver: string;
  lat: number;
  lng: number;
  duration: number;
  timestamp: string;
  call_type: string;
  operator: string | null;
  network: string | null;
  is_fake: boolean;
  silent_call_type: string;
}

export interface ConnectionsResponse {
  caller: { msisdn: string; lat: number; lng: number };
  connections: ConnectionEdge[];
}

export const getConnections = (params: {
  msisdn: string;
  start?: string;
  end?: string;
}) => api.get<ConnectionsResponse>("/cdr/connections", { params });

// ── Network-graph types ───────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  type: "main" | "contact";
  total_calls: number;
  total_duration: number;
  operator: string | null;
  network: string | null;
  device: string | null;
  location: string | null;
  imsi: string | null;
  imei: string | null;
  suspicious: boolean;
  fake_count: number;
  silent_count: number;
}

export interface GraphLink {
  source: string;
  target: string;
  count: number;
  duration: number;
  suspicious: boolean;
  call_types: string[];
  weight: number;
}

export interface NetworkGraphResponse {
  nodes: GraphNode[];
  links: GraphLink[];
  center_msisdn: string;
  total_records: number;
}

export const getNetworkGraph = (params: {
  msisdn: string;
  start_date?: string;
  end_date?: string;
  operator?: string;
  network?: string;
  fake_only?: boolean;
}) => api.get<NetworkGraphResponse>("/cdr/network-graph", { params });

// ── Signal stats ──────────────────────────────────────────────────────────────

export interface RxPoint {
  timestamp: string;
  rx_level: number;
  network: string;
  operator: string | null;
}

export interface SignalStatsResponse {
  rx_timeline: RxPoint[];
  network_dist: { name: string; value: number; pct: number }[];
  band_dist: { band: string; count: number }[];
  avg_rx: number | null;
  strong_pct: number;
  medium_pct: number;
  weak_pct: number;
}

export const getSignalStats = (params: {
  msisdn?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}) => api.get<SignalStatsResponse>("/cdr/signal-stats", { params });

// ── Analytics summary ─────────────────────────────────────────────────────────

export interface HourBucket {
  hour: number;
  count: number;
}

export interface AnalyticsSummaryResponse {
  total_records: number;
  total_msisdns: number;
  total_targets: number;
  suspicious_count: number;
  fake_count: number;
  silent_count: number;
  peak_hour: number | null;
  peak_hour_count: number;
  hourly_dist: HourBucket[];
  most_contacted: string | null;
  most_contacted_count: number;
  avg_duration_sec: number;
  top_operator: string | null;
  top_network: string | null;
}

export const getAnalyticsSummary = (params: {
  msisdn?: string;
  start_date?: string;
  end_date?: string;
  operator?: string;
  network?: string;
}) => api.get<AnalyticsSummaryResponse>("/cdr/analytics-summary", { params });
