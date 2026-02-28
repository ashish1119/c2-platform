import csv
import io
import json
import uuid
import xml.etree.ElementTree as ET
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Asset, DirectionFinderProfile


def _validate_rf_range(rf_min_mhz: float, rf_max_mhz: float):
    if rf_min_mhz <= 0:
        raise ValueError("rf_min_mhz must be greater than 0")
    if rf_max_mhz <= 0:
        raise ValueError("rf_max_mhz must be greater than 0")
    if rf_max_mhz <= rf_min_mhz:
        raise ValueError("rf_max_mhz must be greater than rf_min_mhz")


def _normalize_integrity_error(error: IntegrityError) -> ValueError:
    detail = str(getattr(error, "orig", error)).lower()
    if "direction_finder_profiles_serial_number_key" in detail or "serial_number" in detail:
        return ValueError("Serial number already exists")
    if "direction_finder_profiles_asset_id_key" in detail or "asset_id" in detail:
        return ValueError("Direction finder profile already exists for asset")
    return ValueError("Direction finder profile violates database constraints")


async def create_direction_finder_profile(data, db: AsyncSession):
    asset = await db.get(Asset, data.asset_id)
    if asset is None:
        raise ValueError("Asset not found")

    existing = await db.execute(
        select(DirectionFinderProfile).where(DirectionFinderProfile.asset_id == data.asset_id)
    )
    if existing.scalar_one_or_none() is not None:
        raise ValueError("Direction finder profile already exists for asset")

    payload = data.model_dump()
    _validate_rf_range(payload["rf_min_mhz"], payload["rf_max_mhz"])
    profile = DirectionFinderProfile(**payload)
    db.add(profile)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise _normalize_integrity_error(exc) from exc
    await db.refresh(profile)
    return profile


async def list_direction_finder_profiles(db: AsyncSession):
    rows = await db.execute(
        select(DirectionFinderProfile).order_by(DirectionFinderProfile.created_at.desc())
    )
    return rows.scalars().all()


async def get_direction_finder_profile(profile_id, db: AsyncSession):
    return await db.get(DirectionFinderProfile, profile_id)


async def update_direction_finder_profile(profile_id, data, db: AsyncSession):
    row = await db.get(DirectionFinderProfile, profile_id)
    if row is None:
        return None

    updates = data.model_dump(exclude_unset=True)
    rf_min = updates.get("rf_min_mhz", row.rf_min_mhz)
    rf_max = updates.get("rf_max_mhz", row.rf_max_mhz)
    _validate_rf_range(rf_min, rf_max)

    for key, value in updates.items():
        setattr(row, key, value)

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise _normalize_integrity_error(exc) from exc
    await db.refresh(row)
    return row


async def delete_direction_finder_profile(profile_id, db: AsyncSession):
    row = await db.get(DirectionFinderProfile, profile_id)
    if row is None:
        return False

    await db.delete(row)
    await db.commit()
    return True


def export_direction_finder_profiles_csv(rows):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id",
        "asset_id",
        "manufacturer",
        "model_number",
        "variant_block",
        "serial_number",
        "platform_class",
        "mobility_class",
        "mission_domain",
        "lifecycle_state",
        "antenna_array_type",
        "rf_min_mhz",
        "rf_max_mhz",
        "security_classification",
        "created_at",
    ])
    for row in rows:
        writer.writerow([
            row.id,
            row.asset_id,
            row.manufacturer,
            row.model_number,
            row.variant_block,
            row.serial_number,
            row.platform_class,
            row.mobility_class,
            row.mission_domain,
            row.lifecycle_state,
            row.antenna_array_type,
            row.rf_min_mhz,
            row.rf_max_mhz,
            row.security_classification,
            row.created_at,
        ])
    return output.getvalue()


def export_direction_finder_profiles_xml(rows):
    root = ET.Element("direction_finder_profiles")
    for row in rows:
        item = ET.SubElement(root, "direction_finder_profile")
        ET.SubElement(item, "id").text = str(row.id)
        ET.SubElement(item, "asset_id").text = str(row.asset_id)
        ET.SubElement(item, "manufacturer").text = row.manufacturer or ""
        ET.SubElement(item, "model_number").text = row.model_number or ""
        ET.SubElement(item, "variant_block").text = row.variant_block or ""
        ET.SubElement(item, "serial_number").text = row.serial_number or ""
        ET.SubElement(item, "platform_class").text = row.platform_class or ""
        ET.SubElement(item, "mobility_class").text = row.mobility_class or ""
        ET.SubElement(item, "mission_domain").text = row.mission_domain or ""
        ET.SubElement(item, "lifecycle_state").text = row.lifecycle_state or ""
        ET.SubElement(item, "antenna_array_type").text = row.antenna_array_type or ""
        ET.SubElement(item, "rf_min_mhz").text = str(row.rf_min_mhz)
        ET.SubElement(item, "rf_max_mhz").text = str(row.rf_max_mhz)
        ET.SubElement(item, "security_classification").text = row.security_classification or ""
        ET.SubElement(item, "created_at").text = str(row.created_at)
    return ET.tostring(root, encoding="unicode")


def _parse_json_array(value: str | None):
    if not value:
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass
    return [item.strip() for item in value.split(",") if item.strip()]


def _parse_json_object(value: str | None):
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    return {}


async def import_direction_finder_profiles_csv(content: str, db: AsyncSession):
    reader = csv.DictReader(io.StringIO(content))
    created = 0

    for row in reader:
        payload = {
            "asset_id": uuid.UUID(row["asset_id"]),
            "manufacturer": row.get("manufacturer") or "",
            "model_number": row.get("model_number") or "",
            "variant_block": row.get("variant_block"),
            "serial_number": row.get("serial_number") or "",
            "platform_class": row.get("platform_class") or "",
            "mobility_class": row.get("mobility_class") or "",
            "mission_domain": row.get("mission_domain") or "LAND",
            "lifecycle_state": row.get("lifecycle_state") or "ACTIVE_SERVICE",
            "antenna_array_type": row.get("antenna_array_type") or "CIRCULAR_ARRAY",
            "antenna_element_count": int(row["antenna_element_count"]) if row.get("antenna_element_count") else None,
            "antenna_polarization_support": _parse_json_array(row.get("antenna_polarization_support")),
            "receiver_channel_count": int(row["receiver_channel_count"]) if row.get("receiver_channel_count") else None,
            "sample_rate_max_sps": float(row["sample_rate_max_sps"]) if row.get("sample_rate_max_sps") else None,
            "frequency_reference_type": row.get("frequency_reference_type"),
            "frequency_reference_accuracy_ppb": float(row["frequency_reference_accuracy_ppb"]) if row.get("frequency_reference_accuracy_ppb") else None,
            "timing_holdover_seconds": int(row["timing_holdover_seconds"]) if row.get("timing_holdover_seconds") else None,
            "rf_min_mhz": float(row["rf_min_mhz"]),
            "rf_max_mhz": float(row["rf_max_mhz"]),
            "instantaneous_bandwidth_hz": float(row["instantaneous_bandwidth_hz"]) if row.get("instantaneous_bandwidth_hz") else None,
            "df_methods_supported": _parse_json_array(row.get("df_methods_supported")),
            "bearing_accuracy_deg_rms": float(row["bearing_accuracy_deg_rms"]) if row.get("bearing_accuracy_deg_rms") else None,
            "bearing_output_reference": row.get("bearing_output_reference"),
            "sensitivity_dbm": float(row["sensitivity_dbm"]) if row.get("sensitivity_dbm") else None,
            "dynamic_range_db": float(row["dynamic_range_db"]) if row.get("dynamic_range_db") else None,
            "calibration_profile_id": row.get("calibration_profile_id"),
            "deployment_mode": row.get("deployment_mode"),
            "site_id": row.get("site_id"),
            "mount_height_agl_m": float(row["mount_height_agl_m"]) if row.get("mount_height_agl_m") else None,
            "sensor_boresight_offset_deg": float(row["sensor_boresight_offset_deg"]) if row.get("sensor_boresight_offset_deg") else None,
            "heading_alignment_offset_deg": float(row["heading_alignment_offset_deg"]) if row.get("heading_alignment_offset_deg") else None,
            "lever_arm_offset_m": _parse_json_object(row.get("lever_arm_offset_m")),
            "geodetic_datum": row.get("geodetic_datum") or "WGS84",
            "altitude_reference": row.get("altitude_reference") or "MSL",
            "survey_position_accuracy_m": float(row["survey_position_accuracy_m"]) if row.get("survey_position_accuracy_m") else None,
            "network_node_id": row.get("network_node_id"),
            "primary_ipv4": row.get("primary_ipv4"),
            "transport_protocols": _parse_json_array(row.get("transport_protocols")),
            "message_protocols": _parse_json_array(row.get("message_protocols")),
            "data_format_profiles": _parse_json_array(row.get("data_format_profiles")),
            "time_sync_protocol": row.get("time_sync_protocol"),
            "ptp_profile": row.get("ptp_profile"),
            "api_version": row.get("api_version"),
            "interoperability_profile": row.get("interoperability_profile"),
            "security_classification": row.get("security_classification") or "SECRET",
            "releasability_marking": row.get("releasability_marking"),
            "authz_policy_id": row.get("authz_policy_id"),
            "data_in_transit_encryption": row.get("data_in_transit_encryption"),
            "secure_boot_enabled": (row.get("secure_boot_enabled") or "true").strip().lower() in {"1", "true", "yes"},
            "audit_policy_id": row.get("audit_policy_id"),
            "firmware_version": row.get("firmware_version"),
            "software_stack_version": row.get("software_stack_version"),
            "configuration_baseline_id": row.get("configuration_baseline_id"),
            "calibration_due_date": row.get("calibration_due_date"),
            "mtbf_hours": float(row["mtbf_hours"]) if row.get("mtbf_hours") else None,
            "maintenance_echelon": row.get("maintenance_echelon"),
        }

        _validate_rf_range(payload["rf_min_mhz"], payload["rf_max_mhz"])
        db.add(DirectionFinderProfile(**payload))
        created += 1

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise _normalize_integrity_error(exc) from exc

    return {"imported": created}


async def import_direction_finder_profiles_xml(content: str, db: AsyncSession):
    root = ET.fromstring(content)
    created = 0

    for node in root.findall("direction_finder_profile"):
        rf_min = float(node.findtext("rf_min_mhz"))
        rf_max = float(node.findtext("rf_max_mhz"))
        payload = {
            "asset_id": uuid.UUID(node.findtext("asset_id")),
            "manufacturer": node.findtext("manufacturer") or "",
            "model_number": node.findtext("model_number") or "",
            "variant_block": node.findtext("variant_block"),
            "serial_number": node.findtext("serial_number") or "",
            "platform_class": node.findtext("platform_class") or "",
            "mobility_class": node.findtext("mobility_class") or "",
            "mission_domain": node.findtext("mission_domain") or "LAND",
            "lifecycle_state": node.findtext("lifecycle_state") or "ACTIVE_SERVICE",
            "antenna_array_type": node.findtext("antenna_array_type") or "CIRCULAR_ARRAY",
            "rf_min_mhz": rf_min,
            "rf_max_mhz": rf_max,
            "security_classification": node.findtext("security_classification") or "SECRET",
            "antenna_polarization_support": [],
            "df_methods_supported": [],
            "lever_arm_offset_m": {},
            "transport_protocols": [],
            "message_protocols": [],
            "data_format_profiles": [],
            "geodetic_datum": "WGS84",
            "altitude_reference": "MSL",
            "secure_boot_enabled": True,
        }

        _validate_rf_range(rf_min, rf_max)
        db.add(DirectionFinderProfile(**payload))
        created += 1

    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise _normalize_integrity_error(exc) from exc

    return {"imported": created}
