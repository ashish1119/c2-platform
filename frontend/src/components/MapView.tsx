import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, Polyline, ScaleControl, ZoomControl, useMap, useMapEvents } from "react-leaflet";
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
const MAP_SAVED_VIEW_KEY = "ui.operator.map.savedView";

type SavedMapView = {
  center: [number, number];
  zoom: number;
};

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

function MapCenterController({
  center,
  onZoomChange,
  shouldFollowCenter,
}: {
  center: [number, number];
  onZoomChange: (zoom: number) => void;
  shouldFollowCenter: boolean;
}) {
  const map = useMap();

  useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    if (!shouldFollowCenter) {
      return;
    }
    map.setView(center, map.getZoom());
  }, [center[0], center[1], map, shouldFollowCenter]);

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}

function MousePositionTracker({
  onPositionChange,
}: {
  onPositionChange: (position: [number, number] | null) => void;
}) {
  useMapEvents({
    mousemove: (event) => {
      onPositionChange([event.latlng.lat, event.latlng.lng]);
    },
    mouseout: () => {
      onPositionChange(null);
    },
  });

  return null;
}

function MapViewportTracker({
  onViewChange,
}: {
  onViewChange: (view: SavedMapView) => void;
}) {
  const map = useMap();

  useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onViewChange({ center: [center.lat, center.lng], zoom: map.getZoom() });
    },
    zoomend: () => {
      const center = map.getCenter();
      onViewChange({ center: [center.lat, center.lng], zoom: map.getZoom() });
    },
  });

  useEffect(() => {
    const center = map.getCenter();
    onViewChange({ center: [center.lat, center.lng], zoom: map.getZoom() });
  }, [map, onViewChange]);

  return null;
}

function MapResetController({
  center,
  fitPoints,
  savedView,
  resetCounter,
}: {
  center: [number, number];
  fitPoints: Array<[number, number]>;
  savedView: SavedMapView | null;
  resetCounter: number;
}) {
  const map = useMap();
  const lastHandledResetRef = useRef(0);

  useEffect(() => {
    if (resetCounter <= 0 || resetCounter === lastHandledResetRef.current) {
      return;
    }
    lastHandledResetRef.current = resetCounter;

    map.invalidateSize();
    requestAnimationFrame(() => {
      if (savedView) {
        map.setView(savedView.center, savedView.zoom, { animate: false });
      } else if (fitPoints.length > 0) {
        const bounds = L.latLngBounds(fitPoints);
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16, animate: false });
      } else {
        map.setView(center, 13, { animate: false });
      }
      map.invalidateSize();
    });
  }, [center, fitPoints, map, resetCounter, savedView]);

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
  const [mousePosition, setMousePosition] = useState<[number, number] | null>(null);
  const [resetCounter, setResetCounter] = useState(0);
  const [showAssets, setShowAssets] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showSignals, setShowSignals] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [currentView, setCurrentView] = useState<SavedMapView | null>(null);
  const [savedView, setSavedView] = useState<SavedMapView | null>(() => {
    try {
      const raw = localStorage.getItem(MAP_SAVED_VIEW_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as SavedMapView;
      if (
        Array.isArray(parsed.center) &&
        parsed.center.length === 2 &&
        typeof parsed.center[0] === "number" &&
        typeof parsed.center[1] === "number" &&
        typeof parsed.zoom === "number"
      ) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (savedView) {
      localStorage.setItem(MAP_SAVED_VIEW_KEY, JSON.stringify(savedView));
      return;
    }
    localStorage.removeItem(MAP_SAVED_VIEW_KEY);
  }, [savedView]);

  useEffect(() => {
    const timer = setInterval(() => setBlinkOn((current) => !current), 500);
    return () => clearInterval(timer);
  }, []);

  const alertMarkers = alerts.filter((alert) => {
    const status = String(alert.status ?? "").toUpperCase();
    return (
      (status === "NEW" || status === "ACKNOWLEDGED") &&
      typeof alert.latitude === "number" &&
      typeof alert.longitude === "number"
    );
  });
  const directionFinderAssets = assets.filter(
    (asset) => (asset.type ?? "").trim().toUpperCase() === "DIRECTION_FINDER"
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
  const hasAlertMarkers = alertMarkers.length > 0;
  const hasAssets = assets.length > 0;
  const hasSignals = signals.length > 0;
  const hasCoverage = coveragePoints.length > 0;
  const mapCenter: [number, number] = useMemo(
    () =>
      hasAlertMarkers
        ? [alertMarkers[0].latitude as number, alertMarkers[0].longitude as number]
        : hasAssets
        ? [assets[0].latitude, assets[0].longitude]
        : hasSignals
          ? [signals[0].latitude, signals[0].longitude]
          : hasCoverage
            ? [coveragePoints[0].latitude, coveragePoints[0].longitude]
            : defaultCenter,
    [hasAlertMarkers, hasAssets, hasSignals, hasCoverage, alertMarkers, assets, signals, coveragePoints, defaultCenter],
  );
  const hasSavedView = savedView !== null;
  const initialMapCenter: [number, number] = hasSavedView ? (savedView as SavedMapView).center : mapCenter;
  const initialMapZoom = hasSavedView ? (savedView as SavedMapView).zoom : 13;
  const assetLinkPairs: Array<[[number, number], [number, number]]> = [];
  const resetFitPoints: Array<[number, number]> = useMemo(() => {
    const points: Array<[number, number]> = [];

    if (showAlerts) {
      for (const alert of alertMarkers) {
        points.push([alert.latitude as number, alert.longitude as number]);
      }
    }

    if (showAssets) {
      for (const asset of assets) {
        points.push([asset.latitude, asset.longitude]);
      }
    }

    if (showSignals) {
      for (const signal of signals) {
        points.push([signal.latitude, signal.longitude]);
      }
    }

    for (const point of coveragePoints) {
      points.push([point.latitude, point.longitude]);
    }

    return points;
  }, [alertMarkers, assets, coveragePoints, showAlerts, showAssets, showSignals, signals]);

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
    <MapContainer center={initialMapCenter} zoom={initialMapZoom} zoomControl={false} style={{ height: mapHeight }}>
      <MapCenterController center={mapCenter} onZoomChange={setMapZoom} shouldFollowCenter={!hasSavedView} />
      <MapResetController center={mapCenter} fitPoints={resetFitPoints} savedView={savedView} resetCounter={resetCounter} />
      <MousePositionTracker onPositionChange={setMousePosition} />
      <MapViewportTracker onViewChange={setCurrentView} />
      <ScaleControl position="bottomleft" />
      <ZoomControl position="bottomright" />
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

      {showAssets && assets.map((asset) => (
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

      {showAssets && directionFinderAssets.map((asset) => (
        <Circle
          key={`df-circle-${asset.id}`}
          center={[asset.latitude, asset.longitude]}
          radius={asset.df_radius_m && asset.df_radius_m > 0 ? asset.df_radius_m : 1000}
          pathOptions={{
            color: "#dc2626",
            weight: 2,
            fillColor: "#dc2626",
            fillOpacity: 0.08,
          }}
        />
      ))}

      {showAlerts && alertMarkers.map((alert) => (
        <CircleMarker
          key={`alert-${alert.id}`}
          center={[alert.latitude as number, alert.longitude as number]}
          radius={String(alert.status).toUpperCase() === "NEW" ? (blinkOn ? 12 : 6) : 8}
          pathOptions={{
            color: String(alert.status).toUpperCase() === "NEW" ? "#ef4444" : "#f59e0b",
            fillColor: String(alert.status).toUpperCase() === "NEW" ? "#ef4444" : "#f59e0b",
            fillOpacity: String(alert.status).toUpperCase() === "NEW" ? (blinkOn ? 0.7 : 0.2) : 0.65,
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

      {showSignals && signals.map((signal) => (
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

      {showHeatmap && heatCells.map((cell, idx) => (
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

      <div
        style={{
          position: "absolute",
          left: 16,
          top: 16,
          zIndex: 1000,
          display: "grid",
          gap: 6,
        }}
      >
        <button
          type="button"
          title="Controls: ⌖ Save view | ↺ Reset to saved/default view | A Assets toggle | ! Alerts toggle | S Signals toggle | H Heatmap toggle"
          aria-label="Map controls legend"
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: "#ffffff",
            color: "#0f172a",
            cursor: "help",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          ?
        </button>

        <button
          type="button"
          title="Save current view"
          onClick={() => {
            if (currentView) {
              setSavedView(currentView);
            }
          }}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: savedView ? "#ffffff" : "#f8fafc",
            color: "#0f172a",
            cursor: "pointer",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          ⌖
        </button>

        <button
          type="button"
          title="Reset view"
          onClick={() => {
            setResetCounter((current) => current + 1);
          }}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: "#ffffff",
            color: "#0f172a",
            cursor: "pointer",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          ↺
        </button>

        <button
          type="button"
          title={showAssets ? "Hide assets" : "Show assets"}
          onClick={() => setShowAssets((current) => !current)}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showAssets ? "#ffffff" : "#f1f5f9",
            color: "#0f172a",
            cursor: "pointer",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          A
        </button>

        <button
          type="button"
          title={showAlerts ? "Hide alerts" : "Show alerts"}
          onClick={() => setShowAlerts((current) => !current)}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showAlerts ? "#ffffff" : "#f1f5f9",
            color: "#0f172a",
            cursor: "pointer",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          !
        </button>

        <button
          type="button"
          title={showSignals ? "Hide signals" : "Show signals"}
          onClick={() => setShowSignals((current) => !current)}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showSignals ? "#ffffff" : "#f1f5f9",
            color: "#0f172a",
            cursor: "pointer",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          S
        </button>

        <button
          type="button"
          title={showHeatmap ? "Hide heatmap" : "Show heatmap"}
          onClick={() => setShowHeatmap((current) => !current)}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showHeatmap ? "#ffffff" : "#f1f5f9",
            color: "#0f172a",
            cursor: "pointer",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          H
        </button>
      </div>

      {mousePosition && (
        <div
          style={{
            position: "absolute",
            left: 16,
            bottom: 46,
            zIndex: 1000,
            background: "rgba(255, 255, 255, 0.92)",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: "3px 8px",
            fontSize: 12,
            color: "#0f172a",
          }}
        >
          {`Lat ${mousePosition[0].toFixed(6)}, Lon ${mousePosition[1].toFixed(6)}`}
        </div>
      )}

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