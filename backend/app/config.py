from functools import lru_cache
from typing import List

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Core
    APP_NAME: str = "C2 Platform"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str = Field(...)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ACCESS_TOKEN_COOKIE_NAME: str = "access_token"
    ACCESS_TOKEN_COOKIE_SAMESITE: str = "lax"
    ACCESS_TOKEN_COOKIE_SECURE: bool | None = None
    PASSWORD_RESET_TOKEN_TTL_MINUTES: int = 15
    PASSWORD_RESET_EXPOSE_TOKEN_IN_DEV: bool | None = None
    ADMIN_BOOTSTRAP_USERNAME: str | None = None
    ADMIN_BOOTSTRAP_EMAIL: str | None = None
    ADMIN_BOOTSTRAP_PASSWORD: str | None = None
    OPERATOR_BOOTSTRAP_USERNAME: str | None = None
    OPERATOR_BOOTSTRAP_EMAIL: str | None = None
    OPERATOR_BOOTSTRAP_PASSWORD: str | None = None

    # Database
    DATABASE_URL: str = Field(...)

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]
    BACKEND_CORS_ORIGIN_REGEX: str = (
        r"^https?://("
        r"localhost"
        r"|127\.0\.0\.1"
        r"|0\.0\.0\.0"
        r"|192\.168\.\d+\.\d+"
        r"|10\.\d+\.\d+\.\d+"
        r"|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+"
        r")(:\d+)?$"
    )

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

    # CRFS pbd2 integration
    CRFS_ENABLED: bool = False
    CRFS_HOST: str = "0.0.0.0"
    CRFS_PORT: int = 9400
    CRFS_IDLE_TIMEOUT_SECONDS: int = 30
    CRFS_MAX_MESSAGE_BYTES: int = 1048576
    CRFS_LENGTH_ENDIAN: str = "big"
    CRFS_SIGNAL_POWER_ALERT_THRESHOLD: float = -45.0
    CRFS_AOA_DELTA_ALERT_THRESHOLD_DEG: float = 20.0

    # Event streaming backend
    REDIS_URL: str | None = None
    CRFS_REDIS_STREAM: str = "crfs.events"

    @model_validator(mode="after")
    def apply_security_defaults(self):
        is_development = self.ENVIRONMENT.lower() == "development"
        if self.ACCESS_TOKEN_COOKIE_SECURE is None:
            self.ACCESS_TOKEN_COOKIE_SECURE = not is_development
        if self.PASSWORD_RESET_EXPOSE_TOKEN_IN_DEV is None:
            self.PASSWORD_RESET_EXPOSE_TOKEN_IN_DEV = is_development
        if not is_development and not self.REDIS_URL:
            raise ValueError("REDIS_URL must be configured outside development for secure token revocation")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()