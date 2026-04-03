from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class DecodioMessage(BaseModel):
    messageType: str | None = None
    name: str | None = None
    method: str | None = None
    requestId: str | None = None
    success: bool | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime | None = None

    model_config = {"extra": "allow"}


class DecodioConnectionHealth(BaseModel):
    enabled: bool
    state: str
    connected: bool
    host: str
    port: int
    reconnect_attempts: int
    last_error: str | None = None
    last_message_at: datetime | None = None