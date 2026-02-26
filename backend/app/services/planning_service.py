import math


def simulate_coverage(data):
    points = []
    radius_deg = data.radius_km / 111.0
    for angle in range(0, 360, 15):
        rad = math.radians(angle)
        lat = data.center_latitude + radius_deg * math.sin(rad)
        lon = data.center_longitude + radius_deg * math.cos(rad)
        distance_factor = max(0.1, 1.0 - (angle / 360.0))
        coverage_db = data.transmit_power_dbm - (32.44 + 20 * math.log10(data.frequency_mhz)) * distance_factor
        points.append({
            "latitude": lat,
            "longitude": lon,
            "coverage_db": round(coverage_db, 2),
        })

    return {
        "scenario_name": data.scenario_name,
        "model_name": data.model_name,
        "points": points,
    }
