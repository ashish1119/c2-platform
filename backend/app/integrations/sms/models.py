from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class SmsAdapterDetectionRaw(BaseModel):
    source_node: str | None = None
    timestamp_utc: datetime | None = None
    frequency_hz: int | None = Field(default=None, gt=0)
    bandwidth_hz: int | None = Field(default=None, gt=0)
    power_dbm: float | None = None
    snr_db: float | None = None
    modulation: str | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)

    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    altitude_m: float | None = None

    doa_azimuth_deg: float | None = Field(default=None, ge=0.0, lt=360.0)
    doa_elevation_deg: float | None = Field(default=None, ge=-90.0, le=90.0)
    doa_rmse_deg: float | None = Field(default=None, ge=0.0)

    raw_payload: dict[str, Any] = Field(default_factory=dict)


class SmsAdapterEnvelope(BaseModel):
    source_node: str
    detections: list[dict[str, Any]] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)


class SmsAdapterConnectionHealth(BaseModel):
    running: bool
    queue_depth: int = 0
    processed_messages: int = 0
    accepted_detections: int = 0
    rejected_detections: int = 0
    last_message_at: datetime | None = None
    last_error: str | None = None


class SmsThreatStatusUpdate(BaseModel):
    status: str = Field(default="ACK")

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().upper()
        allowed = {"OPEN", "ACK", "MITIGATED", "CLOSED"}
        if normalized not in allowed:
            raise ValueError("status must be one of OPEN, ACK, MITIGATED, CLOSED")
        return normalized