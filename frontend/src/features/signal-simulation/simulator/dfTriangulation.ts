import type {
  BearingMeasurement,
  BearingRay,
  DfTriangulationEstimate,
  GeoPoint,
  IntersectionPoint,
  ProbabilityEllipse,
  SignalEmitterConfig,
  SimulationHeatCell,
} from "../model/types";

type LocalPoint = {
  x: number;
  y: number;
};

type LocalFrame = {
  originLatDeg: number;
  originLonDeg: number;
};

type TriangulationOptions = {
  rayLengthM: number;
  parallelAngleThresholdDeg: number;
  maxIntersectionDistanceM: number;
  heatmapGridSize: number;
  heatmapCellSizeM: number;
  confidenceLevel: number;
};

const EARTH_RADIUS_M = 6_371_000;
const HEATMAP_MIN_DENSITY = 0.06;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

export function normalizeBearing(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function normalizeAngleDelta(value: number): number {
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return normalized;
}

export function destinationPoint(origin: GeoPoint, bearingDeg: number, distanceMeters: number): GeoPoint {
  const angularDistance = distanceMeters / EARTH_RADIUS_M;
  const bearingRad = toRadians(bearingDeg);
  const lat1 = toRadians(origin.latitude);
  const lon1 = toRadians(origin.longitude);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );

  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    latitude: toDegrees(lat2),
    longitude: toDegrees(lon2),
  };
}

export function bearingFromTo(from: GeoPoint, to: GeoPoint): number {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  return normalizeBearing(toDegrees(Math.atan2(y, x)));
}

export function distanceMetersBetween(from: GeoPoint, to: GeoPoint): number {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const dLat = lat2 - lat1;
  const dLon = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

function buildLocalFrame(points: GeoPoint[]): LocalFrame {
  const count = Math.max(points.length, 1);
  const originLatDeg = points.reduce((sum, point) => sum + point.latitude, 0) / count;
  const originLonDeg = points.reduce((sum, point) => sum + point.longitude, 0) / count;
  return { originLatDeg, originLonDeg };
}

function toLocalPoint(point: GeoPoint, frame: LocalFrame): LocalPoint {
  const lat0 = toRadians(frame.originLatDeg);
  const dLat = toRadians(point.latitude - frame.originLatDeg);
  const dLon = toRadians(point.longitude - frame.originLonDeg);

  return {
    x: EARTH_RADIUS_M * Math.cos(lat0) * dLon,
    y: EARTH_RADIUS_M * dLat,
  };
}

function fromLocalPoint(point: LocalPoint, frame: LocalFrame): GeoPoint {
  const lat0 = toRadians(frame.originLatDeg);

  return {
    latitude: frame.originLatDeg + toDegrees(point.y / EARTH_RADIUS_M),
    longitude: frame.originLonDeg + toDegrees(point.x / (EARTH_RADIUS_M * Math.cos(lat0))),
  };
}

function buildRay(measurement: BearingMeasurement, rayLengthM: number): BearingRay {
  return {
    sensorId: measurement.sensorId,
    sensorLabel: measurement.sensorLabel,
    start: measurement.sensorLocation,
    end: destinationPoint(measurement.sensorLocation, measurement.measuredBearingDeg, rayLengthM),
    bearingDeg: measurement.measuredBearingDeg,
    confidence: measurement.confidence,
  };
}

function intersectMeasurements(
  left: BearingMeasurement,
  right: BearingMeasurement,
  frame: LocalFrame,
  parallelAngleThresholdDeg: number,
  maxIntersectionDistanceM: number
): IntersectionPoint | null {
  const angularSeparation = Math.abs(normalizeAngleDelta(left.measuredBearingDeg - right.measuredBearingDeg));
  if (angularSeparation < parallelAngleThresholdDeg || Math.abs(180 - angularSeparation) < parallelAngleThresholdDeg) {
    return null;
  }

  const leftOrigin = toLocalPoint(left.sensorLocation, frame);
  const rightOrigin = toLocalPoint(right.sensorLocation, frame);

  const leftBearingRad = toRadians(left.measuredBearingDeg);
  const rightBearingRad = toRadians(right.measuredBearingDeg);
  const leftVector = { x: Math.sin(leftBearingRad), y: Math.cos(leftBearingRad) };
  const rightVector = { x: Math.sin(rightBearingRad), y: Math.cos(rightBearingRad) };

  const cross = leftVector.x * rightVector.y - leftVector.y * rightVector.x;
  if (Math.abs(cross) < 1e-6) {
    return null;
  }

  const dx = rightOrigin.x - leftOrigin.x;
  const dy = rightOrigin.y - leftOrigin.y;

  const leftScale = (dx * rightVector.y - dy * rightVector.x) / cross;
  const rightScale = (dx * leftVector.y - dy * leftVector.x) / cross;

  if (leftScale < 0 || rightScale < 0) {
    return null;
  }

  if (leftScale > maxIntersectionDistanceM || rightScale > maxIntersectionDistanceM) {
    return null;
  }

  const intersection = {
    x: leftOrigin.x + leftScale * leftVector.x,
    y: leftOrigin.y + leftScale * leftVector.y,
  };

  const geoPoint = fromLocalPoint(intersection, frame);
  return {
    latitude: geoPoint.latitude,
    longitude: geoPoint.longitude,
    weight: Math.max(0.15, (left.confidence + right.confidence) / 2),
    sourceSensorIds: [left.sensorId, right.sensorId],
  };
}

function estimateCentroid(points: IntersectionPoint[]): GeoPoint | null {
  if (points.length === 0) {
    return null;
  }

  let weightSum = 0;
  let latitudeSum = 0;
  let longitudeSum = 0;

  for (const point of points) {
    const weight = Math.max(0.01, point.weight);
    weightSum += weight;
    latitudeSum += point.latitude * weight;
    longitudeSum += point.longitude * weight;
  }

  return {
    latitude: latitudeSum / weightSum,
    longitude: longitudeSum / weightSum,
  };
}

function buildProbabilityEllipse(
  intersections: IntersectionPoint[],
  frame: LocalFrame,
  confidenceLevel: number
): ProbabilityEllipse | null {
  if (intersections.length < 2) {
    return null;
  }

  const centroid = estimateCentroid(intersections);
  if (!centroid) {
    return null;
  }

  const centerLocal = toLocalPoint(centroid, frame);
  const localPoints = intersections.map((point) => toLocalPoint(point, frame));

  let sxx = 0;
  let syy = 0;
  let sxy = 0;

  for (const point of localPoints) {
    const dx = point.x - centerLocal.x;
    const dy = point.y - centerLocal.y;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }

  const sampleCount = Math.max(localPoints.length - 1, 1);
  sxx /= sampleCount;
  syy /= sampleCount;
  sxy /= sampleCount;

  const trace = sxx + syy;
  const determinant = sxx * syy - sxy * sxy;
  const root = Math.sqrt(Math.max(0, trace * trace * 0.25 - determinant));

  const lambda1 = trace * 0.5 + root;
  const lambda2 = trace * 0.5 - root;
  const rotationRad = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const scale = Math.sqrt(5.991);
  const semiMajorAxisM = Math.sqrt(Math.max(lambda1, 0)) * scale;
  const semiMinorAxisM = Math.sqrt(Math.max(lambda2, 0)) * scale;

  const polygon: GeoPoint[] = [];
  for (let index = 0; index < 40; index += 1) {
    const t = (2 * Math.PI * index) / 40;
    const ellipseX = semiMajorAxisM * Math.cos(t);
    const ellipseY = semiMinorAxisM * Math.sin(t);
    const rotatedX = ellipseX * Math.cos(rotationRad) - ellipseY * Math.sin(rotationRad);
    const rotatedY = ellipseX * Math.sin(rotationRad) + ellipseY * Math.cos(rotationRad);

    polygon.push(
      fromLocalPoint(
        {
          x: centerLocal.x + rotatedX,
          y: centerLocal.y + rotatedY,
        },
        frame
      )
    );
  }

  return {
    center: centroid,
    semiMajorAxisM,
    semiMinorAxisM,
    rotationDeg: toDegrees(rotationRad),
    polygon,
    confidenceLevel,
  };
}

function buildHeatmap(
  measurements: BearingMeasurement[],
  centroid: GeoPoint | null,
  frame: LocalFrame,
  gridSize: number,
  cellSizeM: number
): SimulationHeatCell[] {
  if (measurements.length === 0) {
    return [];
  }

  const anchor = centroid ?? {
    latitude: measurements.reduce((sum, measurement) => sum + measurement.sensorLocation.latitude, 0) / measurements.length,
    longitude: measurements.reduce((sum, measurement) => sum + measurement.sensorLocation.longitude, 0) / measurements.length,
  };

  const anchorLocal = toLocalPoint(anchor, frame);
  const halfGrid = Math.max(1, Math.floor(gridSize / 2));
  const weightedCells: Array<SimulationHeatCell & { rawDensity: number }> = [];
  let maxDensity = 0;

  for (let yIndex = -halfGrid; yIndex <= halfGrid; yIndex += 1) {
    for (let xIndex = -halfGrid; xIndex <= halfGrid; xIndex += 1) {
      const sampleLocal = {
        x: anchorLocal.x + xIndex * cellSizeM,
        y: anchorLocal.y + yIndex * cellSizeM,
      };
      const sampleGeo = fromLocalPoint(sampleLocal, frame);

      let residualScore = 0;
      for (const measurement of measurements) {
        const expectedBearing = bearingFromTo(measurement.sensorLocation, sampleGeo);
        const bearingDelta = normalizeAngleDelta(expectedBearing - measurement.measuredBearingDeg);
        const sigma = Math.max(0.75, measurement.noiseStdDeg);
        residualScore += Math.pow(bearingDelta / sigma, 2);
      }

      const rawDensity = Math.exp(-0.5 * residualScore);
      maxDensity = Math.max(maxDensity, rawDensity);
      weightedCells.push({
        latitude_bucket: Number(sampleGeo.latitude.toFixed(6)),
        longitude_bucket: Number(sampleGeo.longitude.toFixed(6)),
        density: 0,
        rawDensity,
      });
    }
  }

  if (maxDensity <= 0) {
    return [];
  }

  return weightedCells
    .map((cell) => ({
      latitude_bucket: cell.latitude_bucket,
      longitude_bucket: cell.longitude_bucket,
      density: Number((cell.rawDensity / maxDensity).toFixed(4)),
    }))
    .filter((cell) => cell.density >= HEATMAP_MIN_DENSITY);
}

export function solveTriangulation(
  emitter: SignalEmitterConfig,
  measurements: BearingMeasurement[],
  options: TriangulationOptions
): DfTriangulationEstimate {
  const referencePoints = measurements.map((measurement) => measurement.sensorLocation);
  if (referencePoints.length === 0) {
    return {
      emitterId: emitter.id,
      emitterLabel: emitter.label,
      centroid: null,
      intersections: [],
      rays: [],
      ellipse: null,
      heatmap: [],
      warning: "No enabled DF sensors are available.",
    };
  }

  const localFrame = buildLocalFrame(referencePoints);
  const rays = measurements.map((measurement) => buildRay(measurement, options.rayLengthM));

  const intersections: IntersectionPoint[] = [];
  for (let leftIndex = 0; leftIndex < measurements.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < measurements.length; rightIndex += 1) {
      const intersection = intersectMeasurements(
        measurements[leftIndex],
        measurements[rightIndex],
        localFrame,
        options.parallelAngleThresholdDeg,
        options.maxIntersectionDistanceM
      );

      if (intersection) {
        intersections.push(intersection);
      }
    }
  }

  const centroid = estimateCentroid(intersections);
  const ellipse = buildProbabilityEllipse(intersections, localFrame, options.confidenceLevel);
  const heatmap = buildHeatmap(measurements, centroid, localFrame, options.heatmapGridSize, options.heatmapCellSizeM);

  let warning: string | null = null;
  if (measurements.length < 2) {
    warning = "At least two sensors are required for triangulation.";
  } else if (intersections.length === 0) {
    warning = "Bearing geometry is weak. No valid intersections were produced.";
  } else if (!ellipse) {
    warning = "Centroid available but uncertainty ellipse could not be derived.";
  }

  return {
    emitterId: emitter.id,
    emitterLabel: emitter.label,
    centroid,
    intersections,
    rays,
    ellipse,
    heatmap,
    warning,
  };
}