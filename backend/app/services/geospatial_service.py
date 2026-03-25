from __future__ import annotations

import math
import uuid

from fastapi import HTTPException
from pyproj import Transformer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GeospatialIngestionSource
from app.services.audit_service import write_audit_log

try:
    import mgrs
except Exception:  # pragma: no cover - optional import guard for runtime packaging
    mgrs = None


SUPPORTED_SOURCE_TYPES = {
    "VECTOR",
    "RASTER",
    "LIDAR",
    "SAR",
    "BATHYMETRY",
    "UAV_IMAGERY",
    "AIS",
    "ADS_B",
    "SIGINT",
}

SUPPORTED_COORDINATE_SYSTEMS = {"WGS84", "UTM", "MGRS"}
ISO_19115_REQUIRED_FIELDS = {"fileIdentifier", "language", "dateStamp", "identificationInfo"}
ISO_19115_IDENTIFICATION_REQUIRED = {"title", "abstract"}


class GeospatialService:
    def __init__(self) -> None:
        self._mgrs_converter = mgrs.MGRS() if mgrs is not None else None

    def capabilities(self) -> dict:
        return {
            "source_types": sorted(SUPPORTED_SOURCE_TYPES),
            "coordinate_systems": sorted(SUPPORTED_COORDINATE_SYSTEMS),
            "mgrs_enabled": self._mgrs_converter is not None,
        }

    async def register_source(
        self,
        db: AsyncSession,
        *,
        source_name: str,
        source_type: str,
        transport: str,
        classification: str,
        metadata: dict,
        user_id: uuid.UUID | None,
    ) -> dict:
        normalized_source_type = source_type.strip().upper()
        if normalized_source_type not in SUPPORTED_SOURCE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported source_type '{source_type}'. Supported values: {sorted(SUPPORTED_SOURCE_TYPES)}",
            )

        self._validate_iso19115_metadata(metadata)

        normalized_name = source_name.strip()
        if not normalized_name:
            raise HTTPException(status_code=400, detail="source_name is required")

        existing = await db.execute(
            select(GeospatialIngestionSource.id).where(GeospatialIngestionSource.source_name == normalized_name)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=409, detail="Source with this name already exists")

        source = GeospatialIngestionSource(
            id=uuid.uuid4(),
            source_name=normalized_name,
            source_type=normalized_source_type,
            transport=transport.strip().upper(),
            classification=classification.strip().upper(),
            metadata_json=metadata,
        )
        db.add(source)
        await db.commit()
        await db.refresh(source)

        await write_audit_log(
            db,
            user_id=self._normalize_user_id(user_id),
            action="GEOSPATIAL_SOURCE_REGISTERED",
            entity="GEOSPATIAL_INGESTION_SOURCE",
            entity_id=source.id,
            details={
                "source_name": source.source_name,
                "source_type": source.source_type,
                "transport": source.transport,
                "classification": source.classification,
            },
        )
        return self._serialize_source(source)

    async def list_sources(self, db: AsyncSession) -> list[dict]:
        return await self.list_sources_filtered(db, active_only=False)

    async def list_sources_filtered(self, db: AsyncSession, *, active_only: bool) -> list[dict]:
        query = select(GeospatialIngestionSource).order_by(GeospatialIngestionSource.created_at.desc())
        if active_only:
            query = query.where(GeospatialIngestionSource.is_active.is_(True))
        result = await db.execute(query)
        rows = result.scalars().all()
        return [self._serialize_source(row) for row in rows]

    async def update_source(
        self,
        db: AsyncSession,
        *,
        source_id: str,
        user_id: uuid.UUID | None,
        source_name: str | None,
        source_type: str | None,
        transport: str | None,
        classification: str | None,
        metadata: dict | None,
    ) -> dict:
        source = await self._fetch_source_or_404(db, source_id)

        if source_name is not None:
            normalized_name = source_name.strip()
            if not normalized_name:
                raise HTTPException(status_code=400, detail="source_name cannot be empty")
            existing = await db.execute(
                select(GeospatialIngestionSource.id).where(
                    GeospatialIngestionSource.source_name == normalized_name,
                    GeospatialIngestionSource.id != source.id,
                )
            )
            if existing.scalar_one_or_none() is not None:
                raise HTTPException(status_code=409, detail="Source with this name already exists")
            source.source_name = normalized_name

        if source_type is not None:
            normalized_source_type = source_type.strip().upper()
            if normalized_source_type not in SUPPORTED_SOURCE_TYPES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported source_type '{source_type}'. Supported values: {sorted(SUPPORTED_SOURCE_TYPES)}",
                )
            source.source_type = normalized_source_type

        if transport is not None:
            source.transport = transport.strip().upper()

        if classification is not None:
            source.classification = classification.strip().upper()

        if metadata is not None:
            self._validate_iso19115_metadata(metadata)
            source.metadata_json = metadata

        await db.commit()
        await db.refresh(source)

        await write_audit_log(
            db,
            user_id=self._normalize_user_id(user_id),
            action="GEOSPATIAL_SOURCE_UPDATED",
            entity="GEOSPATIAL_INGESTION_SOURCE",
            entity_id=source.id,
            details={
                "source_name": source.source_name,
                "source_type": source.source_type,
                "transport": source.transport,
                "classification": source.classification,
                "is_active": source.is_active,
            },
        )
        return self._serialize_source(source)

    async def deactivate_source(self, db: AsyncSession, *, source_id: str, user_id: uuid.UUID | None) -> dict:
        source = await self._fetch_source_or_404(db, source_id)
        if not source.is_active:
            return self._serialize_source(source)

        source.is_active = False
        await db.commit()
        await db.refresh(source)

        await write_audit_log(
            db,
            user_id=self._normalize_user_id(user_id),
            action="GEOSPATIAL_SOURCE_DEACTIVATED",
            entity="GEOSPATIAL_INGESTION_SOURCE",
            entity_id=source.id,
            details={
                "source_name": source.source_name,
                "source_type": source.source_type,
            },
        )
        return self._serialize_source(source)

    async def activate_source(self, db: AsyncSession, *, source_id: str, user_id: uuid.UUID | None) -> dict:
        source = await self._fetch_source_or_404(db, source_id)
        if source.is_active:
            return self._serialize_source(source)

        source.is_active = True
        await db.commit()
        await db.refresh(source)

        await write_audit_log(
            db,
            user_id=self._normalize_user_id(user_id),
            action="GEOSPATIAL_SOURCE_ACTIVATED",
            entity="GEOSPATIAL_INGESTION_SOURCE",
            entity_id=source.id,
            details={
                "source_name": source.source_name,
                "source_type": source.source_type,
            },
        )
        return self._serialize_source(source)

    def convert_coordinates(
        self,
        *,
        source_system: str,
        target_system: str,
        latitude: float | None,
        longitude: float | None,
        easting: float | None,
        northing: float | None,
        utm_zone: int | None,
        hemisphere: str | None,
        mgrs_value: str | None,
    ) -> dict:
        source = source_system.strip().upper()
        target = target_system.strip().upper()

        if source not in SUPPORTED_COORDINATE_SYSTEMS or target not in SUPPORTED_COORDINATE_SYSTEMS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported coordinate system conversion {source}->{target}.",
            )

        if source == target:
            raise HTTPException(status_code=400, detail="source_system and target_system must be different")

        if source == "WGS84" and target == "UTM":
            return self._wgs84_to_utm(latitude=latitude, longitude=longitude)

        if source == "UTM" and target == "WGS84":
            return self._utm_to_wgs84(
                easting=easting,
                northing=northing,
                utm_zone=utm_zone,
                hemisphere=hemisphere,
            )

        if source == "WGS84" and target == "MGRS":
            return self._wgs84_to_mgrs(latitude=latitude, longitude=longitude)

        if source == "MGRS" and target == "WGS84":
            return self._mgrs_to_wgs84(mgrs_value=mgrs_value)

        if source == "UTM" and target == "MGRS":
            wgs84 = self._utm_to_wgs84(
                easting=easting,
                northing=northing,
                utm_zone=utm_zone,
                hemisphere=hemisphere,
            )
            return self._wgs84_to_mgrs(latitude=wgs84["latitude"], longitude=wgs84["longitude"])

        if source == "MGRS" and target == "UTM":
            wgs84 = self._mgrs_to_wgs84(mgrs_value=mgrs_value)
            return self._wgs84_to_utm(latitude=wgs84["latitude"], longitude=wgs84["longitude"])

        raise HTTPException(status_code=400, detail=f"Unsupported conversion {source}->{target}")

    def _wgs84_to_utm(self, *, latitude: float | None, longitude: float | None) -> dict:
        if latitude is None or longitude is None:
            raise HTTPException(status_code=400, detail="latitude and longitude are required for WGS84 conversion")

        zone = int(math.floor((longitude + 180.0) / 6.0) + 1)
        hemisphere = "N" if latitude >= 0 else "S"
        epsg_code = 32600 + zone if hemisphere == "N" else 32700 + zone

        transformer = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg_code}", always_xy=True)
        easting, northing = transformer.transform(longitude, latitude)
        return {
            "easting": round(easting, 3),
            "northing": round(northing, 3),
            "utm_zone": zone,
            "hemisphere": hemisphere,
            "datum": "WGS84",
        }

    def _utm_to_wgs84(
        self,
        *,
        easting: float | None,
        northing: float | None,
        utm_zone: int | None,
        hemisphere: str | None,
    ) -> dict:
        if easting is None or northing is None or utm_zone is None:
            raise HTTPException(
                status_code=400,
                detail="easting, northing and utm_zone are required for UTM conversion",
            )

        hemi = (hemisphere or "N").strip().upper()
        if hemi not in {"N", "S"}:
            raise HTTPException(status_code=400, detail="hemisphere must be 'N' or 'S'")

        epsg_code = 32600 + utm_zone if hemi == "N" else 32700 + utm_zone
        transformer = Transformer.from_crs(f"EPSG:{epsg_code}", "EPSG:4326", always_xy=True)
        longitude, latitude = transformer.transform(easting, northing)

        return {
            "latitude": round(latitude, 8),
            "longitude": round(longitude, 8),
            "datum": "WGS84",
        }

    def _wgs84_to_mgrs(self, *, latitude: float | None, longitude: float | None) -> dict:
        if self._mgrs_converter is None:
            raise HTTPException(status_code=501, detail="MGRS conversion package is not available")
        if latitude is None or longitude is None:
            raise HTTPException(status_code=400, detail="latitude and longitude are required for MGRS conversion")

        mgrs_value = self._mgrs_converter.toMGRS(latitude, longitude)
        return {"mgrs": mgrs_value, "datum": "WGS84"}

    def _mgrs_to_wgs84(self, *, mgrs_value: str | None) -> dict:
        if self._mgrs_converter is None:
            raise HTTPException(status_code=501, detail="MGRS conversion package is not available")
        if not mgrs_value:
            raise HTTPException(status_code=400, detail="mgrs is required for MGRS conversion")

        latitude, longitude = self._mgrs_converter.toLatLon(mgrs_value.strip().upper())
        return {
            "latitude": round(latitude, 8),
            "longitude": round(longitude, 8),
            "datum": "WGS84",
        }

    @staticmethod
    def _validate_iso19115_metadata(metadata: dict) -> None:
        missing_top_level = sorted([key for key in ISO_19115_REQUIRED_FIELDS if key not in metadata])
        if missing_top_level:
            raise HTTPException(
                status_code=422,
                detail=f"metadata is missing ISO 19115 fields: {missing_top_level}",
            )

        identification_info = metadata.get("identificationInfo")
        if not isinstance(identification_info, dict):
            raise HTTPException(
                status_code=422,
                detail="metadata.identificationInfo must be an object",
            )

        missing_identification = sorted(
            [key for key in ISO_19115_IDENTIFICATION_REQUIRED if key not in identification_info]
        )
        if missing_identification:
            raise HTTPException(
                status_code=422,
                detail=f"metadata.identificationInfo is missing fields: {missing_identification}",
            )

    @staticmethod
    def _serialize_source(source: GeospatialIngestionSource) -> dict:
        return {
            "source_id": str(source.id),
            "source_name": source.source_name,
            "source_type": source.source_type,
            "transport": source.transport,
            "classification": source.classification,
            "is_active": bool(source.is_active),
            "metadata": source.metadata_json,
            "created_at": source.created_at,
            "updated_at": source.updated_at,
        }

    @staticmethod
    async def _fetch_source_or_404(db: AsyncSession, source_id: str) -> GeospatialIngestionSource:
        try:
            parsed_id = uuid.UUID(source_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid source_id")

        result = await db.execute(
            select(GeospatialIngestionSource).where(GeospatialIngestionSource.id == parsed_id)
        )
        source = result.scalar_one_or_none()
        if source is None:
            raise HTTPException(status_code=404, detail="Geospatial ingestion source not found")
        return source

    @staticmethod
    def _normalize_user_id(user_id: uuid.UUID | None) -> uuid.UUID | None:
        if user_id is None:
            return None
        try:
            return uuid.UUID(str(user_id))
        except (ValueError, TypeError):
            return None


geospatial_service = GeospatialService()
