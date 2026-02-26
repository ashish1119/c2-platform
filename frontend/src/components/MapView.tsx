import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { AssetRecord } from "../api/assets";
import type { HeatCell, RFSignal, TriangulationResult } from "../api/rf";
import type { CoveragePoint } from "../api/planning";

type Props = {
  assets?: AssetRecord[];
  signals?: RFSignal[];
  heatCells?: HeatCell[];
  coveragePoints?: CoveragePoint[];
  triangulation?: TriangulationResult | null;
  assetConnectionMode?: "none" | "mesh";
};

const DELHI_CENTER: [number, number] = [28.7041, 77.1025];
const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946];

function MapCenterController({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);

  return null;
}

export default function MapView({
  assets = [],
  signals = [],
  heatCells = [],
  coveragePoints = [],
  triangulation = null,
  assetConnectionMode = "none",
}: Props) {
  const [defaultCenter, setDefaultCenter] = useState<[number, number]>(DELHI_CENTER);
  const maxDensity = Math.max(1, ...heatCells.map((c) => c.density));
  const hasAssets = assets.length > 0;
  const hasSignals = signals.length > 0;
  const hasCoverage = coveragePoints.length > 0;
  const mapCenter: [number, number] = hasAssets
    ? [assets[0].latitude, assets[0].longitude]
    : hasSignals
      ? [signals[0].latitude, signals[0].longitude]
      : hasCoverage
        ? [coveragePoints[0].latitude, coveragePoints[0].longitude]
        : defaultCenter;
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

  const usingDelhi = defaultCenter[0] === DELHI_CENTER[0] && defaultCenter[1] === DELHI_CENTER[1];

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setDefaultCenter(usingDelhi ? BENGALURU_CENTER : DELHI_CENTER)}
        style={{ position: "absolute", right: 12, top: 12, zIndex: 1000 }}
      >
        {usingDelhi ? "Default: Delhi (Switch)" : "Default: Bengaluru (Switch)"}
      </button>

    <MapContainer center={mapCenter} zoom={13} style={{ height: "500px" }}>
      <MapCenterController center={mapCenter} />
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
        <Marker key={asset.id} position={[asset.latitude, asset.longitude]}>
          <Popup>
            <div>
              <strong>{asset.name}</strong>
              <div>Type: {asset.type ?? "UNKNOWN"}</div>
              <div>Status: {asset.status}</div>
            </div>
          </Popup>
        </Marker>
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
    </div>
  );
}