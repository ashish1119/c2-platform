from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class TcpIncomingMessage(BaseModel):
    msg_id: str = Field(min_length=1)
    sender_id: str = Field(min_length=1)
    event_type: str = Field(min_length=1)
    value: float
    unit: str | None = None
    severity_hint: str | None = None
    ts: datetime
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @field_validator("severity_hint")
    @classmethod
    def normalize_severity_hint(cls, value: str | None):
        if value is None:
            return None
        normalized = value.strip().upper()
        allowed = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
        if normalized not in allowed:
            raise ValueError("severity_hint must be LOW, MEDIUM, HIGH, or CRITICAL")
        return normalized
