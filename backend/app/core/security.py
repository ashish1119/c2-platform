import hashlib
import secrets
import threading
import time
import uuid
from datetime import datetime, timedelta
from jose import jwt
from jose import JWTError
from passlib.context import CryptContext
from redis import Redis
from redis.exceptions import RedisError
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_REVOKED_TOKENS: dict[str, int] = {}
_REVOKED_TOKENS_LOCK = threading.Lock()
_REDIS_CLIENT: Redis | None = None
_REDIS_LOCK = threading.Lock()
_REDIS_UNAVAILABLE_LOGGED = False


def hash_password(password: str):
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str):
    if not hashed:
        return False
    return pwd_context.verify(password, hashed)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "jti": str(uuid.uuid4()),
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    jti = payload.get("jti")
    if not jti:
        raise JWTError("Invalid token payload")

    if _is_token_revoked(str(jti)):
        raise JWTError("Token revoked")

    _cleanup_revoked_tokens()
    with _REVOKED_TOKENS_LOCK:
        if jti in _REVOKED_TOKENS:
            raise JWTError("Token revoked")
    return payload


def revoke_access_token(token: str) -> None:
    payload = jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        options={"verify_exp": False},
    )
    jti = payload.get("jti")
    if not jti:
        return

    exp = payload.get("exp")
    try:
        exp_ts = int(exp) if exp is not None else int(time.time()) + (settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    except (TypeError, ValueError):
        exp_ts = int(time.time()) + (settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)

    with _REVOKED_TOKENS_LOCK:
        _REVOKED_TOKENS[str(jti)] = exp_ts

    redis_client = _get_redis_client()
    if redis_client is not None:
        ttl_seconds = max(1, exp_ts - int(time.time()))
        try:
            redis_client.setex(_revoked_token_key(str(jti)), ttl_seconds, "1")
        except RedisError:
            # Keep local in-memory fallback active even if Redis write fails.
            pass


def _cleanup_revoked_tokens() -> None:
    now_ts = int(time.time())
    with _REVOKED_TOKENS_LOCK:
        expired = [jti for jti, exp_ts in _REVOKED_TOKENS.items() if exp_ts <= now_ts]
        for jti in expired:
            _REVOKED_TOKENS.pop(jti, None)


def _revoked_token_key(jti: str) -> str:
    return f"auth:revoked:{jti}"


def _get_redis_client() -> Redis | None:
    global _REDIS_CLIENT
    global _REDIS_UNAVAILABLE_LOGGED

    if not settings.REDIS_URL:
        return None

    with _REDIS_LOCK:
        if _REDIS_CLIENT is not None:
            return _REDIS_CLIENT

        try:
            candidate = Redis.from_url(settings.REDIS_URL, decode_responses=True)
            candidate.ping()
            _REDIS_CLIENT = candidate
            return _REDIS_CLIENT
        except RedisError:
            if not _REDIS_UNAVAILABLE_LOGGED:
                _REDIS_UNAVAILABLE_LOGGED = True
            return None


def _is_token_revoked(jti: str) -> bool:
    redis_client = _get_redis_client()
    if redis_client is not None:
        try:
            return bool(redis_client.exists(_revoked_token_key(jti)))
        except RedisError:
            # Fall through to in-memory fallback.
            pass
    return False


def generate_password_reset_token() -> str:
    return secrets.token_urlsafe(48)


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()