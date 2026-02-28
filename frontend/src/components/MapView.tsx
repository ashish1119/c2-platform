import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { AssetRecord } from "../api/assets";
import type { AlertRecord } from "../api/alerts";
import type { HeatCell, RFSignal, TriangulationResult } from "../api/rf";
import type { CoveragePoint } from "../api/planning";

type Props = {
  assets?: AssetRecord[];
  alerts?: AlertRecord[];
  signals?: RFSignal[];
  heatCells?: HeatCell[];
  coveragePoints?: CoveragePoint[];
  triangulation?: TriangulationResult | null;
  assetConnectionMode?: "none" | "mesh";
  mapHeight?: string;
};

const DELHI_CENTER: [number, number] = [28.7041, 77.1025];

type AssetTypeSettings = {
  label: string;
  symbol: string;
  shape: "circle" | "hex" | "diamond" | "square" | "shield" | "triangle";
  markerColor: string;
  markerSize: number;
};

const ASSET_TYPE_SETTINGS: Record<string, AssetTypeSettings> = {
  C2_NODE: { label: "C2 Node", symbol: "C2", shape: "hex", markerColor: "#1d4ed8", markerSize: 34 },
  RELAY: { label: "Relay", symbol: "R", shape: "square", markerColor: "#0d9488", markerSize: 32 },
  EO_SENSOR: { label: "EO Sensor", symbol: "EO", shape: "diamond", markerColor: "#7c3aed", markerSize: 32 },
  RADAR: { label: "Radar", symbol: "RD", shape: "triangle", markerColor: "#f97316", markerSize: 32 },
  SENSOR: { label: "Sensor", symbol: "S", shape: "circle", markerColor: "#16a34a", markerSize: 30 },
  DIRECTION_FINDER: { label: "Direction Finder", symbol: "DF", shape: "shield", markerColor: "#dc2626", markerSize: 34 },
  JAMMER: { label: "Jammer", symbol: "J", shape: "circle", markerColor: "#ca8a04", markerSize: 32 },
};

const ASSET_TYPE_ORDER = [
  "C2_NODE",
  "RELAY",
  "EO_SENSOR",
  "RADAR",
  "SENSOR",
  "DIRECTION_FINDER",
  "JAMMER",
];

const DEFAULT_ASSET_TYPE_SETTINGS: AssetTypeSettings = {
  label: "Asset",
  symbol: "A",
  shape: "circle",
  markerColor: "#334155",
  markerSize: 28,
};

function getAssetTypeSettings(assetType?: string | null): AssetTypeSettings {
  if (!assetType) {
    return DEFAULT_ASSET_TYPE_SETTINGS;
  }
  const normalized = assetType.trim().toUpperCase();
  return ASSET_TYPE_SETTINGS[normalized] ?? {
    label: assetType,
    symbol: normalized.slice(0, 2),
    markerColor: DEFAULT_ASSET_TYPE_SETTINGS.markerColor,
    markerSize: DEFAULT_ASSET_TYPE_SETTINGS.markerSize,
  };
}

function getShapeSvg(shape: AssetTypeSettings["shape"], size: number, color: string): string {
  const stroke = "#ffffff";
  const strokeWidth = 2;
  const mid = size / 2;
  const pad = 2;
  const max = size - pad;

  if (shape === "hex") {
    return `<polygon points="${mid},${pad} ${max - 6},${size * 0.28} ${max - 6},${size * 0.72} ${mid},${max} ${pad + 6},${size * 0.72} ${pad + 6},${size * 0.28}" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
  }

  if (shape === "diamond") {
    return `<polygon points="${mid},${pad} ${max},${mid} ${mid},${max} ${pad},${mid}" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
  }

  if (shape === "square") {
    return `<rect x="${pad}" y="${pad}" width="${size - pad * 2}" height="${size - pad * 2}" rx="7" ry="7" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
  }

  if (shape === "triangle") {
    return `<polygon points="${mid},${pad} ${max},${max - 2} ${pad},${max - 2}" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
  }

  if (shape === "shield") {
    return `<path d="M ${mid} ${pad} L ${max - 3} ${size * 0.24} L ${max - 5} ${size * 0.65} L ${mid} ${max} L ${pad + 5} ${size * 0.65} L ${pad + 3} ${size * 0.24} Z" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
  }

  return `<circle cx="${mid}" cy="${mid}" r="${size * 0.44}" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
}

function getZoomScale(zoom: number): number {
  const normalized = 0.75 + (zoom - 10) * 0.07;
  return Math.max(0.7, Math.min(1.35, normalized));
}

function buildAssetIcon(settings: AssetTypeSettings, status: string, zoom: number): L.Icon {
  const isActive = String(status).toUpperCase() === "ACTIVE";
  const opacity = isActive ? 1 : 0.45;
  const size = Math.max(20, Math.round(settings.markerSize * getZoomScale(zoom)));
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" opacity="${opacity}">
      ${getShapeSvg(settings.shape, size, settings.markerColor)}
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="Inter, sans-serif" font-size="${Math.max(10, Math.floor(size / 3.1))}" font-weight="700">${settings.symbol}</text>
    </svg>
  `.trim();
  const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

  return L.icon({
    iconUrl,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  });
}

function MapCenterController({ center, onZoomChange }: { center: [number, number]; onZoomChange: (zoom: number) => void }) {
  const map = useMap();

  useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center[0], center[1], map]);

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}

export default function MapView({
  assets = [],
  alerts = [],
  signals = [],
  heatCells = [],
  coveragePoints = [],
  triangulation = null,
  assetConnectionMode = "none",
  mapHeight = "500px",
}: Props) {
  const defaultCenter = DELHI_CENTER;
  const [blinkOn, setBlinkOn] = useState(true);
  const [mapZoom, setMapZoom] = useState(13);

  useEffect(() => {
    const timer = setInterval(() => setBlinkOn((current) => !current), 500);
    return () => clearInterval(timer);
  }, []);

  const alertMarkers = alerts.filter(
    (alert) =>
      alert.status === "NEW" &&
      typeof alert.latitude === "number" &&
      typeof alert.longitude === "number"
  );
  const assetTypeLegend = useMemo(() => {
    const seen = new Set<string>();
    for (const asset of assets) {
      const typeKey = (asset.type ?? "").trim().toUpperCase() || "UNKNOWN";
      seen.add(typeKey);
    }

    const orderedKnown = ASSET_TYPE_ORDER.filter((typeKey) => seen.has(typeKey)).map((typeKey) => [
      typeKey,
      ASSET_TYPE_SETTINGS[typeKey],
    ] as [string, AssetTypeSettings]);

    const unknown = Array.from(seen)
      .filter((typeKey) => !ASSET_TYPE_SETTINGS[typeKey])
      .map((typeKey) => [typeKey, getAssetTypeSettings(typeKey)] as [string, AssetTypeSettings]);

    return [...orderedKnown, ...unknown];
  }, [assets]);
  const maxDensity = Math.max(1, ...heatCells.map((c) => c.density));
  const hasAssets = assets.length > 0;
  const hasSignals = signals.length > 0;
  const hasCoverage = coveragePoints.length > 0;
  const mapCenter: [number, number] = useMemo(
    () =>
      hasAssets
        ? [assets[0].latitude, assets[0].longitude]
        : hasSignals
          ? [signals[0].latitude, signals[0].longitude]
          : hasCoverage
            ? [coveragePoints[0].latitude, coveragePoints[0].longitude]
            : defaultCenter,
    [hasAssets, hasSignals, hasCoverage, assets, signals, coveragePoints, defaultCenter],
  );
  const assetLinkPairs: Array<[[number, number], [number, number]]> = [];

  if (assetConnectionMode === "mesh" && assets.length > 1) {
    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        assetLinkPairs.push(
          [
            [assets[i].latitude, assets[i].longitude],
            [assets[j].latitude, assets[j].longitude],
          ],
        );
      }
    }
  }

  return (
    <div style={{ position: "relative" }}>
    <MapContainer center={mapCenter} zoom={13} style={{ height: mapHeight }}>
      <MapCenterController center={mapCenter} onZoomChange={setMapZoom} />
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {assetLinkPairs.map((pair, idx) => (
        <Polyline
          key={`asset-link-${idx}`}
          positions={[pair[0], pair[1]]}
          pathOptions={{ color: "#1d4ed8", weight: 3, opacity: 0.8 }}
        />
      ))}

      {assets.map((asset) => (
        <Marker
          key={asset.id}
          position={[asset.latitude, asset.longitude]}
          icon={buildAssetIcon(getAssetTypeSettings(asset.type), asset.status, mapZoom)}
        >
          <Popup>
            <div>
              <strong>{asset.name}</strong>
              <div>Type: {asset.type ?? "UNKNOWN"}</div>
              <div>Status: {asset.status}</div>
              <div>Profile: {getAssetTypeSettings(asset.type).label}</div>
            </div>
          </Popup>
        </Marker>
      ))}

      {alertMarkers.map((alert) => (
        <CircleMarker
          key={`alert-${alert.id}`}
          center={[alert.latitude as number, alert.longitude as number]}
          radius={blinkOn ? 12 : 6}
          pathOptions={{
            color: "#ef4444",
            fillColor: "#ef4444",
            fillOpacity: blinkOn ? 0.7 : 0.2,
            weight: 2,
          }}
        >
          <Popup>
            <div>
              <div><strong>Alert: {alert.severity}</strong></div>
              <div>{alert.description ?? "Decodio Trigger"}</div>
              <div>Status: {alert.status}</div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {signals.map((signal) => (
        <CircleMarker
          key={`sig-${signal.id}`}
          center={[signal.latitude, signal.longitude]}
          radius={5}
          pathOptions={{ color: "#1d4ed8" }}
        >
          <Popup>
            <div>
              <div>Frequency: {signal.frequency}</div>
              <div>Modulation: {signal.modulation}</div>
              <div>Power: {signal.power_level}</div>
              <div>Detected: {new Date(signal.detected_at).toLocaleString()}</div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {heatCells.map((cell, idx) => (
        <CircleMarker
          key={`heat-${idx}`}
          center={[cell.latitude_bucket, cell.longitude_bucket]}
          radius={Math.min(20, 4 + (cell.density / maxDensity) * 16)}
          pathOptions={{ color: "#dc2626", fillOpacity: 0.3 }}
        />
      ))}

      {coveragePoints.map((point, idx) => (
        <CircleMarker
          key={`cov-${idx}`}
          center={[point.latitude, point.longitude]}
          radius={4}
          pathOptions={{ color: "#16a34a" }}
        >
          <Popup>Coverage: {point.coverage_db} dB</Popup>
        </CircleMarker>
      ))}

      {(triangulation?.rays ?? []).map((ray, idx) => (
        <Polyline
          key={`tri-ray-${ray.source_id}-${idx}`}
          positions={[
            [ray.source_latitude, ray.source_longitude],
            [ray.end_latitude, ray.end_longitude],
          ]}
          pathOptions={{ color: "#2563eb", weight: 3, opacity: 0.95 }}
        >
          <Popup>
            <div>
              <div>Source: {ray.source_id}</div>
              <div>Bearing: {ray.bearing_deg.toFixed(1)}°</div>
              <div>Confidence: {ray.confidence.toFixed(2)}</div>
            </div>
          </Popup>
        </Polyline>
      ))}

      {(triangulation?.roi_polygon?.length ?? 0) >= 3 && (
        <Polyline
          positions={[
            ...triangulation!.roi_polygon.map((point) => [point.latitude, point.longitude] as [number, number]),
            [triangulation!.roi_polygon[0].latitude, triangulation!.roi_polygon[0].longitude],
          ]}
          pathOptions={{ color: "#7c3aed", weight: 3, opacity: 0.9 }}
        />
      )}

      {triangulation?.centroid_latitude != null && triangulation?.centroid_longitude != null && (
        <CircleMarker
          center={[triangulation.centroid_latitude, triangulation.centroid_longitude]}
          radius={7}
          pathOptions={{ color: "#7c3aed", fillOpacity: 0.85 }}
        >
          <Popup>
            <div>
              <div>Triangulated ROI Centroid</div>
              <div>Lat: {triangulation.centroid_latitude.toFixed(6)}</div>
              <div>Lon: {triangulation.centroid_longitude.toFixed(6)}</div>
              <div>Intersections: {triangulation.intersection_count}</div>
            </div>
          </Popup>
        </CircleMarker>
      )}
    </MapContainer>

      {assetTypeLegend.length > 0 && (
        <div
          style={{
            position: "absolute",
            right: 16,
            top: 16,
            zIndex: 1000,
            background: "rgba(255, 255, 255, 0.92)",
            border: "1px solid #d1d5db",
            borderRadius: 16,
            padding: "14px 14px",
            minWidth: 210,
            fontSize: 14,
            lineHeight: 1.4,
            backdropFilter: "blur(2px)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 10, color: "#0f172a" }}>Asset Type Legend</div>
          {assetTypeLegend.map(([typeKey, settings]) => (
            <div key={typeKey} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, color: "#1e293b" }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  display: "inline-flex",
                }}
                dangerouslySetInnerHTML={{
                  __html: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">${getShapeSvg(settings.shape, 22, settings.markerColor)}<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="Inter, sans-serif" font-size="8" font-weight="700">${settings.symbol}</text></svg>`,
                }}
              >
              </span>
              <span>{settings.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}