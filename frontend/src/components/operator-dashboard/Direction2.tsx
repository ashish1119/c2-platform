
import { Fragment, useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polygon, Polyline, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Card from "../ui/Card";
import { useTheme } from "../../context/ThemeContext";
import type { AssetRecord } from "../../api/assets";
import type { TriangulationResult } from "../../api/rf";

type DirectionFinderPanelProps = {
  directionFinderAssets: AssetRecord[];
  triangulation?: TriangulationResult | null;
  triangulations?: TriangulationResult[];
};

type WsRf = {
  id: number;
  system_id: string;
  freq: number;
  power: number;
  snr: number;
  lat: number;
  lon: number;
  DOA?: number;
  timestamp: string;
};

type LatestBearingDetection = {
  id: string;
  source_node: string;
  latitude: number;
  longitude: number;
  doa_azimuth_deg: number;
  power_dbm: number;
  timestamp_utc: string;
};

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];
const SENSOR_COLORS = ["#ef4444", "#0ea5e9", "#22c55e", "#f59e0b"];

const resolveRfWsUrl = () => {
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${window.location.hostname}:8000/ws/rf`;
};

function normalizeBearing(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function destinationPoint(lat: number, lon: number, bearing: number, dist: number): [number, number] {
  const R = 6371000;
  const brng = (bearing * Math.PI) / 180;

  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dist / R) +
    Math.cos(lat1) * Math.sin(dist / R) * Math.cos(brng)
  );

  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(dist / R) * Math.cos(lat1),
      Math.cos(dist / R) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [(lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI];
}

export default function DirectionFinderPanel({
  directionFinderAssets,
  triangulation = null,
  triangulations = [],
}: DirectionFinderPanelProps) {
  const { theme } = useTheme();

  const [wsDetections, setWsDetections] = useState<Record<string, LatestBearingDetection>>({});

  // ------------------------
  // 📡 WEBSOCKET
  // ------------------------
  useEffect(() => {
    const ws = new WebSocket(resolveRfWsUrl());

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const rf: WsRf = msg.data ? msg.data : msg;

        if (!rf.freq || rf.DOA === undefined) return;

        const detection: LatestBearingDetection = {
          id: String(rf.id),
          source_node: rf.system_id,
          latitude: rf.lat,
          longitude: rf.lon,
          doa_azimuth_deg: rf.DOA,
          power_dbm: rf.power,
          timestamp_utc: rf.timestamp,
        };

        setWsDetections((prev) => ({
          ...prev,
          [rf.system_id]: detection,
        }));
      } catch (e) {
        console.error("WS error", e);
      }
    };

    return () => ws.close();
  }, []);

  const latestBearingDetections = useMemo(
    () => Object.values(wsDetections),
    [wsDetections]
  );

  const mapCenter: [number, number] =
    latestBearingDetections.length > 0
      ? [latestBearingDetections[0].latitude, latestBearingDetections[0].longitude]
      : DEFAULT_CENTER;

  const sensorColorById = useMemo(() => {
    const map = new Map<string, string>();
    latestBearingDetections.forEach((d, i) => {
      map.set(d.source_node, SENSOR_COLORS[i % SENSOR_COLORS.length]);
    });
    return map;
  }, [latestBearingDetections]);

  const bearingLines = useMemo(() => {
    return latestBearingDetections.map((d) => ({
      key: d.id,
      sensorId: d.source_node,
      sensorLabel: d.source_node,
      bearingDeg: d.doa_azimuth_deg,
      confidence: 1,
      positions: [
        [d.latitude, d.longitude],
        destinationPoint(d.latitude, d.longitude, d.doa_azimuth_deg, 8000),
      ],
    }));
  }, [latestBearingDetections]);

  return (
    <Card>
      <div style={{ display: "grid", gap: theme.spacing.md }}>
        <h3>Direction Finder (Live WS)</h3>

        <MapContainer center={mapCenter} zoom={12} style={{ height: 320 }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* Sensors */}
          {latestBearingDetections.map((d) => {
            const color = sensorColorById.get(d.source_node) || "red";
            return (
              <CircleMarker key={d.id} center={[d.latitude, d.longitude]} radius={6} pathOptions={{ color }}>
                <Popup>{d.source_node}</Popup>
              </CircleMarker>
            );
          })}

          {/* Bearings */}
          {bearingLines.map((line) => {
            const color = sensorColorById.get(line.sensorId) || "red";
            return (
              <Polyline key={line.key} positions={line.positions} pathOptions={{ color, weight: 3 }} />
            );
          })}
        </MapContainer>
      </div>
    </Card>
  );
}