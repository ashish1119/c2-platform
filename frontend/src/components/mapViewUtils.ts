import L from "leaflet";

import type { AssetRecord } from "../api/assets";
import type { AssetTypeSettings } from "./mapViewConfig";
import {
  ASSET_TYPE_SETTINGS,
  DEFAULT_ASSET_TYPE_SETTINGS,
  TRIANGULATION_RAY_COLORS,
} from "./mapViewConfig";

export function getHeatCellColor(density: number): string {
  if (density >= 0.8) return "#ef4444";
  if (density >= 0.6) return "#f97316";
  if (density >= 0.4) return "#f59e0b";
  if (density >= 0.2) return "#84cc16";
  return "#38bdf8";
}

export function hashSourceId(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getTriangulationColor(sourceId: string): string {
  const idx = hashSourceId(sourceId) % TRIANGULATION_RAY_COLORS.length;
  return TRIANGULATION_RAY_COLORS[idx];
}

export function getAssetTypeSettings(assetType?: string | null): AssetTypeSettings {
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

export function isJammerAssetType(assetType?: string | null): boolean {
  return (assetType ?? "").trim().toUpperCase().includes("JAMMER");
}

export function getAssetCircleRadiusMeters(asset: AssetRecord): number | null {
  const radiusMeters = typeof asset.range_m === "number" ? asset.range_m : null;
  if (!Number.isFinite(radiusMeters) || (radiusMeters ?? 0) <= 0) {
    return null;
  }
  return radiusMeters;
}

export function getShapeSvg(shape: AssetTypeSettings["shape"], size: number, color: string): string {
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

export function getZoomScale(zoom: number): number {
  const normalized = 0.75 + (zoom - 10) * 0.07;
  return Math.max(0.7, Math.min(1.35, normalized));
}

export function buildAssetIcon(settings: AssetTypeSettings, status: string, zoom: number): L.Icon {
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

export function toQuadKey(x: number, y: number, z: number): string {
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

export function getBearingDegrees(from: L.LatLng, to: L.LatLng): number {
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;
  const deltaLon = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(deltaLon) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function destinationPointFromBearing(
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

export function extractTcpBearing(parsedFields?: Record<string, string>): {
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

export function buildPointDetails(latLngs: L.LatLng[], closedShape: boolean, includeDistance: boolean = false): string {
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
