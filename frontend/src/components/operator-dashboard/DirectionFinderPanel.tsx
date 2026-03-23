import { Fragment, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polygon, Polyline, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import Card from "../ui/Card";
import { useTheme } from "../../context/ThemeContext";
import type { AssetRecord } from "../../api/assets";
import type { TriangulationResult } from "../../api/rf";
import type { SmsDetectionRecord } from "../../api/operatorDashboard";

type DirectionFinderPanelProps = {
  directionFinderAssets: AssetRecord[];
  detections: SmsDetectionRecord[];
  triangulation?: TriangulationResult | null;
  triangulations?: TriangulationResult[];
};

type LatestBearingDetection = SmsDetectionRecord & {
  latitude: number;
  longitude: number;
  doa_azimuth_deg: number;
};

type BearingLine = {
  key: string;
  sensorId: string;
  sensorLabel: string;
  bearingDeg: number;
  confidence: number;
  positions: [number, number][];
};

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];
const SENSOR_COLORS = ["#ef4444", "#0ea5e9", "#22c55e", "#f59e0b", "#e11d48", "#8b5cf6", "#14b8a6"];

function destinationPoint(
  latitude: number,
  longitude: number,
  bearingDeg: number,
  distanceMeters: number
): [number, number] {
  const earthRadiusMeters = 6_371_000;
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const latRad = (latitude * Math.PI) / 180;
  const lonRad = (longitude * Math.PI) / 180;
  const angularDistance = distanceMeters / earthRadiusMeters;

  const nextLat = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );

  const nextLon =
    lonRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(nextLat)
    );

  return [(nextLat * 180) / Math.PI, (nextLon * 180) / Math.PI];
}

function normalizeBearing(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function bearingToCardinal(bearing: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(normalizeBearing(bearing) / 45) % directions.length;
  return directions[index];
}

function resolveSensorId(detection: SmsDetectionRecord): string {
  const sensorId = detection.raw_payload?.sensor_id;
  return typeof sensorId === "string" && sensorId.trim().length > 0 ? sensorId : detection.source_node;
}

function isBearingDetection(detection: SmsDetectionRecord): detection is LatestBearingDetection {
  return (
    typeof detection.latitude === "number" &&
    typeof detection.longitude === "number" &&
    typeof detection.doa_azimuth_deg === "number"
  );
}

export default function DirectionFinderPanel({
  directionFinderAssets,
  detections,
  triangulation = null,
  triangulations = [],
}: DirectionFinderPanelProps) {
  const { theme } = useTheme();

  const [showSensors, setShowSensors] = useState(true);
  const [showBearings, setShowBearings] = useState(true);
  const [showIntersections, setShowIntersections] = useState(true);
  const [showCentroid, setShowCentroid] = useState(true);
  const [showEllipse, setShowEllipse] = useState(true);

  const latestBearingDetections = useMemo(() => {
    const latestBySensor = new Map<string, LatestBearingDetection>();
    const sortedDetections = [...detections]
      .filter(isBearingDetection)
      .sort((left, right) => Date.parse(right.timestamp_utc) - Date.parse(left.timestamp_utc));

    for (const detection of sortedDetections) {
      const sensorId = resolveSensorId(detection);
      if (!latestBySensor.has(sensorId)) {
        latestBySensor.set(sensorId, detection);
      }
    }

    return Array.from(latestBySensor.values());
  }, [detections]);

  const strongestLatestDetection = useMemo(() => {
    return [...latestBearingDetections].sort(
      (left, right) => (right.power_dbm ?? Number.NEGATIVE_INFINITY) - (left.power_dbm ?? Number.NEGATIVE_INFINITY)
    )[0] ?? null;
  }, [latestBearingDetections]);

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

  const mapCenter: [number, number] = centroid
    ? centroid
    : strongestLatestDetection
      ? [strongestLatestDetection.latitude, strongestLatestDetection.longitude]
      : directionFinderAssets.length > 0
        ? [directionFinderAssets[0].latitude, directionFinderAssets[0].longitude]
        : DEFAULT_CENTER;

  const sensorRegistry = useMemo(() => {
    const registry = new Map<string, string>();

    for (const asset of directionFinderAssets) {
      registry.set(asset.id, asset.name);
    }

    for (const detection of latestBearingDetections) {
      const sensorId = resolveSensorId(detection);
      if (!registry.has(sensorId)) {
        registry.set(sensorId, detection.source_node);
      }
    }

    for (const tri of activeTriangulations) {
      for (const ray of tri.rays ?? []) {
        if (!registry.has(ray.source_id)) {
          registry.set(ray.source_id, ray.source_id);
        }
      }
    }

    for (const ray of triangulation?.rays ?? []) {
      if (!registry.has(ray.source_id)) {
        registry.set(ray.source_id, ray.source_id);
      }
    }

    return Array.from(registry.entries()).map(([id, label]) => ({ id, label }));
  }, [activeTriangulations, directionFinderAssets, latestBearingDetections, triangulation]);

  const sensorColorById = useMemo(() => {
    const map = new Map<string, string>();
    sensorRegistry.forEach((sensor, index) => {
      map.set(sensor.id, SENSOR_COLORS[index % SENSOR_COLORS.length]);
    });
    return map;
  }, [sensorRegistry]);

  const bearingLines = useMemo<BearingLine[]>(() => {
    const allRays = activeTriangulations.flatMap((entry) => entry.rays ?? []);
    if (allRays.length > 0) {
      return allRays.map((ray, index) => ({
        key: `ray-${ray.source_id}-${index}`,
        sensorId: ray.source_id,
        sensorLabel: sensorRegistry.find((sensor) => sensor.id === ray.source_id)?.label ?? ray.source_id,
        bearingDeg: ray.bearing_deg,
        confidence: ray.confidence,
        positions: [
          [ray.source_latitude, ray.source_longitude],
          [ray.end_latitude, ray.end_longitude],
        ],
      }));
    }

    if (triangulation?.rays && triangulation.rays.length > 0) {
      return triangulation.rays.map((ray, index) => ({
        key: `ray-${ray.source_id}-${index}`,
        sensorId: ray.source_id,
        sensorLabel: sensorRegistry.find((sensor) => sensor.id === ray.source_id)?.label ?? ray.source_id,
        bearingDeg: ray.bearing_deg,
        confidence: ray.confidence,
        positions: [
          [ray.source_latitude, ray.source_longitude],
          [ray.end_latitude, ray.end_longitude],
        ],
      }));
    }

    return latestBearingDetections.map((detection) => {
      const sensorId = resolveSensorId(detection);
      return {
        key: detection.id,
        sensorId,
        sensorLabel: detection.source_node,
        bearingDeg: detection.doa_azimuth_deg,
        confidence: detection.confidence ?? 0.8,
        positions: [
          [detection.latitude, detection.longitude],
          destinationPoint(detection.latitude, detection.longitude, detection.doa_azimuth_deg, 8_000),
        ],
      };
    });
  }, [activeTriangulations, latestBearingDetections, triangulation, sensorRegistry]);

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

  const warningMessages = useMemo(
    () =>
      activeTriangulations
        .map((entry) => entry.warning)
        .filter((warning): warning is string => typeof warning === "string" && warning.trim().length > 0),
    [activeTriangulations]
  );

  const intersectionCount = useMemo(
    () => activeTriangulations.reduce((sum, entry) => sum + (entry.intersection_count ?? (entry.intersections?.length ?? 0)), 0),
    [activeTriangulations]
  );

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
        <div>
          <h3 style={{ margin: 0 }}>Direction Finder Panel</h3>
          <div style={{ color: theme.colors.textSecondary, marginTop: theme.spacing.xs }}>
            Multi-sensor AOA bearings, triangulation intersections, centroid estimate, and confidence ellipse.
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: theme.spacing.sm }}>
          <button type="button" onClick={() => setShowSensors((value) => !value)} style={toggleButtonStyle(showSensors)}>Sensors</button>
          <button type="button" onClick={() => setShowBearings((value) => !value)} style={toggleButtonStyle(showBearings)}>Bearings</button>
          <button type="button" onClick={() => setShowIntersections((value) => !value)} style={toggleButtonStyle(showIntersections)}>Intersections</button>
          <button type="button" onClick={() => setShowCentroid((value) => !value)} style={toggleButtonStyle(showCentroid)}>Centroid</button>
          <button type="button" onClick={() => setShowEllipse((value) => !value)} style={toggleButtonStyle(showEllipse)}>Ellipse</button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(240px, 280px) minmax(0, 1fr)",
            gap: theme.spacing.md,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              background: theme.colors.surfaceAlt,
              padding: theme.spacing.md,
              display: "grid",
              gap: theme.spacing.md,
              alignContent: "start",
              minHeight: 280,
            }}
          >
            {latestBearingDetections.length === 0 ? (
              <div style={{ color: theme.colors.textSecondary }}>No active DF bearing detections.</div>
            ) : (
              <div style={{ display: "grid", placeItems: "center", gap: theme.spacing.sm }}>
                {/* Single combined compass showing all sensor rays */}
                <svg viewBox="0 0 200 200" style={{ width: 180, height: 180 }}>
                  {/* Outer ring */}
                  <circle cx="100" cy="100" r="88" fill="none" stroke={theme.colors.border} strokeWidth="1.5" />
                  {/* Inner ring */}
                  <circle cx="100" cy="100" r="70" fill="none" stroke={theme.colors.border} strokeWidth="0.5" strokeDasharray="3 5" />
                  {/* Tick marks every 30° */}
                  {Array.from({ length: 12 }, (_, i) => {
                    const angle = (i * 30 * Math.PI) / 180;
                    const inner = i % 3 === 0 ? 80 : 84;
                    return (
                      <line
                        key={`tick-${i}`}
                        x1={100 + inner * Math.sin(angle)}
                        y1={100 - inner * Math.cos(angle)}
                        x2={100 + 88 * Math.sin(angle)}
                        y2={100 - 88 * Math.cos(angle)}
                        stroke={theme.colors.border}
                        strokeWidth={i % 3 === 0 ? 1.5 : 0.8}
                      />
                    );
                  })}
                  {/* Cardinal labels */}
                  <text x="100" y="10" textAnchor="middle" fill={theme.colors.textSecondary} fontSize="12" fontWeight="600">N</text>
                  <text x="100" y="198" textAnchor="middle" fill={theme.colors.textSecondary} fontSize="12" fontWeight="600">S</text>
                  <text x="10" y="104" textAnchor="middle" fill={theme.colors.textSecondary} fontSize="12" fontWeight="600">W</text>
                  <text x="190" y="104" textAnchor="middle" fill={theme.colors.textSecondary} fontSize="12" fontWeight="600">E</text>
                  {/* All bearing rays, each in sensor color */}
                  {latestBearingDetections.map((detection) => {
                    const sensorId = resolveSensorId(detection);
                    const color = sensorColorById.get(sensorId) ?? theme.colors.danger;
                    const bearing = normalizeBearing(detection.doa_azimuth_deg);
                    return (
                      <g key={sensorId} transform={`rotate(${bearing} 100 100)`}>
                        <line x1="100" y1="100" x2="100" y2="18" stroke={color} strokeWidth="2.5" strokeOpacity="0.9" />
                        <polygon points="100,10 93,24 107,24" fill={color} />
                      </g>
                    );
                  })}
                  {/* Centre dot */}
                  <circle cx="100" cy="100" r="4" fill={theme.colors.textPrimary} />
                </svg>
                {/* Per-sensor bearing labels below the compass */}
                <div style={{ display: "grid", gap: 2, width: "100%" }}>
                  {latestBearingDetections.map((detection) => {
                    const sensorId = resolveSensorId(detection);
                    const color = sensorColorById.get(sensorId) ?? theme.colors.danger;
                    const bearing = normalizeBearing(detection.doa_azimuth_deg);
                    return (
                      <div key={sensorId} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 999, background: color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: theme.colors.textPrimary, flex: 1 }}>{detection.source_node}</span>
                        <span style={{ color: theme.colors.textSecondary }}>{bearing.toFixed(1)}° ({bearingToCardinal(bearing)})</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: "grid", gap: theme.spacing.xs, color: theme.colors.textSecondary }}>
              <div>Sensors: {directionFinderAssets.length}</div>
              <div>Intersections: {intersectionCount}</div>
              <div>
                Estimate: {centroid ? `${centroid[0].toFixed(5)}, ${centroid[1].toFixed(5)}` : "Awaiting valid geometry"}
              </div>
              {warningMessages.map((warning, index) => (
                <div key={`warning-${index}`} style={{ color: theme.colors.warning }}>{warning}</div>
              ))}
            </div>

            <div style={{ display: "grid", gap: theme.spacing.xs }}>
              {sensorRegistry.map((sensor) => {
                const detection = latestBearingDetections.find((row) => resolveSensorId(row) === sensor.id);
                const color = sensorColorById.get(sensor.id) ?? theme.colors.primary;

                return (
                  <div
                    key={sensor.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: theme.spacing.sm,
                      fontSize: theme.typography.body.fontSize,
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: theme.spacing.xs }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
                      {sensor.label}
                    </span>
                    <span style={{ color: theme.colors.textSecondary }}>
                      {detection ? `${normalizeBearing(detection.doa_azimuth_deg).toFixed(1)} deg` : "-"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ borderRadius: theme.radius.md, overflow: "hidden", border: `1px solid ${theme.colors.border}` }}>
            <MapContainer
              center={mapCenter}
              zoom={12}
              scrollWheelZoom={true}
              style={{ height: 320, width: "100%", background: theme.colors.surfaceAlt }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />

              {showSensors && directionFinderAssets.map((asset) => {
                const color = sensorColorById.get(asset.id) ?? theme.colors.primary;
                return (
                  <CircleMarker
                    key={asset.id}
                    center={[asset.latitude, asset.longitude]}
                    radius={7}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.22, weight: 2 }}
                  >
                    <Popup>
                      <div>
                        <div style={{ fontWeight: 600 }}>{asset.name}</div>
                        <div>Type: {asset.type ?? "DIRECTION_FINDER"}</div>
                        <div>Position: {asset.latitude.toFixed(5)}, {asset.longitude.toFixed(5)}</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}

              {showBearings && bearingLines.map((line) => {
                const color = sensorColorById.get(line.sensorId) ?? theme.colors.danger;
                return (
                  <Polyline
                    key={line.key}
                    positions={line.positions}
                    pathOptions={{ color, weight: 3, dashArray: "9 6", opacity: 0.9 }}
                  >
                    <Popup>
                      <div>
                        <div style={{ fontWeight: 600 }}>{line.sensorLabel}</div>
                        <div>Bearing: {normalizeBearing(line.bearingDeg).toFixed(1)} deg</div>
                        <div>Confidence: {(line.confidence * 100).toFixed(1)}%</div>
                      </div>
                    </Popup>
                  </Polyline>
                );
              })}

              {showIntersections && intersections.map((point, index) => (
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

              {showCentroid && centroidEntries.map((entry, index) => (
                <Fragment key={entry.key}>
                  <CircleMarker
                    center={entry.point}
                    radius={12}
                    pathOptions={{ color: theme.colors.success, fillColor: theme.colors.success, fillOpacity: 0.12, weight: 1 }}
                  />
                  <CircleMarker
                    center={entry.point}
                    radius={7}
                    pathOptions={{ color: theme.colors.success, fillColor: theme.colors.success, fillOpacity: 0.85, weight: 2 }}
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

              {showEllipse && ellipsePolygons.map((ellipse) => (
                <Polygon
                  key={ellipse.key}
                  positions={ellipse.points}
                  pathOptions={{ color: theme.colors.success, weight: 2.5, dashArray: "11 7", fillOpacity: 0.16 }}
                />
              ))}
            </MapContainer>
          </div>
        </div>
      </div>
    </Card>
  );
}