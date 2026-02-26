import math
from sqlalchemy import select, func, Float, cast
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.elements import WKTElement
from geoalchemy2 import Geometry
from app.models import RFSignal


async def ingest_signal(data, db: AsyncSession):
    signal = RFSignal(
        frequency=data.frequency,
        modulation=data.modulation,
        power_level=data.power_level,
        bandwidth_hz=data.bandwidth_hz,
        confidence=data.confidence,
        doa_deg=data.doa_deg,
        location=WKTElement(f"POINT({data.longitude} {data.latitude})", srid=4326),
        detected_at=data.detected_at,
    )
    db.add(signal)
    await db.commit()
    return signal


async def list_signals(db: AsyncSession, period_start=None, period_end=None):
    query = select(
        RFSignal.id,
        RFSignal.frequency,
        RFSignal.modulation,
        RFSignal.power_level,
        RFSignal.bandwidth_hz,
        RFSignal.confidence,
        RFSignal.doa_deg,
        func.ST_Y(cast(RFSignal.location, Geometry)).label("latitude"),
        func.ST_X(cast(RFSignal.location, Geometry)).label("longitude"),
        RFSignal.detected_at,
    )
    if period_start:
        query = query.where(RFSignal.detected_at >= period_start)
    if period_end:
        query = query.where(RFSignal.detected_at <= period_end)

    result = await db.execute(query.order_by(RFSignal.detected_at.desc()))
    return result.all()


async def build_heatmap(db: AsyncSession, period_start=None, period_end=None):
    lat_bucket = func.floor(cast(func.ST_Y(cast(RFSignal.location, Geometry)), Float) / 0.05) * 0.05
    lon_bucket = func.floor(cast(func.ST_X(cast(RFSignal.location, Geometry)), Float) / 0.05) * 0.05

    query = select(
        lat_bucket.label("latitude_bucket"),
        lon_bucket.label("longitude_bucket"),
        func.count(RFSignal.id).label("density"),
    )
    if period_start:
        query = query.where(RFSignal.detected_at >= period_start)
    if period_end:
        query = query.where(RFSignal.detected_at <= period_end)

    query = query.group_by(lat_bucket, lon_bucket)
    rows = await db.execute(query)
    return rows.all()


def _ll_to_xy(lat: float, lon: float, lat0: float, lon0: float) -> tuple[float, float]:
    radius = 6_371_000.0
    lat_rad = math.radians(lat)
    lon_rad = math.radians(lon)
    lat0_rad = math.radians(lat0)
    lon0_rad = math.radians(lon0)
    dlon = lon_rad - lon0_rad
    if dlon > math.pi:
        dlon -= 2 * math.pi
    elif dlon < -math.pi:
        dlon += 2 * math.pi
    dlat = lat_rad - lat0_rad
    x = radius * dlon * math.cos(lat0_rad)
    y = radius * dlat
    return x, y


def _xy_to_ll(x: float, y: float, lat0: float, lon0: float) -> tuple[float, float]:
    radius = 6_371_000.0
    lat0_rad = math.radians(lat0)
    lon0_rad = math.radians(lon0)
    lat_rad = lat0_rad + (y / radius)
    lon_rad = lon0_rad + (x / (radius * math.cos(lat0_rad)))
    lon_rad = (lon_rad + 3 * math.pi) % (2 * math.pi) - math.pi
    return math.degrees(lat_rad), math.degrees(lon_rad)


def _bearing_to_unit_xy(bearing_deg: float) -> tuple[float, float]:
    theta = math.radians(bearing_deg % 360.0)
    return math.sin(theta), math.cos(theta)


def _smallest_orientation_delta_deg(b1: float, b2: float) -> float:
    o1 = b1 % 180.0
    o2 = b2 % 180.0
    d = abs(o1 - o2)
    return min(d, 180.0 - d)


def _line_intersection(
    p1: tuple[float, float],
    v1: tuple[float, float],
    p2: tuple[float, float],
    v2: tuple[float, float],
) -> tuple[float, float] | None:
    a11, a12 = v1[0], -v2[0]
    a21, a22 = v1[1], -v2[1]
    b1 = p2[0] - p1[0]
    b2 = p2[1] - p1[1]
    det = (a11 * a22) - (a12 * a21)
    if abs(det) < 1e-10:
        return None
    t = ((b1 * a22) - (b2 * a12)) / det
    return p1[0] + (t * v1[0]), p1[1] + (t * v1[1])


def _geodesic_destination(lat_deg: float, lon_deg: float, bearing_deg: float, distance_m: float) -> tuple[float, float]:
    earth_radius_m = 6_371_000.0
    angular_distance = distance_m / earth_radius_m
    lat1 = math.radians(lat_deg)
    lon1 = math.radians(lon_deg)
    bearing = math.radians(bearing_deg)

    lat2 = math.asin(
        (math.sin(lat1) * math.cos(angular_distance))
        + (math.cos(lat1) * math.sin(angular_distance) * math.cos(bearing))
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(lat1),
        math.cos(angular_distance) - (math.sin(lat1) * math.sin(lat2)),
    )
    lon2 = (lon2 + 3 * math.pi) % (2 * math.pi) - math.pi
    return math.degrees(lat2), math.degrees(lon2)


def _convex_hull(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    pts = sorted(set((float(x), float(y)) for x, y in points))
    if len(pts) <= 1:
        return pts

    def cross(o: tuple[float, float], a: tuple[float, float], b: tuple[float, float]) -> float:
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower: list[tuple[float, float]] = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)

    upper: list[tuple[float, float]] = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)

    return lower[:-1] + upper[:-1]


def _circle_polygon(center: tuple[float, float], radius_m: float, count: int = 36) -> list[tuple[float, float]]:
    cx, cy = center
    points: list[tuple[float, float]] = []
    for i in range(count):
        angle = (2 * math.pi * i) / count
        points.append((cx + (radius_m * math.cos(angle)), cy + (radius_m * math.sin(angle))))
    return points


async def triangulate_signals(
    db: AsyncSession,
    limit: int = 25,
    ray_length_m: float = 10000.0,
    flip_180: bool = False,
    parallel_angle_threshold_deg: float = 5.0,
    max_intersection_distance_m: float = 100000.0,
):
    query = select(
        RFSignal.id,
        RFSignal.doa_deg,
        RFSignal.confidence,
        func.ST_Y(cast(RFSignal.location, Geometry)).label("latitude"),
        func.ST_X(cast(RFSignal.location, Geometry)).label("longitude"),
    ).where(RFSignal.doa_deg.is_not(None), RFSignal.location.is_not(None))

    result = await db.execute(query.order_by(RFSignal.detected_at.desc()).limit(limit))
    rows = result.all()

    if len(rows) < 2:
        return {
            "antenna_count": len(rows),
            "intersection_count": 0,
            "centroid_latitude": None,
            "centroid_longitude": None,
            "roi_polygon": [],
            "rays": [],
            "warning": "Need at least 2 RF signals with doa_deg for triangulation.",
        }

    avg_lat = sum(float(r.latitude) for r in rows) / len(rows)
    avg_lon = sum(float(r.longitude) for r in rows) / len(rows)

    lines: list[dict] = []
    rays: list[dict] = []
    for row in rows:
        source_lat = float(row.latitude)
        source_lon = float(row.longitude)
        bearing = float(row.doa_deg)
        if flip_180:
            bearing = (bearing + 180.0) % 360.0
        confidence = float(row.confidence) if row.confidence is not None else 0.5
        x, y = _ll_to_xy(source_lat, source_lon, avg_lat, avg_lon)
        vx, vy = _bearing_to_unit_xy(bearing)
        lines.append(
            {
                "source_id": str(row.id),
                "bearing": bearing,
                "confidence": confidence,
                "point": (x, y),
                "dir": (vx, vy),
            }
        )
        end_lat, end_lon = _geodesic_destination(source_lat, source_lon, bearing, ray_length_m)
        rays.append(
            {
                "source_id": str(row.id),
                "source_latitude": source_lat,
                "source_longitude": source_lon,
                "bearing_deg": bearing,
                "end_latitude": end_lat,
                "end_longitude": end_lon,
                "confidence": confidence,
            }
        )

    intersections: list[tuple[float, float]] = []
    weights: list[float] = []

    for i in range(len(lines)):
        for j in range(i + 1, len(lines)):
            li = lines[i]
            lj = lines[j]
            angle_between = _smallest_orientation_delta_deg(li["bearing"], lj["bearing"])
            if angle_between < parallel_angle_threshold_deg:
                continue
            intersection = _line_intersection(li["point"], li["dir"], lj["point"], lj["dir"])
            if not intersection:
                continue
            distance = math.hypot(intersection[0], intersection[1])
            if distance > max_intersection_distance_m:
                continue
            intersections.append(intersection)
            weights.append(max(0.1, (li["confidence"] + lj["confidence"]) / 2.0))

    if not intersections:
        return {
            "antenna_count": len(rows),
            "intersection_count": 0,
            "centroid_latitude": None,
            "centroid_longitude": None,
            "roi_polygon": [],
            "rays": rays,
            "warning": "No valid intersections found (parallel rays or filtered intersections).",
        }

    weight_sum = sum(weights)
    centroid_x = sum(intersections[idx][0] * weights[idx] for idx in range(len(intersections))) / weight_sum
    centroid_y = sum(intersections[idx][1] * weights[idx] for idx in range(len(intersections))) / weight_sum
    centroid_lat, centroid_lon = _xy_to_ll(centroid_x, centroid_y, avg_lat, avg_lon)

    polygon_xy: list[tuple[float, float]]
    if len(intersections) >= 3:
        hull = _convex_hull(intersections)
        if len(hull) >= 3:
            polygon_xy = hull
        else:
            dists = [math.hypot(p[0] - centroid_x, p[1] - centroid_y) for p in intersections]
            rms = math.sqrt(sum(d * d for d in dists) / len(dists)) if dists else 500.0
            polygon_xy = _circle_polygon((centroid_x, centroid_y), max(100.0, rms))
    else:
        dists = [math.hypot(p[0] - centroid_x, p[1] - centroid_y) for p in intersections]
        rms = math.sqrt(sum(d * d for d in dists) / len(dists)) if dists else 500.0
        polygon_xy = _circle_polygon((centroid_x, centroid_y), max(100.0, rms))

    roi_polygon = []
    for x, y in polygon_xy:
        lat, lon = _xy_to_ll(x, y, avg_lat, avg_lon)
        roi_polygon.append({"latitude": lat, "longitude": lon})

    return {
        "antenna_count": len(rows),
        "intersection_count": len(intersections),
        "centroid_latitude": centroid_lat,
        "centroid_longitude": centroid_lon,
        "roi_polygon": roi_polygon,
        "rays": rays,
        "warning": None,
    }
