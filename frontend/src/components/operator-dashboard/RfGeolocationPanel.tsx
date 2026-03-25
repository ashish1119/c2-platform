import { Fragment, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polygon, Polyline, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Card from "../ui/Card";
import { useTheme } from "../../context/ThemeContext";
import type { AlertRecord } from "../../api/alerts";
import type { AssetRecord } from "../../api/assets";
import type { HeatCell, TriangulationResult } from "../../api/rf";
import type { SmsDetectionRecord } from "../../api/operatorDashboard";

type RfGeolocationPanelProps = {
  detections: SmsDetectionRecord[];
  alerts: AlertRecord[];
  directionFinderAssets?: AssetRecord[];
  heatCells?: HeatCell[];
  triangulation?: TriangulationResult | null;
  triangulations?: TriangulationResult[];
};

type GeolocatedDetection = SmsDetectionRecord & { latitude: number; longitude: number };
type GeolocatedAlert = AlertRecord & { latitude: number; longitude: number };

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];
const SENSOR_COLORS = ["#ef4444", "#0ea5e9", "#22c55e", "#f59e0b", "#e11d48", "#8b5cf6", "#14b8a6"];

function isGeolocatedDetection(detection: SmsDetectionRecord): detection is GeolocatedDetection {
  return typeof detection.latitude === "number" && typeof detection.longitude === "number";
}

function isGeolocatedAlert(alert: AlertRecord): alert is GeolocatedAlert {
  return typeof alert.latitude === "number" && typeof alert.longitude === "number";
}

function resolveDetectionColor(powerDbm?: number | null): string {
  if (typeof powerDbm !== "number") return "#38bdf8";
  if (powerDbm >= -50) return "#ef4444";
  if (powerDbm >= -65) return "#f97316";
  if (powerDbm >= -80) return "#f59e0b";
  return "#22c55e";
}

function heatCellColor(density: number): string {
  if (density >= 0.8) return "#ef4444";
  if (density >= 0.6) return "#f97316";
  if (density >= 0.4) return "#f59e0b";
  if (density >= 0.2) return "#84cc16";
  return "#38bdf8";
}

export default function RfGeolocationPanel({
  detections,
  alerts,
  directionFinderAssets = [],
  heatCells = [],
  triangulation = null,
  triangulations = [],
}: RfGeolocationPanelProps) {
  const { theme } = useTheme();

  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showGeometry, setShowGeometry] = useState(true);
  const [showSensors, setShowSensors] = useState(true);
  const [showDetections, setShowDetections] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);

  const geolocatedDetections = useMemo(() => {
    return detections
      .filter(isGeolocatedDetection)
      .sort((left, right) => Date.parse(right.timestamp_utc) - Date.parse(left.timestamp_utc))
      .slice(0, 120);
  }, [detections]);

  const geolocatedAlerts = useMemo(() => {
    return alerts
      .filter(isGeolocatedAlert)
      .sort((left, right) => Date.parse(right.created_at ?? "") - Date.parse(left.created_at ?? ""))
      .slice(0, 40);
  }, [alerts]);

  const activeTriangulations = useMemo(() => {
    if (triangulations.length > 0) {
      return triangulations;
    }
    return triangulation ? [triangulation] : [];
  }, [triangulation, triangulations]);

  const centroidEntries = useMemo(() => {
    const entries: Array<{ key: string; point: [number, number]; confidenceLevel: number | null | undefined }> = [];

    for (let index = 0; index < activeTriangulations.length; index += 1) {
      const entry = activeTriangulations[index];
      if (typeof entry.centroid_latitude !== "number" || typeof entry.centroid_longitude !== "number") {
        continue;
      }

      entries.push({
        key: `centroid-${index}`,
        point: [entry.centroid_latitude, entry.centroid_longitude],
        confidenceLevel: entry.confidence_level,
      });
    }

    return entries;
  }, [activeTriangulations]);

  const centroid = centroidEntries[0]?.point ?? null;

  const mapCenter: [number, number] =
    centroid ??
    (geolocatedDetections.length > 0
      ? [geolocatedDetections[0].latitude, geolocatedDetections[0].longitude]
      : geolocatedAlerts.length > 0
        ? [geolocatedAlerts[0].latitude, geolocatedAlerts[0].longitude]
        : DEFAULT_CENTER);

  const ellipsePolygons = useMemo(
    () =>
      activeTriangulations
        .map((entry, index) => ({
          key: `ellipse-${index}`,
          points: entry.roi_polygon?.map((point) => [point.latitude, point.longitude] as [number, number]) ?? [],
        }))
        .filter((entry) => entry.points.length > 2),
    [activeTriangulations]
  );

  const intersections = useMemo(
    () =>
      activeTriangulations.flatMap((entry, entryIndex) =>
        (entry.intersections ?? []).map((point, pointIndex) => ({
          key: `intersection-${entryIndex}-${pointIndex}`,
          latitude: point.latitude,
          longitude: point.longitude,
        }))
      ),
    [activeTriangulations]
  );

  const triangulationRays = useMemo(() => activeTriangulations.flatMap((entry) => entry.rays ?? []), [activeTriangulations]);

  const sensorRegistry = useMemo(() => {
    const registry = new Map<string, string>();
    for (const asset of directionFinderAssets) {
      registry.set(asset.id, asset.name);
    }
    for (const ray of triangulationRays) {
      if (!registry.has(ray.source_id)) {
        registry.set(ray.source_id, ray.source_id);
      }
    }
    return Array.from(registry.entries()).map(([id, label]) => ({ id, label }));
  }, [directionFinderAssets, triangulationRays]);

  const sensorColorById = useMemo(() => {
    const map = new Map<string, string>();
    sensorRegistry.forEach((sensor, index) => {
      map.set(sensor.id, SENSOR_COLORS[index % SENSOR_COLORS.length]);
    });
    return map;
  }, [sensorRegistry]);

  const toggleButtonStyle = (active: boolean): React.CSSProperties => ({
    border: `1px solid ${active ? theme.colors.primary : theme.colors.border}`,
    borderRadius: theme.radius.md,
    background: active ? theme.colors.primary : theme.colors.surface,
    color: active ? "#ffffff" : theme.colors.textPrimary,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  });

  return (
    <Card>
      <div style={{ display: "grid", gap: theme.spacing.md }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.md }}>
          <div>
            <h3 style={{ margin: 0 }}>RF Geolocation Map</h3>
            <div style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
              Detection hotspots with DF confidence heatmap, centroid estimate, and uncertainty ellipse.
            </div>
          </div>
          <div style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize }}>
            Detections: {geolocatedDetections.length} | Alerts: {geolocatedAlerts.length} | Heat Cells: {heatCells.length}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: theme.spacing.sm }}>
          <button type="button" onClick={() => setShowHeatmap((value) => !value)} style={toggleButtonStyle(showHeatmap)}>Heatmap</button>
          <button type="button" onClick={() => setShowGeometry((value) => !value)} style={toggleButtonStyle(showGeometry)}>Triangulation</button>
          <button type="button" onClick={() => setShowSensors((value) => !value)} style={toggleButtonStyle(showSensors)}>Sensors</button>
          <button type="button" onClick={() => setShowDetections((value) => !value)} style={toggleButtonStyle(showDetections)}>Detections</button>
          <button type="button" onClick={() => setShowAlerts((value) => !value)} style={toggleButtonStyle(showAlerts)}>Alerts</button>
        </div>

        <div style={{ borderRadius: theme.radius.md, overflow: "hidden", border: `1px solid ${theme.colors.border}` }}>
          <MapContainer center={mapCenter} zoom={12} scrollWheelZoom={true} style={{ height: 340, width: "100%" }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />

            {showHeatmap && heatCells.map((cell, index) => (
              <CircleMarker
                key={`heat-${cell.latitude_bucket}-${cell.longitude_bucket}-${index}`}
                center={[cell.latitude_bucket, cell.longitude_bucket]}
                radius={Math.max(4, 10 * cell.density)}
                pathOptions={{
                  color: heatCellColor(cell.density),
                  fillColor: heatCellColor(cell.density),
                  fillOpacity: Math.min(0.55, 0.12 + cell.density * 0.45),
                  opacity: 0.78,
                  weight: 1,
                }}
              />
            ))}

            {showGeometry && triangulationRays.map((ray, index) => {
              const color = sensorColorById.get(ray.source_id) ?? theme.colors.danger;
              return (
                <Polyline
                  key={`geo-ray-${ray.source_id}-${index}`}
                  positions={[
                    [ray.source_latitude, ray.source_longitude],
                    [ray.end_latitude, ray.end_longitude],
                  ]}
                  pathOptions={{ color, weight: 2.4, dashArray: "8 6", opacity: 0.75 }}
                >
                  <Popup>
                    <div>
                      <div style={{ fontWeight: 600 }}>{sensorRegistry.find((sensor) => sensor.id === ray.source_id)?.label ?? ray.source_id}</div>
                      <div>Bearing: {ray.bearing_deg.toFixed(1)} deg</div>
                      <div>Confidence: {(ray.confidence * 100).toFixed(1)}%</div>
                    </div>
                  </Popup>
                </Polyline>
              );
            })}

            {showGeometry && intersections.map((point, index) => (
              <CircleMarker
                key={point.key}
                center={[point.latitude, point.longitude]}
                radius={4}
                pathOptions={{ color: "#f8fafc", fillColor: theme.colors.warning, fillOpacity: 0.95, weight: 1.5 }}
              >
                <Popup>
                  <div>
                    <div style={{ fontWeight: 600 }}>Intersection {index + 1}</div>
                    <div>{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {showGeometry && ellipsePolygons.map((ellipse) => (
              <Polygon
                key={ellipse.key}
                positions={ellipse.points}
                pathOptions={{ color: theme.colors.success, weight: 2.4, dashArray: "11 7", fillOpacity: 0.16 }}
              />
            ))}

            {showGeometry && centroidEntries.map((entry, index) => (
              <Fragment key={entry.key}>
                <CircleMarker
                  center={entry.point}
                  radius={12}
                  pathOptions={{ color: theme.colors.success, fillColor: theme.colors.success, fillOpacity: 0.12, weight: 1 }}
                />
                <CircleMarker
                  center={entry.point}
                  radius={8}
                  pathOptions={{ color: theme.colors.success, fillColor: theme.colors.success, fillOpacity: 0.82, weight: 2 }}
                >
                  <Popup>
                    <div>
                      <div style={{ fontWeight: 600 }}>Estimated Emitter {index + 1}</div>
                      <div>{entry.point[0].toFixed(5)}, {entry.point[1].toFixed(5)}</div>
                      {typeof entry.confidenceLevel === "number" && (
                        <div>Confidence: {(entry.confidenceLevel * 100).toFixed(1)}%</div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              </Fragment>
            ))}

            {showSensors && directionFinderAssets.map((asset) => {
              const color = sensorColorById.get(asset.id) ?? theme.colors.primary;
              return (
                <CircleMarker
                  key={`df-asset-${asset.id}`}
                  center={[asset.latitude, asset.longitude]}
                  radius={7}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.22, weight: 2 }}
                >
                  <Popup>
                    <div>
                      <div style={{ fontWeight: 600 }}>{asset.name}</div>
                      <div>DF Sensor</div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {showDetections && geolocatedDetections.map((detection) => (
              <CircleMarker
                key={detection.id}
                center={[detection.latitude, detection.longitude]}
                radius={4}
                pathOptions={{
                  color: resolveDetectionColor(detection.power_dbm),
                  fillOpacity: 0.55,
                  weight: 1,
                }}
              >
                <Popup>
                  <div>
                    <div style={{ fontWeight: 600 }}>{detection.source_node}</div>
                    <div>{(detection.frequency_hz / 1_000_000).toFixed(3)} MHz</div>
                    <div>{typeof detection.power_dbm === "number" ? `${detection.power_dbm.toFixed(1)} dBm` : "Power n/a"}</div>
                    <div>{new Date(detection.timestamp_utc).toLocaleString()}</div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {showAlerts && geolocatedAlerts.map((alert) => (
              <CircleMarker
                key={alert.id}
                center={[alert.latitude, alert.longitude]}
                radius={7}
                pathOptions={{
                  color: theme.colors.danger,
                  fillOpacity: 0.2,
                  weight: 2,
                }}
              >
                <Popup>
                  <div>
                    <div style={{ fontWeight: 600 }}>{alert.alert_name ?? "RF Alert"}</div>
                    <div>Severity: {alert.severity}</div>
                    <div>Status: {alert.status}</div>
                    <div>{alert.created_at ? new Date(alert.created_at).toLocaleString() : "-"}</div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        <div style={{ display: "flex", gap: theme.spacing.md, flexWrap: "wrap", color: theme.colors.textSecondary }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: theme.spacing.xs }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#ef4444" }} /> Strong signal
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: theme.spacing.xs }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#22c55e" }} /> Weak signal
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: theme.spacing.xs }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: theme.colors.danger }} /> Alert marker
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: theme.spacing.xs }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: theme.colors.success }} /> Estimated emitter / ellipse
          </span>
        </div>
      </div>
    </Card>
  );
}