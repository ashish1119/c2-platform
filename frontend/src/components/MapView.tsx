import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, Polyline, ScaleControl, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import type { AssetRecord } from "../api/assets";
import type { AlertRecord } from "../api/alerts";
import type { HeatCell, RFSignal, TriangulationResult } from "../api/rf";
import type { TcpClientStatus } from "../api/tcpListener";
import type { CoveragePoint } from "../api/planning";
import { useTheme } from "../context/ThemeContext";

type Props = {
  assets?: AssetRecord[];
  alerts?: AlertRecord[];
  signals?: RFSignal[];
  tcpRecentMessages?: TcpClientStatus["recent_messages"];
  heatCells?: HeatCell[];
  coveragePoints?: CoveragePoint[];
  triangulation?: TriangulationResult | null;
  assetConnectionMode?: "none" | "mesh";
  mapHeight?: string;
  showOnlyDirectionFinders?: boolean;
  jammerLifecycleByAssetId?: Record<string, string>;
  jammerActionInProgressId?: string | null;
  onJammerToggle?: (assetId: string, nextAction: "start" | "stop", config?: JammerControlConfig) => void;
};

export type JammerControlConfig = {
  moduleId: number;
  jammingCode: number;
  frequency?: number;
  gain: number;
};

const DELHI_CENTER: [number, number] = [28.7041, 77.1025];
const MAP_SAVED_VIEW_KEY = "ui.operator.map.savedView";
const DRAW_SHAPES_STORAGE_KEY = "ui.operator.map.drawShapes.v1";
const MAP_NODE_LABELS_VISIBLE_KEY = "ui.operator.map.nodeLabelsVisible";
const JAMMER_POPUP_ALPHA_KEY = "ui.operator.map.jammerPopupAlpha";
const JAMMER_RANGE_COLOR_KEY = "ui.operator.map.jammerRangeColor";
const DF_RANGE_COLOR_KEY = "ui.operator.map.dfRangeColor";
const DEFAULT_JAMMER_POPUP_ALPHA = 0.5;
const DEFAULT_JAMMER_RANGE_COLOR = "#ef4444";
const DEFAULT_DF_RANGE_COLOR = "#2563eb";
const MIN_JAMMER_POPUP_ALPHA = 0.2;
const MAX_JAMMER_POPUP_ALPHA = 0.95;
const JAMMER_RANGE_SPOKE_COUNT = 12;
const JAMMER_SIGNAL_RING_COUNT = 6;
const JAMMER_SIGNAL_PULSE_STEPS = 5;
const TCP_DF_LINE_DISTANCE_METERS = 10_000;
const OFFLINE_LOCAL_TILE_URL =
  (((import.meta as any).env?.VITE_OFFLINE_TILE_URL as string | undefined)?.trim() || "/tiles/{z}/{x}/{y}.png");
const OFFLINE_GRID_TILE_DATA_URI =
  "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256' viewBox='0 0 256 256'%3E%3Crect width='256' height='256' fill='%23f8fafc'/%3E%3Cpath d='M0 0H256M0 64H256M0 128H256M0 192H256M0 255H256M0 0V256M64 0V256M128 0V256M192 0V256M255 0V256' stroke='%23d1d5db' stroke-width='1'/%3E%3Ctext x='128' y='132' text-anchor='middle' font-family='Arial,sans-serif' font-size='14' fill='%236b7280'%3EOFFLINE%3C/text%3E%3C/svg%3E";

type SavedMapView = {
  center: [number, number];
  zoom: number;
};

type DrawShapeType = "polygon" | "polyline" | "circle";

type PersistedDrawShape = {
  type: DrawShapeType | "marker";
  color?: string;
  points?: Array<[number, number]>;
  center?: [number, number];
  radiusM?: number;
  bookmarkText?: string;
  createdAt?: string;
};

type AssetTypeSettings = {
  label: string;
  symbol: string;
  shape: "circle" | "hex" | "diamond" | "square" | "shield" | "triangle";
  markerColor: string;
  markerSize: number;
};

type BaseMapOption = {
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

const ASSET_TYPE_SETTINGS: Record<string, AssetTypeSettings> = {
  C2_NODE: { label: "C2 Node", symbol: "C2", shape: "hex", markerColor: "#1d4ed8", markerSize: 34 },
  RELAY: { label: "Relay", symbol: "R", shape: "square", markerColor: "#0d9488", markerSize: 32 },
  EO_SENSOR: { label: "EO Sensor", symbol: "EO", shape: "diamond", markerColor: "#7c3aed", markerSize: 32 },
  RADAR: { label: "Radar", symbol: "RD", shape: "triangle", markerColor: "#f97316", markerSize: 32 },
  SENSOR: { label: "Sensor", symbol: "S", shape: "circle", markerColor: "#16a34a", markerSize: 30 },
  DIRECTION_FINDER: { label: "Direction Finder", symbol: "DF", shape: "shield", markerColor: "#2563eb", markerSize: 34 },
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

const MODULE_ID_OPTIONS = ["1", "2", "3", "4"];
const GAIN_OPTIONS = Array.from({ length: 35 }, (_, index) => String(index + 1));
const JAMMING_CODE_OPTIONS: Array<{ code: number; name: string }> = [
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

type JammerPopupControlState = {
  moduleId: string;
  jammingCode: string;
  frequency: string;
  gain: string;
};

const DEFAULT_JAMMER_POPUP_CONTROL_STATE: JammerPopupControlState = {
  moduleId: "1",
  jammingCode: "0",
  frequency: "",
  gain: "35",
};

const BASE_MAP_OPTIONS: BaseMapOption[] = [
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

function isJammerAssetType(assetType?: string | null): boolean {
  return (assetType ?? "").trim().toUpperCase().includes("JAMMER");
}

function getAssetCircleRadiusMeters(asset: AssetRecord): number | null {
  const radiusMeters = typeof asset.range_m === "number" ? asset.range_m : null;
  if (!Number.isFinite(radiusMeters) || (radiusMeters ?? 0) <= 0) {
    return null;
  }
  return radiusMeters;
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
  const normalizedStatus = String(status).toUpperCase();
  const isJamming = normalizedStatus === "JAMMING";
  const isActive = normalizedStatus === "ACTIVE" || normalizedStatus === "JAMMING";
  const opacity = isActive ? 1 : 0.45;
  const size = Math.max(20, Math.round(settings.markerSize * getZoomScale(zoom)));
  const markerColor = isJamming ? "#dc2626" : settings.markerColor;
  const jammingRing = isJamming
    ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.47}" fill="none" stroke="#f59e0b" stroke-width="${Math.max(2, Math.round(size * 0.08))}" opacity="0.95" />`
    : "";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" opacity="${opacity}">
      ${jammingRing}
      ${getShapeSvg(settings.shape, size, markerColor)}
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

function AttributionPrefixController() {
  const map = useMap();

  useEffect(() => {
    map.attributionControl.setPrefix(false);
  }, [map]);

  return null;
}

function toQuadKey(x: number, y: number, z: number): string {
  let quadKey = "";
  for (let i = z; i > 0; i -= 1) {
    let digit = 0;
    const mask = 1 << (i - 1);
    if ((x & mask) !== 0) {
      digit += 1;
    }
    if ((y & mask) !== 0) {
      digit += 2;
    }
    quadKey += digit.toString();
  }
  return quadKey;
}

function getBearingDegrees(from: L.LatLng, to: L.LatLng): number {
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;
  const deltaLon = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(deltaLon) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function destinationPointFromBearing(
  center: [number, number],
  bearingDegrees: number,
  distanceMeters: number,
): [number, number] {
  const earthRadiusMeters = 6371000;
  const bearingRadians = (bearingDegrees * Math.PI) / 180;
  const angularDistance = distanceMeters / earthRadiusMeters;
  const lat1 = (center[0] * Math.PI) / 180;
  const lon1 = (center[1] * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRadians),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return [(lat2 * 180) / Math.PI, (((lon2 * 180) / Math.PI + 540) % 360) - 180];
}

function extractTcpBearing(parsedFields?: Record<string, string>): {
  bearingDeg: number;
  sourceKey: string;
  sourceValue: string;
} | null {
  if (!parsedFields) {
    return null;
  }

  const keyPattern = /(bearing|aoa|doa|azimuth|direction|angle|value)/i;

  for (const [key, value] of Object.entries(parsedFields)) {
    if (!keyPattern.test(key)) {
      continue;
    }

    const match = value.match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      continue;
    }

    const parsed = Number(match[0]);
    if (!Number.isFinite(parsed)) {
      continue;
    }

    const normalized = ((parsed % 360) + 360) % 360;
    return {
      bearingDeg: normalized,
      sourceKey: key,
      sourceValue: value,
    };
  }

  return null;
}

function buildPointDetails(latLngs: L.LatLng[], closedShape: boolean, includeDistance: boolean = false): string {
  let cumulativeMeters = 0;

  return latLngs
    .map((point, index) => {
      const previousPoint = index > 0 ? latLngs[index - 1] : null;
      if (previousPoint) {
        cumulativeMeters += previousPoint.distanceTo(point);
      }

      const nextPoint =
        index < latLngs.length - 1 ? latLngs[index + 1] : closedShape && latLngs.length > 2 ? latLngs[0] : null;
      const angleText = nextPoint ? `${getBearingDegrees(point, nextPoint).toFixed(1)} deg` : "-";
      const segmentMeters = previousPoint ? previousPoint.distanceTo(point) : 0;
      const distanceText = includeDistance
        ? ` | Dist(prev): ${(segmentMeters / 1000).toFixed(3)} km | Cum: ${(cumulativeMeters / 1000).toFixed(3)} km`
        : "";
      return `P${index + 1}: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)} | Angle: ${angleText}${distanceText}`;
    })
    .join("<br/>");
}

function BingTileLayer({
  option,
  url,
  className,
  onTileError,
  onTileLoad,
}: {
  option: BaseMapOption;
  url: string;
  className?: string;
  onTileError: () => void;
  onTileLoad: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    const BingLayerCtor = (L.TileLayer as any).extend({
      getTileUrl(this: any, coords: { x: number; y: number }) {
        const z = this._getZoomForUrl();
        const data = {
          s: this._getSubdomain(coords),
          x: coords.x,
          y: coords.y,
          z,
          quadkey: toQuadKey(coords.x, coords.y, z),
          r: L.Browser.retina ? "@2x" : "",
        };
        return L.Util.template(this._url, data);
      },
    });

    const layer: L.TileLayer = new BingLayerCtor(url, {
      attribution: option.attribution,
      subdomains: option.subdomains,
      maxZoom: option.maxZoom,
      className,
    });

    layer.on("tileerror", onTileError);
    layer.on("tileload", onTileLoad);
    layer.addTo(map);

    return () => {
      layer.off("tileerror", onTileError);
      layer.off("tileload", onTileLoad);
      map.removeLayer(layer);
    };
  }, [map, option.attribution, option.maxZoom, option.subdomains, url, className, onTileError, onTileLoad]);

  return null;
}

function DrawMeasureControl({
  polygonColor,
  polylineColor,
  circleColor,
  showNodeLabels,
  onActiveShapeChange,
}: {
  polygonColor: string;
  polylineColor: string;
  circleColor: string;
  showNodeLabels: boolean;
  onActiveShapeChange: (shape: DrawShapeType | null) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const editableLayers = new L.FeatureGroup();
    const shapeNodeLayerGroups = new Map<number, L.LayerGroup>();
    map.addLayer(editableLayers);

    const drawControl = new L.Control.Draw({
      position: "topright",
      draw: {
        polygon: {
          allowIntersection: true,
          showArea: true,
          shapeOptions: {
            color: polygonColor,
            weight: 2,
          },
        },
        polyline: {
          metric: true,
          shapeOptions: {
            color: polylineColor,
            weight: 3,
          },
        },
        rectangle: false,
        circle: {
          shapeOptions: {
            color: circleColor,
            weight: 2,
          },
          showRadius: true,
          metric: true,
        },
        marker: {
          repeatMode: false,
        },
        circlemarker: false,
      },
      edit: {
        featureGroup: editableLayers,
        remove: true,
      },
    });

    map.addControl(drawControl);

    const onDrawStart: L.LeafletEventHandlerFn = (event) => {
      const layerType = (event as L.DrawEvents.DrawStart).layerType;
      if (layerType === "polygon" || layerType === "polyline" || layerType === "circle") {
        onActiveShapeChange(layerType);
      } else {
        onActiveShapeChange(null);
      }
    };

    const onDrawStop: L.LeafletEventHandlerFn = () => {
      onActiveShapeChange(null);
    };

    map.on(L.Draw.Event.DRAWSTART, onDrawStart);
    map.on(L.Draw.Event.DRAWSTOP, onDrawStop);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") {
        return;
      }

      const drawToolbar = (drawControl as any)._toolbars?.draw;
      const polygonHandler = drawToolbar?._modes?.polygon?.handler;
      const polylineHandler = drawToolbar?._modes?.polyline?.handler;

      if (polygonHandler?.enabled?.() && (polygonHandler._markers?.length ?? 0) >= 4) {
        polygonHandler.completeShape();
        return;
      }

      if (polylineHandler?.enabled?.() && (polylineHandler._markers?.length ?? 0) >= 2) {
        polylineHandler.completeShape();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    const renderLineNodeDetails = (lineLayer: L.Polyline) => {
      const ownerId = L.Util.stamp(lineLayer);
      const existing = shapeNodeLayerGroups.get(ownerId);
      if (existing) {
        map.removeLayer(existing);
        shapeNodeLayerGroups.delete(ownerId);
      }

      const latLngs = lineLayer.getLatLngs() as L.LatLng[];
      if (!Array.isArray(latLngs) || latLngs.length === 0) {
        return;
      }

      const layerColor = String(lineLayer.options.color ?? polylineColor);
      const labelsGroup = L.layerGroup();
      let cumulativeMeters = 0;

      for (let index = 0; index < latLngs.length; index += 1) {
        const point = latLngs[index];
        const previousPoint = index > 0 ? latLngs[index - 1] : null;
        const nextPoint = index < latLngs.length - 1 ? latLngs[index + 1] : null;

        if (previousPoint) {
          cumulativeMeters += previousPoint.distanceTo(point);
        }

        const segmentMeters = previousPoint ? previousPoint.distanceTo(point) : 0;
        const angleText = nextPoint ? `${getBearingDegrees(point, nextPoint).toFixed(1)} deg` : "-";
        const labelText = `P${index + 1}: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)} | ${(segmentMeters / 1000).toFixed(3)} km | ${angleText}`;

        const nodeLayer = L.circleMarker(point, {
          radius: 4,
          color: layerColor,
          weight: 2,
          fillColor: "#ffffff",
          fillOpacity: 1,
          interactive: false,
        });

        nodeLayer.bindTooltip(labelText, {
          permanent: true,
          direction: "top",
          offset: [0, -10],
          opacity: 0.95,
        });

        labelsGroup.addLayer(nodeLayer);
      }

      if (showNodeLabels) {
        labelsGroup.addTo(map);
      }
      shapeNodeLayerGroups.set(ownerId, labelsGroup);
    };

    const renderPolygonNodeDetails = (polygonLayer: L.Polygon) => {
      const ownerId = L.Util.stamp(polygonLayer);
      const existing = shapeNodeLayerGroups.get(ownerId);
      if (existing) {
        map.removeLayer(existing);
        shapeNodeLayerGroups.delete(ownerId);
      }

      const latLngs = (polygonLayer.getLatLngs()[0] ?? []) as L.LatLng[];
      if (!Array.isArray(latLngs) || latLngs.length < 3) {
        return;
      }

      const layerColor = String(polygonLayer.options.color ?? polygonColor);
      const labelsGroup = L.layerGroup();

      for (let index = 0; index < latLngs.length; index += 1) {
        const point = latLngs[index];
        const previousPoint = index > 0 ? latLngs[index - 1] : latLngs[latLngs.length - 1];
        const nextPoint = index < latLngs.length - 1 ? latLngs[index + 1] : latLngs[0];

        const segmentMeters = previousPoint.distanceTo(point);
        const angleText = `${getBearingDegrees(point, nextPoint).toFixed(1)} deg`;
        const labelText = `P${index + 1}: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)} | ${(segmentMeters / 1000).toFixed(3)} km | ${angleText}`;

        const nodeLayer = L.circleMarker(point, {
          radius: 4,
          color: layerColor,
          weight: 2,
          fillColor: "#ffffff",
          fillOpacity: 1,
          interactive: false,
        });

        nodeLayer.bindTooltip(labelText, {
          permanent: true,
          direction: "top",
          offset: [0, -10],
          opacity: 0.95,
        });

        labelsGroup.addLayer(nodeLayer);
      }

      if (showNodeLabels) {
        labelsGroup.addTo(map);
      }
      shapeNodeLayerGroups.set(ownerId, labelsGroup);
    };

    const bindPolylinePopup = (polylineLayer: L.Polyline) => {
      const latLngs = polylineLayer.getLatLngs() as L.LatLng[];
      const distanceMeters = latLngs.slice(1).reduce((total, point, index) => {
        return total + point.distanceTo(latLngs[index]);
      }, 0);
      const distanceKm = (distanceMeters / 1000).toFixed(3);
      polylineLayer.bindPopup(`Distance: ${distanceKm} km`);
    };

    const bindPolygonPopup = (polygonLayer: L.Polygon) => {
      const polygonLatLngs = polygonLayer.getLatLngs()[0] as L.LatLng[];
      const areaSqM = L.GeometryUtil.geodesicArea(polygonLatLngs);
      const areaSqKm = (areaSqM / 1_000_000).toFixed(3);
      polygonLayer.bindPopup(`Area: ${areaSqKm} km^2`);
    };

    const bindCirclePopup = (circleLayer: L.Circle) => {
      const radiusM = circleLayer.getRadius();
      const radiusKm = (radiusM / 1000).toFixed(3);
      const areaSqKm = (Math.PI * radiusM * radiusM / 1_000_000).toFixed(3);
      circleLayer.bindPopup(`Radius: ${radiusKm} km | Area: ${areaSqKm} km^2`);
    };

    const bindMarkerPopup = (markerLayer: L.Marker, bookmarkText: string, createdAt: string) => {
      const markerWithMeta = markerLayer as L.Marker & { __bookmarkText?: string; __bookmarkCreatedAt?: string };
      markerWithMeta.__bookmarkText = bookmarkText;
      markerWithMeta.__bookmarkCreatedAt = createdAt;

      const latLng = markerLayer.getLatLng();
      markerLayer.bindTooltip(bookmarkText, {
        permanent: true,
        direction: "top",
        offset: [0, -10],
        opacity: 0.95,
      });
      markerLayer.bindPopup(
        `<strong>${bookmarkText}</strong><br/>Lat: ${latLng.lat.toFixed(6)}<br/>Lon: ${latLng.lng.toFixed(6)}<br/>Time: ${createdAt}`,
      );
    };

    const syncShapePresentation = (shapeLayer: L.Layer) => {
      if (shapeLayer instanceof L.Polyline && !(shapeLayer instanceof L.Polygon)) {
        renderLineNodeDetails(shapeLayer as L.Polyline);
        bindPolylinePopup(shapeLayer as L.Polyline);
        return;
      }

      if (shapeLayer instanceof L.Polygon) {
        renderPolygonNodeDetails(shapeLayer as L.Polygon);
        bindPolygonPopup(shapeLayer as L.Polygon);
        return;
      }

      if (shapeLayer instanceof L.Circle) {
        bindCirclePopup(shapeLayer as L.Circle);
      }
    };

    const saveDrawingsToStorage = () => {
      const persistedShapes: PersistedDrawShape[] = [];

      editableLayers.eachLayer((currentLayer: L.Layer) => {
        if (currentLayer instanceof L.Polyline && !(currentLayer instanceof L.Polygon)) {
          const latLngs = currentLayer.getLatLngs() as L.LatLng[];
          persistedShapes.push({
            type: "polyline",
            color: String(currentLayer.options.color ?? polylineColor),
            points: latLngs.map((point) => [point.lat, point.lng]),
          });
          return;
        }

        if (currentLayer instanceof L.Polygon) {
          const latLngs = (currentLayer.getLatLngs()[0] ?? []) as L.LatLng[];
          persistedShapes.push({
            type: "polygon",
            color: String(currentLayer.options.color ?? polygonColor),
            points: latLngs.map((point) => [point.lat, point.lng]),
          });
          return;
        }

        if (currentLayer instanceof L.Circle) {
          const center = currentLayer.getLatLng();
          persistedShapes.push({
            type: "circle",
            color: String(currentLayer.options.color ?? circleColor),
            center: [center.lat, center.lng],
            radiusM: currentLayer.getRadius(),
          });
          return;
        }

        if (currentLayer instanceof L.Marker) {
          const markerLayer = currentLayer as L.Marker & { __bookmarkText?: string; __bookmarkCreatedAt?: string };
          const latLng = markerLayer.getLatLng();
          const bookmarkText = markerLayer.__bookmarkText ?? String(markerLayer.getTooltip()?.getContent() ?? "Bookmark Pin");
          const createdAt = markerLayer.__bookmarkCreatedAt ?? new Date().toLocaleString();
          persistedShapes.push({
            type: "marker",
            center: [latLng.lat, latLng.lng],
            bookmarkText,
            createdAt,
          });
        }
      });

      localStorage.setItem(DRAW_SHAPES_STORAGE_KEY, JSON.stringify(persistedShapes));
    };

    const restoreDrawingsFromStorage = () => {
      let persistedShapes: PersistedDrawShape[] = [];
      try {
        const raw = localStorage.getItem(DRAW_SHAPES_STORAGE_KEY);
        if (!raw) {
          return;
        }
        const parsed = JSON.parse(raw) as PersistedDrawShape[];
        if (Array.isArray(parsed)) {
          persistedShapes = parsed;
        }
      } catch {
        return;
      }

      for (const shape of persistedShapes) {
        if (shape.type === "polyline" && Array.isArray(shape.points) && shape.points.length >= 2) {
          const polylineLayer = L.polyline(
            shape.points.map(([lat, lng]) => [lat, lng] as [number, number]),
            { color: shape.color ?? polylineColor, weight: 3 },
          );
          editableLayers.addLayer(polylineLayer);
          syncShapePresentation(polylineLayer);
          continue;
        }

        if (shape.type === "polygon" && Array.isArray(shape.points) && shape.points.length >= 3) {
          const polygonLayer = L.polygon(
            shape.points.map(([lat, lng]) => [lat, lng] as [number, number]),
            { color: shape.color ?? polygonColor, weight: 2 },
          );
          editableLayers.addLayer(polygonLayer);
          syncShapePresentation(polygonLayer);
          continue;
        }

        if (shape.type === "circle" && shape.center && typeof shape.radiusM === "number") {
          const circleLayer = L.circle(shape.center, {
            radius: shape.radiusM,
            color: shape.color ?? circleColor,
            weight: 2,
          });
          editableLayers.addLayer(circleLayer);
          syncShapePresentation(circleLayer);
          continue;
        }

        if (shape.type === "marker" && shape.center) {
          const markerLayer = L.marker(shape.center);
          const bookmarkText = (shape.bookmarkText ?? "Bookmark Pin").trim() || "Bookmark Pin";
          const createdAt = shape.createdAt ?? new Date().toLocaleString();
          bindMarkerPopup(markerLayer, bookmarkText, createdAt);
          editableLayers.addLayer(markerLayer);
        }
      }
    };

    const onCreated: L.LeafletEventHandlerFn = (event) => {
      const drawEvent = event as L.DrawEvents.Created;
      const layer = drawEvent.layer;

      if (drawEvent.layerType === "polygon") {
        (layer as L.Polygon).setStyle({ color: polygonColor });
      }
      if (drawEvent.layerType === "polyline") {
        (layer as L.Polyline).setStyle({ color: polylineColor });
      }
      if (drawEvent.layerType === "circle") {
        (layer as L.Circle).setStyle({ color: circleColor });
      }

      editableLayers.addLayer(layer);

      if (drawEvent.layerType === "polyline") {
        const polylineLayer = layer as L.Polyline;
        syncShapePresentation(polylineLayer);
        polylineLayer.openPopup();
      }

      if (drawEvent.layerType === "polygon") {
        const polygonLayer = layer as L.Polygon;
        syncShapePresentation(polygonLayer);
        polygonLayer.openPopup();
      }

      if (drawEvent.layerType === "circle") {
        const circleLayer = layer as L.Circle;
        syncShapePresentation(circleLayer);
        circleLayer.openPopup();
      }

      if (drawEvent.layerType === "marker") {
        const marker = layer as L.Marker;
        const createdAt = new Date().toLocaleString();
        const bookmarkTextInput = window.prompt("Enter bookmark text", "Bookmark Pin") ?? "Bookmark Pin";
        const bookmarkText = bookmarkTextInput.trim() || "Bookmark Pin";
        bindMarkerPopup(marker, bookmarkText, createdAt);
        marker.openPopup();
      }

      saveDrawingsToStorage();
    };

    const onEdited: L.LeafletEventHandlerFn = (event) => {
      const editedLayers = (event as L.DrawEvents.Edited).layers;
      editedLayers.eachLayer((editedLayer: L.Layer) => {
        syncShapePresentation(editedLayer);
      });
      saveDrawingsToStorage();
    };

    const onDeleted: L.LeafletEventHandlerFn = (event) => {
      const deletedLayers = (event as L.DrawEvents.Deleted).layers;
      deletedLayers.eachLayer((deletedLayer: L.Layer) => {
        const ownerId = L.Util.stamp(deletedLayer);
        const labelsGroup = shapeNodeLayerGroups.get(ownerId);
        if (!labelsGroup) {
          return;
        }
        map.removeLayer(labelsGroup);
        shapeNodeLayerGroups.delete(ownerId);
      });
      saveDrawingsToStorage();
    };

    restoreDrawingsFromStorage();

    map.on(L.Draw.Event.CREATED, onCreated);
    map.on(L.Draw.Event.EDITED, onEdited);
    map.on(L.Draw.Event.DELETED, onDeleted);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      map.off(L.Draw.Event.DRAWSTART, onDrawStart);
      map.off(L.Draw.Event.DRAWSTOP, onDrawStop);
      map.off(L.Draw.Event.CREATED, onCreated);
      map.off(L.Draw.Event.EDITED, onEdited);
      map.off(L.Draw.Event.DELETED, onDeleted);
      saveDrawingsToStorage();
      shapeNodeLayerGroups.forEach((labelsGroup) => {
        map.removeLayer(labelsGroup);
      });
      shapeNodeLayerGroups.clear();
      map.removeControl(drawControl);
      map.removeLayer(editableLayers);
    };
  }, [map, polygonColor, polylineColor, circleColor, showNodeLabels, onActiveShapeChange]);

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

function MapResizeController() {
  const map = useMap();

  useEffect(() => {
    let rafId = 0;

    const scheduleInvalidate = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        map.invalidateSize();
      });
    };

    scheduleInvalidate();
    const earlyTimer = window.setTimeout(scheduleInvalidate, 150);
    const settleTimer = window.setTimeout(scheduleInvalidate, 800);

    window.addEventListener("resize", scheduleInvalidate);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        scheduleInvalidate();
      });
      resizeObserver.observe(map.getContainer());
    }

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.clearTimeout(earlyTimer);
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", scheduleInvalidate);
      resizeObserver?.disconnect();
    };
  }, [map]);

  return null;
}

export default function MapView({
  assets = [],
  alerts = [],
  signals = [],
  tcpRecentMessages = [],
  heatCells = [],
  coveragePoints = [],
  triangulation = null,
  assetConnectionMode = "none",
  mapHeight = "500px",
  showOnlyDirectionFinders = false,
  jammerLifecycleByAssetId = {},
  jammerActionInProgressId = null,
  onJammerToggle,
}: Props) {
  const { mode } = useTheme();
  const defaultCenter = DELHI_CENTER;
  const [blinkOn, setBlinkOn] = useState(true);
  const [mapZoom, setMapZoom] = useState(13);
  const [mousePosition, setMousePosition] = useState<[number, number] | null>(null);
  const [resetCounter, setResetCounter] = useState(0);
  const [showAssets, setShowAssets] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showSignals, setShowSignals] = useState(true);
  const [showNodeLabels, setShowNodeLabels] = useState<boolean>(() => {
    const raw = localStorage.getItem(MAP_NODE_LABELS_VISIBLE_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
    return true;
  });
  const [polygonColor, setPolygonColor] = useState("#0ea5e9");
  const [polylineColor, setPolylineColor] = useState("#16a34a");
  const [circleColor, setCircleColor] = useState("#f59e0b");
  const [activeDrawShape, setActiveDrawShape] = useState<DrawShapeType | null>(null);
  const [baseMapId, setBaseMapId] = useState<string>("osm");
  const [showBaseMapSelector, setShowBaseMapSelector] = useState(false);
  const [baseMapTileErrors, setBaseMapTileErrors] = useState(0);
  const [baseMapTileLoads, setBaseMapTileLoads] = useState(0);
  const [autoOfflineFallbackActive, setAutoOfflineFallbackActive] = useState(false);
  const [showAssetLegend, setShowAssetLegend] = useState(false);
  const [showTransparencySlider, setShowTransparencySlider] = useState(false);
  const [showJammerColorPicker, setShowJammerColorPicker] = useState(false);
  const [showDfColorPicker, setShowDfColorPicker] = useState(false);
  const [jammerPopupAlpha, setJammerPopupAlpha] = useState<number>(() => {
    const raw = localStorage.getItem(JAMMER_POPUP_ALPHA_KEY);
    if (!raw) {
      return DEFAULT_JAMMER_POPUP_ALPHA;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_JAMMER_POPUP_ALPHA;
    }

    return Math.max(MIN_JAMMER_POPUP_ALPHA, Math.min(MAX_JAMMER_POPUP_ALPHA, parsed));
  });
  const [jammerRangeColor, setJammerRangeColor] = useState<string>(() => {
    const raw = localStorage.getItem(JAMMER_RANGE_COLOR_KEY);
    if (!raw) {
      return DEFAULT_JAMMER_RANGE_COLOR;
    }

    const normalized = raw.trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      return DEFAULT_JAMMER_RANGE_COLOR;
    }

    return normalized;
  });
  const [dfRangeColor, setDfRangeColor] = useState<string>(() => {
    const raw = localStorage.getItem(DF_RANGE_COLOR_KEY);
    if (!raw) {
      return DEFAULT_DF_RANGE_COLOR;
    }

    const normalized = raw.trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      return DEFAULT_DF_RANGE_COLOR;
    }

    return normalized;
  });
  const [jammerControlByAssetId, setJammerControlByAssetId] = useState<Record<string, JammerPopupControlState>>({});
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
    localStorage.setItem(MAP_NODE_LABELS_VISIBLE_KEY, String(showNodeLabels));
  }, [showNodeLabels]);

  useEffect(() => {
    localStorage.setItem(JAMMER_POPUP_ALPHA_KEY, jammerPopupAlpha.toString());
  }, [jammerPopupAlpha]);

  useEffect(() => {
    localStorage.setItem(JAMMER_RANGE_COLOR_KEY, jammerRangeColor);
  }, [jammerRangeColor]);

  useEffect(() => {
    localStorage.setItem(DF_RANGE_COLOR_KEY, dfRangeColor);
  }, [dfRangeColor]);

  useEffect(() => {
    const timer = setInterval(() => setBlinkOn((current) => !current), 500);
    return () => clearInterval(timer);
  }, []);

  const visibleAssets = useMemo(
    () =>
      showOnlyDirectionFinders
        ? assets.filter((asset) => (asset.type ?? "").trim().toUpperCase() === "DIRECTION_FINDER")
        : assets,
    [assets, showOnlyDirectionFinders]
  );

  const setJammerControlField = useCallback(
    (assetId: string, field: keyof JammerPopupControlState, value: string) => {
      setJammerControlByAssetId((current) => ({
        ...current,
        [assetId]: {
          ...(current[assetId] ?? DEFAULT_JAMMER_POPUP_CONTROL_STATE),
          [field]: value,
        },
      }));
    },
    []
  );

  const alertMarkers = alerts.filter((alert) => {
    const status = String(alert.status ?? "").toUpperCase();
    return (
      (status === "NEW" || status === "ACKNOWLEDGED") &&
      typeof alert.latitude === "number" &&
      typeof alert.longitude === "number"
    );
  });
  const directionFinderAssets = visibleAssets.filter(
    (asset) => (asset.type ?? "").trim().toUpperCase() === "DIRECTION_FINDER"
  );
  const pointerAnchorAsset =
    directionFinderAssets.find((asset) => asset.name?.toLowerCase().includes("bravo east"))
    ?? directionFinderAssets[0]
    ?? null;
  const latestTcpFrame = useMemo(() => {
    if (tcpRecentMessages.length === 0) {
      return null;
    }

    return tcpRecentMessages.reduce((latest, current) => {
      const latestTs = latest.received_at ? new Date(latest.received_at).getTime() : Number.NEGATIVE_INFINITY;
      const currentTs = current.received_at ? new Date(current.received_at).getTime() : Number.NEGATIVE_INFINITY;
      return currentTs > latestTs ? current : latest;
    });
  }, [tcpRecentMessages]);
  const latestTcpFrameWithBearing = useMemo(() => {
    if (!latestTcpFrame) {
      return null;
    }

    const extracted = extractTcpBearing(latestTcpFrame.parsed_fields);
    if (!extracted) {
      return null;
    }

    return {
      frame: latestTcpFrame,
      ...extracted,
    };
  }, [latestTcpFrame]);
  const tcpPointerLine = useMemo(() => {
    if (!pointerAnchorAsset || !latestTcpFrameWithBearing) {
      return null;
    }

    const start: [number, number] = [pointerAnchorAsset.latitude, pointerAnchorAsset.longitude];
    const end = destinationPointFromBearing(
      start,
      latestTcpFrameWithBearing.bearingDeg,
      TCP_DF_LINE_DISTANCE_METERS,
    );

    return {
      start,
      end,
    };
  }, [pointerAnchorAsset, latestTcpFrameWithBearing]);
  const jammerAssets = visibleAssets.filter((asset) => isJammerAssetType(asset.type));
  const activeJammerAssets = useMemo(
    () =>
      jammerAssets.filter((asset) => {
        const lifecycleState = String(jammerLifecycleByAssetId[asset.id] ?? "").toUpperCase();
        return lifecycleState === "JAMMING";
      }),
    [jammerAssets, jammerLifecycleByAssetId],
  );
  const activeJammerAssetsWithRange = useMemo(
    () =>
      activeJammerAssets.flatMap((asset) => {
        const radiusM = getAssetCircleRadiusMeters(asset);
        if (!radiusM) {
          return [];
        }
        return [{ asset, radiusM }];
      }),
    [activeJammerAssets],
  );
  const jammerRangeSpokes = useMemo(
    () =>
      activeJammerAssetsWithRange.flatMap(({ asset, radiusM }) => {
        const center: [number, number] = [asset.latitude, asset.longitude];
        return Array.from({ length: JAMMER_RANGE_SPOKE_COUNT }, (_, index) => {
          const bearing = (360 / JAMMER_RANGE_SPOKE_COUNT) * index;
          const perimeter = destinationPointFromBearing(center, bearing, radiusM);
          return {
            key: `jammer-spoke-${asset.id}-${index}`,
            center,
            perimeter,
          };
        });
      }),
    [activeJammerAssetsWithRange],
  );
  const assetTypeLegend = useMemo(() => {
    const seen = new Set<string>();
    for (const asset of visibleAssets) {
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
  }, [visibleAssets]);
  const hasAlertMarkers = alertMarkers.length > 0;
  const hasAssets = visibleAssets.length > 0;
  const hasSignals = signals.length > 0;
  const hasCoverage = coveragePoints.length > 0;
  const mapCenter: [number, number] = useMemo(
    () =>
      hasAlertMarkers
        ? [alertMarkers[0].latitude as number, alertMarkers[0].longitude as number]
        : hasAssets
        ? [visibleAssets[0].latitude, visibleAssets[0].longitude]
        : hasSignals
          ? [signals[0].latitude, signals[0].longitude]
        : hasCoverage
            ? [coveragePoints[0].latitude, coveragePoints[0].longitude]
            : defaultCenter,
    [hasAlertMarkers, hasAssets, hasSignals, hasCoverage, alertMarkers, visibleAssets, signals, coveragePoints, defaultCenter],
  );
  const hasSavedView = savedView !== null;
  const initialMapCenter: [number, number] = hasSavedView ? (savedView as SavedMapView).center : mapCenter;
  const initialMapZoom = hasSavedView ? (savedView as SavedMapView).zoom : 13;
  const selectedBaseMap = BASE_MAP_OPTIONS.find((option) => option.id === baseMapId) ?? BASE_MAP_OPTIONS[0];
  const selectedBaseMapUrl = mode === "dark" && selectedBaseMap.darkUrl ? selectedBaseMap.darkUrl : selectedBaseMap.url;
  const selectedBaseMapClassName = mode === "dark" && selectedBaseMap.useDarkFilter ? "map-tiles-dark-filter" : undefined;
  const mapDarkFilterClass = mode === "dark" && selectedBaseMap.useDarkFilter ? "map-theme-dark" : "";
  const isOfflineBaseMap = baseMapId === "offline-local" || baseMapId === "offline-blank";
  const activeShapeMenuTop =
    activeDrawShape === "polyline" ? 50 : activeDrawShape === "polygon" ? 80 : activeDrawShape === "circle" ? 110 : 50;
  const activeShapeColor =
    activeDrawShape === "polygon" ? polygonColor : activeDrawShape === "polyline" ? polylineColor : circleColor;
  const activeShapeLabel =
    activeDrawShape === "polygon" ? "Polygon" : activeDrawShape === "polyline" ? "Line" : "Circle";
  const handleBaseMapTileError = useCallback(() => {
    setBaseMapTileErrors((current) => current + 1);
  }, []);
  const handleBaseMapTileLoad = useCallback(() => {
    setBaseMapTileLoads((current) => current + 1);
  }, []);
  const handleBaseMapSelectionChange = useCallback((nextBaseMapId: string) => {
    setAutoOfflineFallbackActive(false);
    setBaseMapId(nextBaseMapId);
  }, []);
  const handleActiveShapeColorChange = useCallback(
    (color: string) => {
      if (activeDrawShape === "polygon") {
        setPolygonColor(color);
        return;
      }
      if (activeDrawShape === "polyline") {
        setPolylineColor(color);
        return;
      }
      if (activeDrawShape === "circle") {
        setCircleColor(color);
      }
    },
    [activeDrawShape],
  );

  useEffect(() => {
    setBaseMapTileErrors(0);
    setBaseMapTileLoads(0);
  }, [baseMapId, mode]);

  useEffect(() => {
    if (!isOfflineBaseMap && baseMapTileLoads > 0) {
      setAutoOfflineFallbackActive(false);
    }
  }, [isOfflineBaseMap, baseMapTileLoads]);

  useEffect(() => {
    if (isOfflineBaseMap || baseMapTileLoads > 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setBaseMapId((current) => {
        if (current === "offline-local" || current === "offline-blank") {
          return current;
        }
        setAutoOfflineFallbackActive(true);
        return "offline-local";
      });
    }, 12000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isOfflineBaseMap, baseMapTileLoads]);

  useEffect(() => {
    if (!autoOfflineFallbackActive || !isOfflineBaseMap || !navigator.onLine) {
      return;
    }

    const timer = window.setTimeout(() => {
      setBaseMapId("osm");
    }, 15000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoOfflineFallbackActive, isOfflineBaseMap]);

  useEffect(() => {
    if (baseMapTileErrors < 2 || baseMapId === "offline-blank") {
      return;
    }

    if (baseMapId !== "offline-local") {
      setAutoOfflineFallbackActive(true);
      setBaseMapId("offline-local");
      return;
    }

    setAutoOfflineFallbackActive(true);
    setBaseMapId("offline-blank");
  }, [baseMapId, baseMapTileErrors]);
  const resetFitPoints: Array<[number, number]> = useMemo(() => {
    const points: Array<[number, number]> = [];

    if (showAlerts) {
      for (const alert of alertMarkers) {
        points.push([alert.latitude as number, alert.longitude as number]);
      }
    }

    if (showAssets) {
      for (const asset of visibleAssets) {
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
  }, [alertMarkers, visibleAssets, signals, coveragePoints, showAlerts, showAssets, showSignals]);

  return (
    <div
      style={
        {
          position: "relative",
          ["--jammer-popup-alpha" as string]: jammerPopupAlpha,
        } as React.CSSProperties
      }
    >
    <MapContainer className={mapDarkFilterClass} center={initialMapCenter} zoom={initialMapZoom} zoomControl={false} style={{ height: mapHeight }}>
      <MapCenterController center={mapCenter} onZoomChange={setMapZoom} shouldFollowCenter={!hasSavedView} />
      <MapResetController center={mapCenter} fitPoints={resetFitPoints} savedView={savedView} resetCounter={resetCounter} />
      <MapResizeController />
      <MousePositionTracker onPositionChange={setMousePosition} />
      <MapViewportTracker onViewChange={setCurrentView} />
      <AttributionPrefixController />
      <DrawMeasureControl
        polygonColor={polygonColor}
        polylineColor={polylineColor}
        circleColor={circleColor}
        showNodeLabels={showNodeLabels}
        onActiveShapeChange={setActiveDrawShape}
      />
      <ScaleControl position="bottomleft" />
      <ZoomControl position="bottomright" />
      {selectedBaseMap.requiresQuadKey ? (
        <BingTileLayer
          key={`${selectedBaseMap.id}-${mode}`}
          option={selectedBaseMap}
          url={selectedBaseMapUrl}
          className={selectedBaseMapClassName}
          onTileError={handleBaseMapTileError}
          onTileLoad={handleBaseMapTileLoad}
        />
      ) : (
        <TileLayer
          key={`${selectedBaseMap.id}-${mode}`}
          attribution={selectedBaseMap.attribution}
          url={selectedBaseMapUrl}
          subdomains={selectedBaseMap.subdomains}
          maxZoom={selectedBaseMap.maxZoom}
          className={selectedBaseMapClassName}
          eventHandlers={{
            tileerror: handleBaseMapTileError,
            tileload: handleBaseMapTileLoad,
          }}
        />
      )}

      {showAssets && visibleAssets.map((asset) => {
        const assetTypeKey = (asset.type ?? "UNKNOWN").trim().toUpperCase();
        const jammerLifecycleState = jammerLifecycleByAssetId[asset.id] ?? "ACTIVE_SERVICE";
        const isJammer = assetTypeKey === "JAMMER";
        const isJamming = jammerLifecycleState.toUpperCase() === "JAMMING";
        const actionPending = jammerActionInProgressId === asset.id;
        const markerStatus = isJammer && isJamming ? "JAMMING" : asset.status;
        const baseAssetSettings = getAssetTypeSettings(asset.type);
        const assetSettings =
          assetTypeKey === "DIRECTION_FINDER"
            ? ({ ...baseAssetSettings, markerColor: dfRangeColor } as AssetTypeSettings)
            : baseAssetSettings;
        const jammerControl = jammerControlByAssetId[asset.id] ?? DEFAULT_JAMMER_POPUP_CONTROL_STATE;

        return (
          <Marker
            key={asset.id}
            position={[asset.latitude, asset.longitude]}
            icon={buildAssetIcon(assetSettings, markerStatus, mapZoom)}
          >
            <Popup className={isJammer ? "jammer-flash-popup" : undefined}>
              <div style={isJammer ? { minWidth: 250 } : undefined}>
                <strong>{asset.name}</strong>
                <div>Type: {asset.type ?? "UNKNOWN"}</div>
                <div>Status: {asset.status}</div>
                <div>Profile: {assetSettings.label}</div>
                {isJammer && <div>Jammer State: {jammerLifecycleState}</div>}
                {isJammer && onJammerToggle && (
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    <label style={{ display: "grid", gap: 2, fontSize: 12 }}>
                      Module
                      <select
                        value={jammerControl.moduleId}
                        onChange={(event) => setJammerControlField(asset.id, "moduleId", event.target.value)}
                        disabled={actionPending}
                      >
                        {MODULE_ID_OPTIONS.map((moduleId) => (
                          <option key={moduleId} value={moduleId}>
                            {moduleId}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={{ display: "grid", gap: 2, fontSize: 12 }}>
                      Code
                      <select
                        value={jammerControl.jammingCode}
                        onChange={(event) => setJammerControlField(asset.id, "jammingCode", event.target.value)}
                        disabled={actionPending}
                      >
                        {JAMMING_CODE_OPTIONS.map((option) => (
                          <option key={option.code} value={String(option.code)}>
                            {option.code} - {option.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={{ display: "grid", gap: 2, fontSize: 12 }}>
                      Frequency (MHz)
                      <input
                        type="number"
                        step="0.1"
                        value={jammerControl.frequency}
                        onChange={(event) => setJammerControlField(asset.id, "frequency", event.target.value)}
                        disabled={actionPending}
                        placeholder="optional"
                      />
                    </label>

                    <label style={{ display: "grid", gap: 2, fontSize: 12 }}>
                      Gain
                      <select
                        value={jammerControl.gain}
                        onChange={(event) => setJammerControlField(asset.id, "gain", event.target.value)}
                        disabled={actionPending}
                      >
                        {GAIN_OPTIONS.map((gain) => (
                          <option key={gain} value={gain}>
                            {gain}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                {isJammer && onJammerToggle && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isJamming) {
                        onJammerToggle(asset.id, "stop");
                        return;
                      }

                      const parsedFrequency = jammerControl.frequency.trim()
                        ? Number(jammerControl.frequency)
                        : undefined;

                      onJammerToggle(asset.id, "start", {
                        moduleId: Number(jammerControl.moduleId),
                        jammingCode: Number(jammerControl.jammingCode),
                        frequency: Number.isFinite(parsedFrequency as number) ? parsedFrequency : undefined,
                        gain: Number(jammerControl.gain),
                      });
                    }}
                    disabled={actionPending}
                    style={{
                      marginTop: 8,
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: isJamming ? "#dc2626" : "#16a34a",
                      color: "#ffffff",
                      cursor: actionPending ? "not-allowed" : "pointer",
                      opacity: actionPending ? 0.7 : 1,
                    }}
                  >
                    {actionPending ? "Processing..." : isJamming ? "Stop Jamming" : "Start Jamming"}
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {showAssets && directionFinderAssets.map((asset) => {
        const radiusM = getAssetCircleRadiusMeters(asset);
        if (!radiusM) {
          return null;
        }

        return (
          <Circle
            key={`df-circle-${asset.id}`}
            center={[asset.latitude, asset.longitude]}
            radius={radiusM}
            pathOptions={{
              color: dfRangeColor,
              weight: 2,
              fillColor: dfRangeColor,
              fillOpacity: 0.08,
            }}
          />
        );
      })}

      {showAssets && activeJammerAssetsWithRange.map(({ asset, radiusM }) => (
        <Circle
          key={`jammer-range-${asset.id}`}
          center={[asset.latitude, asset.longitude]}
          radius={radiusM}
          pathOptions={{
            color: jammerRangeColor,
            weight: 3,
            dashArray: "8 5",
            fillColor: jammerRangeColor,
            fillOpacity: 0.05,
            opacity: blinkOn ? 0.95 : 0.6,
          }}
        />
      ))}

      {showAssets && activeJammerAssetsWithRange.flatMap(({ asset, radiusM }) => Array.from({ length: JAMMER_SIGNAL_RING_COUNT }, (_, ringIndex) => (<Circle key={`jammer-inner-${asset.id}-${ringIndex}`} center={[asset.latitude, asset.longitude]} radius={((ringIndex + 1) / (JAMMER_SIGNAL_RING_COUNT + 1)) * radiusM} pathOptions={{ color: jammerRangeColor, weight: blinkOn ? (ringIndex % 2 === 0 ? 2.2 : 1.4) : (ringIndex % 2 === 0 ? 1.4 : 2.2), opacity: blinkOn ? (ringIndex % 2 === 0 ? 0.95 : 0.35) : (ringIndex % 2 === 0 ? 0.35 : 0.95), dashArray: "6 6", fillOpacity: 0 }} />)))}

      {showAssets && jammerRangeSpokes.map((spoke) => (
        <Polyline
          key={spoke.key}
          positions={[spoke.center, spoke.perimeter]}
          pathOptions={{
            color: jammerRangeColor,
            weight: 2,
            opacity: blinkOn ? 0.9 : 0.45,
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

      {tcpPointerLine && pointerAnchorAsset && latestTcpFrameWithBearing && (
        <>
          <CircleMarker
            center={tcpPointerLine.end}
            radius={6}
            pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.85, weight: 2 }}
          >
            <Popup>
              <div>
                <strong>TCP DF Bearing Line</strong>
                <div>Anchor: {pointerAnchorAsset.name}</div>
                <div>Bearing: {latestTcpFrameWithBearing.bearingDeg.toFixed(1)} deg</div>
                <div>Field: {latestTcpFrameWithBearing.sourceKey} = {latestTcpFrameWithBearing.sourceValue}</div>
                <div>Length: {(TCP_DF_LINE_DISTANCE_METERS / 1000).toFixed(1)} km</div>
                <div>Frame Time: {latestTcpFrameWithBearing.frame.received_at ? new Date(latestTcpFrameWithBearing.frame.received_at).toLocaleString() : "-"}</div>
                <div>Protocol: {latestTcpFrameWithBearing.frame.protocol ?? "-"}</div>
              </div>
            </Popup>
          </CircleMarker>
          <Polyline
            positions={[tcpPointerLine.start, tcpPointerLine.end]}
            pathOptions={{ color: '#ef4444', weight: 4, dashArray: '8 6', opacity: 0.85 }}
          />
        </>
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
          title="Controls: SV Save view | R Reset to saved/default view | A Assets toggle | ! Alerts toggle | S Signals toggle | N Node labels toggle | Draw tools on top-right (press Enter to finish)"
          aria-label="Map controls legend"
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: "#ffffff",
            color: dfRangeColor,
            cursor: "help",
            fontWeight: 700,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            fontSize: 15,
          }}
        >
          ⌖
        </button>

        <button
          type="button"
          title="Popup transparency"
          aria-label="Toggle popup transparency slider"
          onClick={() => setShowTransparencySlider((current) => !current)}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showTransparencySlider ? "#e2e8f0" : "#ffffff",
            color: "#0f172a",
            cursor: "pointer",
            fontWeight: 700,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            fontSize: 15,
          }}
        >
          {"\u25D0"}
        </button>

        {showTransparencySlider && (
          <div
            title="Jammer popup transparency"
            style={{
              width: 120,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "rgba(255, 255, 255, 0.96)",
              color: "#0f172a",
              padding: "6px 8px",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.1 }}>Popup Transparency</div>
            <input
              type="range"
              min={MIN_JAMMER_POPUP_ALPHA}
              max={MAX_JAMMER_POPUP_ALPHA}
              step={0.05}
              value={jammerPopupAlpha}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                if (!Number.isFinite(nextValue)) {
                  return;
                }
                setJammerPopupAlpha(Math.max(MIN_JAMMER_POPUP_ALPHA, Math.min(MAX_JAMMER_POPUP_ALPHA, nextValue)));
              }}
              style={{ width: "100%", margin: 0 }}
            />
            <div style={{ fontSize: 11, color: "#334155" }}>{Math.round((1 - jammerPopupAlpha) * 100)}%</div>
          </div>
        )}

        <button
          type="button"
          title="Jammer ring color"
          aria-label="Toggle jammer ring color picker"
          onClick={() => setShowJammerColorPicker((current) => !current)}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showJammerColorPicker ? "#e2e8f0" : "#ffffff",
            color: "#0f172a",
            cursor: "pointer",
            fontWeight: 700,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            fontSize: 15,
          }}
        >
          {String.fromCodePoint(0x1F3A8)}
        </button>

        {showJammerColorPicker && (
          <div
            title="Jammer range color"
            style={{
              width: 120,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "rgba(255, 255, 255, 0.96)",
              color: "#0f172a",
              padding: "6px 8px",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.1 }}>Jammer Ring Color</div>
            <input
              type="color"
              value={jammerRangeColor}
              onChange={(event) => setJammerRangeColor(event.target.value)}
              style={{ width: "100%", height: 24, border: "none", padding: 0, background: "transparent", cursor: "pointer" }}
            />
          </div>
        )}

        <button
          type="button"
          title="DF ring color"
          aria-label="Toggle DF ring color picker"
          onClick={() => setShowDfColorPicker((current) => !current)}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showDfColorPicker ? "#e2e8f0" : "#ffffff",
            color: dfRangeColor,
            cursor: "pointer",
            fontWeight: 700,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            fontSize: 15,
          }}
        >
          {String.fromCodePoint(0x1F4E1)}
        </button>

        {showDfColorPicker && (
          <div
            title="Direction finder range color"
            style={{
              width: 120,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "rgba(255, 255, 255, 0.96)",
              color: "#0f172a",
              padding: "6px 8px",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.1 }}>DF Ring Color</div>
            <input
              type="color"
              value={dfRangeColor}
              onChange={(event) => setDfRangeColor(event.target.value)}
              style={{ width: "100%", height: 24, border: "none", padding: 0, background: "transparent", cursor: "pointer" }}
            />
          </div>
        )}

        <button
          type="button"
          title="Base map selection"
          aria-label="Toggle base map selector"
          onClick={() => setShowBaseMapSelector((current) => !current)}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showBaseMapSelector ? "#e2e8f0" : "#ffffff",
            color: "#0f172a",
            cursor: "pointer",
            fontWeight: 700,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            fontSize: 15,
          }}
        >
          {String.fromCodePoint(0x1F5FA)}
        </button>

        {showBaseMapSelector && (
          <select
            title="Base map"
            value={baseMapId}
            onChange={(event) => {
              handleBaseMapSelectionChange(event.target.value);
              setShowBaseMapSelector(false);
            }}
            style={{
              height: 30,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "#ffffff",
              color: "#0f172a",
              padding: "0 6px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {BASE_MAP_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        )}

        {!isOfflineBaseMap && baseMapTileErrors >= 1 && (
          <div
            style={{
              background: "rgba(255, 255, 255, 0.96)",
              border: "1px solid #f59e0b",
              borderRadius: 6,
              color: "#92400e",
              fontSize: 11,
              fontWeight: 600,
              maxWidth: 180,
              padding: "4px 6px",
            }}
          >
            Base map failed to load. Switching to offline tiles.
          </div>
        )}

        {baseMapId === "offline-local" && baseMapTileErrors >= 1 && (
          <div
            style={{
              background: "rgba(255, 255, 255, 0.96)",
              border: "1px solid #f59e0b",
              borderRadius: 6,
              color: "#92400e",
              fontSize: 11,
              fontWeight: 600,
              maxWidth: 180,
              padding: "4px 6px",
            }}
          >
            Offline local tiles unavailable. Switching to offline grid.
          </div>
        )}

        {isOfflineBaseMap && (
          <div
            style={{
              background: "rgba(255, 255, 255, 0.96)",
              border: "1px solid #16a34a",
              borderRadius: 6,
              color: "#166534",
              fontSize: 11,
              fontWeight: 600,
              maxWidth: 180,
              padding: "4px 6px",
            }}
          >
            Offline map mode active. Add XYZ tiles in /public/tiles for full map detail.
            {autoOfflineFallbackActive && navigator.onLine ? " Retrying online map automatically..." : ""}
          </div>
        )}

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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            fontSize: 15,
          }}
        >
          {String.fromCodePoint(0x1F4BE)}
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            fontSize: 15,
          }}
        >
          {"\u21BA"}
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            fontSize: 15,
          }}
        >
          {String.fromCodePoint(0x1F4CD)}
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            fontSize: 15,
          }}
        >
          {String.fromCodePoint(0x1F4F6)}
        </button>

        <button
          type="button"
          title={showNodeLabels ? "Hide node labels" : "Show node labels"}
          onClick={() => setShowNodeLabels((current) => !current)}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showNodeLabels ? "#ffffff" : "#f1f5f9",
            color: "#0f172a",
            cursor: "pointer",
            fontWeight: 700,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            fontSize: 15,
          }}
        >
          {String.fromCodePoint(0x1F3F7)}
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            fontSize: 15,
          }}
        >
          {String.fromCodePoint(0x1F6A8)}
        </button>


      </div>

      {activeDrawShape && (
        <div
          style={{
            position: "absolute",
            right: 58,
            top: activeShapeMenuTop,
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.94)",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: "3px",
          }}
        >
          <input
            title={`${activeShapeLabel} color`}
            type="color"
            value={activeShapeColor}
            onChange={(event) => handleActiveShapeColorChange(event.target.value)}
            style={{ width: 14, height: 14, border: "none", padding: 0, background: "transparent", cursor: "pointer" }}
          />
        </div>
      )}

      <div
        title="Compass (North Up)"
        style={{
          position: "absolute",
          right: 58,
          top: 16,
          zIndex: 1000,
          width: 56,
          height: 56,
          borderRadius: 999,
          border: "1px solid #d1d5db",
          background: "rgba(255, 255, 255, 0.94)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.25)",
          backdropFilter: "blur(2px)",
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r="30" fill="#0f172a" opacity="0.9" />
          <circle cx="32" cy="32" r="26" fill="#f8fafc" />
          <circle cx="32" cy="32" r="24" fill="none" stroke="#475569" strokeWidth="1" />

          <g stroke="#64748b" strokeWidth="1">
            <line x1="32" y1="8" x2="32" y2="12" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(30 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(60 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(90 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(120 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(150 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(180 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(210 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(240 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(270 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(300 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(330 32 32)" />
          </g>

          <g stroke="#334155" strokeWidth="1.6">
            <line x1="32" y1="6" x2="32" y2="13" />
            <line x1="32" y1="6" x2="32" y2="13" transform="rotate(90 32 32)" />
            <line x1="32" y1="6" x2="32" y2="13" transform="rotate(180 32 32)" />
            <line x1="32" y1="6" x2="32" y2="13" transform="rotate(270 32 32)" />
          </g>

          <line x1="32" y1="15" x2="32" y2="49" stroke="#94a3b8" strokeWidth="0.8" opacity="0.75" />
          <line x1="15" y1="32" x2="49" y2="32" stroke="#94a3b8" strokeWidth="0.8" opacity="0.75" />

          <polygon points="32,10 38,31 32,27 26,31" fill="#dc2626" />
          <polygon points="32,54 38,33 32,37 26,33" fill="#64748b" />
          <circle cx="32" cy="32" r="2.8" fill="#0f172a" />

          <text x="32" y="9" textAnchor="middle" fontSize="7" fontWeight="700" fill="#b91c1c">N</text>
          <text x="55" y="34" textAnchor="middle" fontSize="6" fontWeight="700" fill="#334155">E</text>
          <text x="32" y="60" textAnchor="middle" fontSize="6" fontWeight="700" fill="#334155">S</text>
          <text x="9" y="34" textAnchor="middle" fontSize="6" fontWeight="700" fill="#334155">W</text>
          <text x="32" y="42" textAnchor="middle" fontSize="5" fontWeight="700" fill="#475569">6400</text>
        </svg>
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
        <button
          type="button"
          title="Asset type legend"
          aria-label="Toggle asset type legend"
          onClick={() => setShowAssetLegend((current) => !current)}
          style={{
            position: "absolute",
            right: 10,
            bottom: 118,
            zIndex: 901,
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showAssetLegend ? "#e2e8f0" : "#ffffff",
            color: "#0f172a",
            cursor: "pointer",
            fontWeight: 700,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            fontSize: 15,
          }}
        >
          {String.fromCodePoint(0x1F4DA)}
        </button>
      )}

      {assetTypeLegend.length > 0 && showAssetLegend && (
        <div
          style={{
            position: "absolute",
            right: 10,
            bottom: 154,
            zIndex: 900,
            background: "rgba(255, 255, 255, 0.92)",
            border: "1px solid #d1d5db",
            borderRadius: 16,
            padding: "14px 14px",
            minWidth: 210,
            maxHeight: "calc(100% - 180px)",
            overflowY: "auto",
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

