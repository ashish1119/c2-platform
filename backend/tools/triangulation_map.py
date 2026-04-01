#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RF DOA Triangulation Map (Folium + OpenStreetMap)

Install (Python 3.9+):
    pip install folium numpy
Optional (not required; script has hull fallback):
    pip install shapely

Run:
    python triangulation_map.py

Output:
    triangulation_map.html
    Prints estimated ROI centroid (lat, lon) to stdout.

Notes on geometry/approximation:
- This script converts lat/lon to a local tangent-plane approximation (east/north meters)
  around the mean antenna location (equirectangular/ENU-like small-area approximation).
- This is stable and convenient for line intersection math over small to moderate areas
  (e.g., city-scale / tens of km). Accuracy degrades over very large regions.
"""

import math
import os
import asyncio
from numbers import Real
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import folium
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

try:
    from shapely.geometry import MultiPoint  # type: ignore

    SHAPELY_AVAILABLE = True
except Exception:
    SHAPELY_AVAILABLE = False


antennas = [
    {
        "id": "A1",
        "lat": 12.9716,
        "lon": 77.5946,
        "signal": {
            "toa": 6.4e-05,
            "pw": 1e-06,
            "freq": 88000000.0,
            "doa": 35.0,
            "amp_db": -53.18,
            "snr_db": 8.09,
        },
    },
    {
        "id": "A2",
        "lat": 12.9850,
        "lon": 77.6100,
        "signal": {
            "toa": 6.1e-05,
            "pw": 1.1e-06,
            "freq": 88000000.0,
            "doa": 245.0,
            "amp_db": -50.10,
            "snr_db": 10.50,
        },
    },
    {
        "id": "A3",
        "lat": 12.9600,
        "lon": 77.6200,
        "signal": {
            "toa": 6.8e-05,
            "pw": 0.9e-06,
            "freq": 88000000.0,
            "doa": 310.0,
            "amp_db": -57.20,
            "snr_db": 6.30,
        },
    },
]

ray_length_m = 10_000.0
flip_180 = False
parallel_angle_threshold_deg = 5.0
max_intersection_distance_m = 100_000.0
output_html = "triangulation_map.html"
rf_row_limit = 25

DOA_COLUMN_CANDIDATES = [
    "doa",
    "doa_deg",
    "bearing",
    "bearing_deg",
    "azimuth",
    "azimuth_deg",
    "direction_deg",
]


def is_number(value: Any) -> bool:
    return isinstance(value, Real) and not isinstance(value, bool) and math.isfinite(float(value))


def require_number(value: Any, field_name: str, antenna_id: str) -> float:
    if not is_number(value):
        raise ValueError(f"Antenna '{antenna_id}': invalid or missing numeric '{field_name}'")
    return float(value)


def validate_lat_lon(lat: float, lon: float, antenna_id: str) -> None:
    if not (-90.0 <= lat <= 90.0):
        raise ValueError(f"Antenna '{antenna_id}': latitude out of range [-90, 90]: {lat}")
    if not (-180.0 <= lon <= 180.0):
        raise ValueError(f"Antenna '{antenna_id}': longitude out of range [-180, 180]: {lon}")


def popup_html_for_antenna(ant: Dict[str, Any], used_bearing_deg: float) -> str:
    ant_id = ant.get("id", "UNKNOWN")
    signal = ant.get("signal", {}) if isinstance(ant.get("signal", {}), dict) else {}

    preferred_order = ["toa", "pw", "freq", "doa", "amp_db", "snr_db"]
    html = [f"<b>Antenna {ant_id}</b><br>"]
    html.append(f"lat: {ant.get('lat')}<br>")
    html.append(f"lon: {ant.get('lon')}<br>")
    for key in preferred_order:
        html.append(f"{key}: {signal.get(key, 'N/A')}<br>")
    for key, value in signal.items():
        if key not in preferred_order:
            html.append(f"{key}: {value}<br>")
    html.append(f"bearing_used_deg: {used_bearing_deg:.2f}<br>")
    return "".join(html)


def geodesic_destination(lat_deg: float, lon_deg: float, bearing_deg: float, distance_m: float) -> Tuple[float, float]:
    if distance_m < 0:
        raise ValueError("distance_m must be >= 0")
    earth_radius_m = 6_371_000.0
    ang_dist = distance_m / earth_radius_m

    lat1 = math.radians(lat_deg)
    lon1 = math.radians(lon_deg)
    brng = math.radians(bearing_deg)

    sin_lat1 = math.sin(lat1)
    cos_lat1 = math.cos(lat1)
    sin_ad = math.sin(ang_dist)
    cos_ad = math.cos(ang_dist)

    lat2 = math.asin(sin_lat1 * cos_ad + cos_lat1 * sin_ad * math.cos(brng))
    lon2 = lon1 + math.atan2(
        math.sin(brng) * sin_ad * cos_lat1,
        cos_ad - sin_lat1 * math.sin(lat2),
    )
    lon2 = (lon2 + 3 * math.pi) % (2 * math.pi) - math.pi

    return math.degrees(lat2), math.degrees(lon2)


class LocalTangentPlane:
    def __init__(self, lat0_deg: float, lon0_deg: float):
        self.lat0_deg = lat0_deg
        self.lon0_deg = lon0_deg
        self.lat0_rad = math.radians(lat0_deg)
        self.lon0_rad = math.radians(lon0_deg)
        self.R = 6_371_000.0

    def ll_to_xy(self, lat_deg: float, lon_deg: float) -> Tuple[float, float]:
        lat_rad = math.radians(lat_deg)
        lon_rad = math.radians(lon_deg)
        dlon = lon_rad - self.lon0_rad
        if dlon > math.pi:
            dlon -= 2 * math.pi
        elif dlon < -math.pi:
            dlon += 2 * math.pi
        dlat = lat_rad - self.lat0_rad
        x = self.R * dlon * math.cos(self.lat0_rad)
        y = self.R * dlat
        return x, y

    def xy_to_ll(self, x_m: float, y_m: float) -> Tuple[float, float]:
        lat_rad = self.lat0_rad + (y_m / self.R)
        lon_rad = self.lon0_rad + (x_m / (self.R * math.cos(self.lat0_rad)))
        lon_rad = (lon_rad + 3 * math.pi) % (2 * math.pi) - math.pi
        return math.degrees(lat_rad), math.degrees(lon_rad)


def doa_bearing_to_unit_vector_xy(bearing_deg: float) -> np.ndarray:
    theta = math.radians(bearing_deg % 360.0)
    return np.array([math.sin(theta), math.cos(theta)], dtype=float)


def line_intersection_infinite(
    p1: np.ndarray, v1: np.ndarray, p2: np.ndarray, v2: np.ndarray
) -> Optional[np.ndarray]:
    A = np.array([[v1[0], -v2[0]], [v1[1], -v2[1]]], dtype=float)
    b = np.array([p2[0] - p1[0], p2[1] - p1[1]], dtype=float)

    det = np.linalg.det(A)
    if abs(det) < 1e-10:
        return None

    try:
        sol = np.linalg.solve(A, b)
    except np.linalg.LinAlgError:
        return None

    t = sol[0]
    return p1 + t * v1


def smallest_angle_between_bearings_deg(b1: float, b2: float) -> float:
    o1 = b1 % 180.0
    o2 = b2 % 180.0
    d = abs(o1 - o2)
    return min(d, 180.0 - d)


def convex_hull_monotonic_chain(points_xy: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    pts = sorted(set((float(x), float(y)) for x, y in points_xy))
    if len(pts) <= 1:
        return pts

    def cross(o, a, b) -> float:
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower: List[Tuple[float, float]] = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)

    upper: List[Tuple[float, float]] = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)

    return lower[:-1] + upper[:-1]


def convex_hull_points_xy(points_xy: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    if len(points_xy) < 3:
        return points_xy[:]
    if SHAPELY_AVAILABLE:
        try:
            hull_geom = MultiPoint(points_xy).convex_hull
            if hull_geom.geom_type == "Polygon":
                coords = list(hull_geom.exterior.coords)[:-1]
                return [(float(x), float(y)) for x, y in coords]
            coords = list(hull_geom.coords)
            return [(float(x), float(y)) for x, y in coords]
        except Exception:
            pass
    return convex_hull_monotonic_chain(points_xy)


def make_circle_polygon_xy(center_xy: Tuple[float, float], radius_m: float, num_pts: int = 36) -> List[Tuple[float, float]]:
    cx, cy = center_xy
    pts = []
    for i in range(num_pts):
        a = 2 * math.pi * i / num_pts
        pts.append((cx + radius_m * math.cos(a), cy + radius_m * math.sin(a)))
    return pts


def candidate_database_urls() -> List[str]:
    configured = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/c2_db")
    urls = [configured]                        
    if "@postgres:" in configured:
        urls.append(configured.replace("@postgres:", "@localhost:"))
    return urls


async def detect_doa_column(db_url: str) -> Optional[str]:
    engine = create_async_engine(db_url, future=True)
    try:
        async with engine.connect() as conn:
            result = await conn.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema='public'
                      AND table_name='rf_signals'
                    """
                )
            )
            cols = {row[0] for row in result.fetchall()}
            for candidate in DOA_COLUMN_CANDIDATES:
                if candidate in cols:
                    return candidate
            return None
    finally:
        await engine.dispose()


async def load_antennas_from_db(db_url: str, limit_rows: int) -> List[Dict[str, Any]]:
    doa_col = await detect_doa_column(db_url)
    if not doa_col:
        return []

    engine = create_async_engine(db_url, future=True)
    try:
        async with engine.connect() as conn:
            query = text(
                f"""
                SELECT
                    id,
                    frequency,
                    power_level,
                    confidence,
                    detected_at,
                    ST_Y(location::geometry) AS lat,
                    ST_X(location::geometry) AS lon,
                    {doa_col} AS doa
                FROM rf_signals
                WHERE location IS NOT NULL
                  AND {doa_col} IS NOT NULL
                ORDER BY detected_at DESC
                LIMIT :limit_rows
                """
            )
            result = await conn.execute(query, {"limit_rows": limit_rows})
            rows = result.fetchall()

            prepared: List[Dict[str, Any]] = []
            for row in rows:
                lat = float(row.lat)
                lon = float(row.lon)
                doa = float(row.doa)
                confidence = float(row.confidence) if row.confidence is not None else 0.5
                snr_db = (confidence * 30.0) - 10.0

                prepared.append(
                    {
                        "id": f"RF-{row.id}",
                        "lat": lat,
                        "lon": lon,
                        "signal": {
                            "freq": float(row.frequency),
                            "doa": doa,
                            "amp_db": float(row.power_level),
                            "snr_db": snr_db,
                            "confidence": confidence,
                            "detected_at": str(row.detected_at),
                        },
                    }
                )

            return prepared
    finally:
        await engine.dispose()


def load_runtime_antennas() -> Tuple[List[Dict[str, Any]], str]:
    for db_url in candidate_database_urls():
        try:
            db_ants = asyncio.run(load_antennas_from_db(db_url, rf_row_limit))
            if len(db_ants) >= 2:
                return db_ants, f"Using live RF signals from database ({len(db_ants)} records)."
            return antennas, "No RF DOA column or rows found in database; using sample dataset."
        except Exception:
            continue
    return antennas, "Database unavailable for triangulation input; using sample dataset."


def validate_and_prepare_antennas(
    antenna_records: List[Dict[str, Any]], flip_180_global: bool
) -> List[Dict[str, Any]]:
    prepared: List[Dict[str, Any]] = []
    for idx, ant in enumerate(antenna_records):
        ant_id = str(ant.get("id", f"ANT_{idx+1}"))
        if not isinstance(ant, dict):
            raise ValueError(f"Antenna '{ant_id}': record must be a dict")

        lat = require_number(ant.get("lat"), "lat", ant_id)
        lon = require_number(ant.get("lon"), "lon", ant_id)
        validate_lat_lon(lat, lon, ant_id)

        signal = ant.get("signal")
        if not isinstance(signal, dict):
            raise ValueError(f"Antenna '{ant_id}': missing or invalid 'signal' object")

        doa = require_number(signal.get("doa"), "doa", ant_id)
        doa = doa % 360.0
        bearing_used = (doa + 180.0) % 360.0 if flip_180_global else doa

        snr_raw = signal.get("snr_db", None)
        if is_number(snr_raw):
            snr_weight = max(0.1, float(snr_raw) + 20.0)
        else:
            snr_weight = 1.0

        prepared.append(
            {
                "id": ant_id,
                "lat": lat,
                "lon": lon,
                "signal": signal,
                "doa_raw": doa,
                "bearing_used": bearing_used,
                "snr_weight": snr_weight,
            }
        )

    if len(prepared) < 2:
        raise ValueError("Need at least 2 valid antennas for triangulation/ray plotting.")

    return prepared


def compute_intersections_and_roi(
    ants_prepared: List[Dict[str, Any]],
    local_proj: LocalTangentPlane,
    parallel_angle_threshold_deg: float,
    max_intersection_distance_m: float,
) -> Dict[str, Any]:
    line_data = []
    for ant in ants_prepared:
        x, y = local_proj.ll_to_xy(ant["lat"], ant["lon"])
        v = doa_bearing_to_unit_vector_xy(ant["bearing_used"])
        line_data.append(
            {
                "id": ant["id"],
                "point": np.array([x, y], dtype=float),
                "dir": v,
                "bearing_used": ant["bearing_used"],
                "snr_weight": ant["snr_weight"],
            }
        )

    intersections_xy: List[Tuple[float, float]] = []
    intersection_weights: List[float] = []
    pair_debug: List[str] = []
    skipped_parallel = 0
    skipped_far = 0

    n = len(line_data)
    for i in range(n):
        for j in range(i + 1, n):
            li = line_data[i]
            lj = line_data[j]

            angle_between = smallest_angle_between_bearings_deg(li["bearing_used"], lj["bearing_used"])
            if angle_between < parallel_angle_threshold_deg:
                skipped_parallel += 1
                pair_debug.append(f"Skip {li['id']}-{lj['id']}: near-parallel ({angle_between:.2f}°)")
                continue

            p_int = line_intersection_infinite(li["point"], li["dir"], lj["point"], lj["dir"])
            if p_int is None:
                skipped_parallel += 1
                pair_debug.append(f"Skip {li['id']}-{lj['id']}: singular/parallel solve")
                continue

            dist_from_origin = float(np.linalg.norm(p_int))
            if dist_from_origin > max_intersection_distance_m:
                skipped_far += 1
                pair_debug.append(
                    f"Skip {li['id']}-{lj['id']}: intersection too far ({dist_from_origin:.0f} m)"
                )
                continue

            intersections_xy.append((float(p_int[0]), float(p_int[1])))
            w = 0.5 * (float(li["snr_weight"]) + float(lj["snr_weight"]))
            intersection_weights.append(max(0.1, w))

    result: Dict[str, Any] = {
        "intersections_xy": intersections_xy,
        "intersection_weights": intersection_weights,
        "skipped_parallel": skipped_parallel,
        "skipped_far": skipped_far,
        "pair_debug": pair_debug,
        "roi_centroid_xy": None,
        "roi_centroid_ll": None,
        "roi_polygon_ll": None,
        "warning": None,
    }

    if len(intersections_xy) == 0:
        result["warning"] = (
            "Triangulation produced no valid intersections "
            "(bearings may be parallel/near-parallel or filtered by distance threshold)."
        )
        return result

    points_arr = np.array(intersections_xy, dtype=float)
    weights_arr = np.array(intersection_weights, dtype=float)
    weights_arr = np.where(np.isfinite(weights_arr) & (weights_arr > 0), weights_arr, 1.0)

    centroid_xy = np.average(points_arr, axis=0, weights=weights_arr)
    result["roi_centroid_xy"] = (float(centroid_xy[0]), float(centroid_xy[1]))

    centroid_lat, centroid_lon = local_proj.xy_to_ll(float(centroid_xy[0]), float(centroid_xy[1]))
    result["roi_centroid_ll"] = (centroid_lat, centroid_lon)

    deltas = points_arr - centroid_xy
    dists = np.linalg.norm(deltas, axis=1)
    weighted_rms = float(math.sqrt(np.average(dists ** 2, weights=weights_arr))) if len(dists) else 0.0
    result["roi_dispersion_rms_m"] = weighted_rms

    if len(intersections_xy) >= 3:
        hull_xy = convex_hull_points_xy(intersections_xy)
        if len(hull_xy) >= 3:
            hull_ll = [local_proj.xy_to_ll(x, y) for x, y in hull_xy]
            result["roi_polygon_ll"] = hull_ll
            result["roi_polygon_type"] = "convex_hull"
            return result

    radius_m = max(100.0, weighted_rms if weighted_rms > 0 else 500.0)
    circle_xy = make_circle_polygon_xy((float(centroid_xy[0]), float(centroid_xy[1])), radius_m, num_pts=36)
    circle_ll = [local_proj.xy_to_ll(x, y) for x, y in circle_xy]
    result["roi_polygon_ll"] = circle_ll
    result["roi_polygon_type"] = "circle_fallback"
    result["roi_fallback_radius_m"] = radius_m
    return result


def build_map(
    ants_prepared: List[Dict[str, Any]],
    ray_length_m: float,
    roi_result: Dict[str, Any],
) -> folium.Map:
    avg_lat = float(np.mean([a["lat"] for a in ants_prepared]))
    avg_lon = float(np.mean([a["lon"] for a in ants_prepared]))

    m = folium.Map(location=[avg_lat, avg_lon], zoom_start=12, tiles="OpenStreetMap")

    for ant in ants_prepared:
        ant_lat = ant["lat"]
        ant_lon = ant["lon"]
        bearing = ant["bearing_used"]

        ray_end_lat, ray_end_lon = geodesic_destination(ant_lat, ant_lon, bearing, ray_length_m)

        folium.Marker(
            location=[ant_lat, ant_lon],
            popup=folium.Popup(popup_html_for_antenna(ant, bearing), max_width=400),
            tooltip=f"Antenna {ant['id']}",
        ).add_to(m)

        folium.PolyLine(
            locations=[[ant_lat, ant_lon], [ray_end_lat, ray_end_lon]],
            weight=3,
            opacity=0.9,
            tooltip=f"{ant['id']} bearing {bearing:.1f}°",
        ).add_to(m)

    roi_polygon_ll = roi_result.get("roi_polygon_ll")
    if isinstance(roi_polygon_ll, list) and len(roi_polygon_ll) >= 3:
        polygon_locations = [[lat, lon] for lat, lon in roi_polygon_ll]
        roi_type = roi_result.get("roi_polygon_type", "roi")
        centroid_ll = roi_result.get("roi_centroid_ll")
        tooltip_text = f"Triangulated ROI ({roi_type})"
        if centroid_ll:
            tooltip_text += f" | centroid=({centroid_ll[0]:.6f}, {centroid_ll[1]:.6f})"

        folium.Polygon(
            locations=polygon_locations,
            weight=2,
            opacity=0.8,
            fill=True,
            fill_opacity=0.25,
            tooltip=tooltip_text,
        ).add_to(m)

    centroid_ll = roi_result.get("roi_centroid_ll")
    if centroid_ll:
        folium.CircleMarker(
            location=[centroid_ll[0], centroid_ll[1]],
            radius=6,
            weight=2,
            fill=True,
            fill_opacity=0.9,
            tooltip="Estimated ROI Centroid",
            popup=folium.Popup(
                f"<b>Estimated ROI Centroid</b><br>lat: {centroid_ll[0]:.6f}<br>lon: {centroid_ll[1]:.6f}<br>",
                max_width=300,
            ),
        ).add_to(m)

    return m


def main() -> None:
    if not is_number(ray_length_m) or float(ray_length_m) <= 0:
        raise ValueError("ray_length_m must be a positive numeric value.")
    if not is_number(parallel_angle_threshold_deg) or not (0.0 <= float(parallel_angle_threshold_deg) < 90.0):
        raise ValueError("parallel_angle_threshold_deg must be numeric in [0, 90).")
    if not is_number(max_intersection_distance_m) or float(max_intersection_distance_m) <= 0:
        raise ValueError("max_intersection_distance_m must be a positive numeric value.")

    runtime_antennas, source_note = load_runtime_antennas()
    print(source_note)
    ants_prepared = validate_and_prepare_antennas(runtime_antennas, flip_180_global=bool(flip_180))

    origin_lat = float(np.mean([a["lat"] for a in ants_prepared]))
    origin_lon = float(np.mean([a["lon"] for a in ants_prepared]))
    local_proj = LocalTangentPlane(origin_lat, origin_lon)

    roi_result = compute_intersections_and_roi(
        ants_prepared=ants_prepared,
        local_proj=local_proj,
        parallel_angle_threshold_deg=float(parallel_angle_threshold_deg),
        max_intersection_distance_m=float(max_intersection_distance_m),
    )

    fmap = build_map(ants_prepared, float(ray_length_m), roi_result)
    fmap.save(output_html)

    centroid_ll = roi_result.get("roi_centroid_ll")
    if centroid_ll:
        print(f"Estimated ROI centroid (lat, lon): ({centroid_ll[0]:.6f}, {centroid_ll[1]:.6f})")
    else:
        print("Estimated ROI centroid (lat, lon): N/A (no valid intersections)")

    if roi_result.get("warning"):
        print(f"WARNING: {roi_result['warning']}")

    print(f"Saved interactive triangulation map to: {output_html}")


if __name__ == "__main__":
    main()
