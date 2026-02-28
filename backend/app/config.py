from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Core
    APP_NAME: str = "C2 Platform"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security
    SECRET_KEY: str = Field(...)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Database
    DATABASE_URL: str = Field(...)

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 30

    # Logging
    LOG_LEVEL: str = "INFO"

    # Decodio integration
    DECODIO_ENABLED: bool = False
    DECODIO_HOST: str = "127.0.0.1"
    DECODIO_PORT: int = 9100
    DECODIO_CONNECT_TIMEOUT_SECONDS: float = 5.0
    DECODIO_READ_TIMEOUT_SECONDS: float = 45.0
    DECODIO_HEARTBEAT_INTERVAL_SECONDS: int = 15
    DECODIO_ACK_TIMEOUT_SECONDS: float = 8.0
    DECODIO_RECONNECT_MAX_SECONDS: int = 60

    # TCP listener integration
    TCP_LISTENER_ENABLED: bool = False
    TCP_LISTENER_HOST: str = "0.0.0.0"
    TCP_LISTENER_PORT: int = 9300
    TCP_LISTENER_IDLE_TIMEOUT_SECONDS: int = 30
    TCP_LISTENER_MAX_LINE_BYTES: int = 16384


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()