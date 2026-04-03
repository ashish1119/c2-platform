import asyncio
from datetime import datetime, timedelta, timezone
from collections import defaultdict, deque
import re
import threading
import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
import uuid
from app.database import AsyncSessionLocal
from app.models import PasswordResetToken, User
from app.core.rate_limiter import limiter
from app.core.security import (
    create_access_token,
    generate_password_reset_token,
    hash_password,
    hash_reset_token,
    revoke_access_token,
    verify_password,
)
from app.config import settings
from app.deps import get_current_user_claims
from app.services.role_service import get_effective_permissions
from app.core.websocket_manager import manager
from app.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    PasswordResetConfirmRequest,
    PasswordResetRequestStart,
)

router = APIRouter(prefix="/auth", tags=["auth"])
LOGIN_RATE_LIMIT = "60/minute"
RESET_RATE_LIMIT = "3/15minutes"
MAX_FAILED_LOGINS_PER_USER_WINDOW = 10
FAILED_LOGIN_WINDOW_SECONDS = 60
_FAILED_LOGIN_ATTEMPTS: dict[str, deque[float]] = defaultdict(deque)
_FAILED_LOGIN_LOCK = threading.Lock()


def _validate_strong_password(password: str) -> None:
    if len(password) < 12:
        raise HTTPException(status_code=400, detail="Password must be at least 12 characters")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Password must include at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise HTTPException(status_code=400, detail="Password must include at least one lowercase letter")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Password must include at least one number")
    if not re.search(r"[^A-Za-z0-9]", password):
        raise HTTPException(status_code=400, detail="Password must include at least one special character")


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def _build_login_response(user: User, db: AsyncSession) -> LoginResponse:
    if user.role is None or user.role_id is None:
        raise HTTPException(status_code=403, detail="User role misconfigured")

    permission_rows = await get_effective_permissions(user.role_id, db) if user.role_id else []
    permissions = [f"{row['resource']}:{row['action']}" for row in permission_rows]
    token = create_access_token(
        {"sub": str(user.id), "role": user.role.name, "permissions": permissions}
    )

    return LoginResponse(
        id=user.id,
        username=user.username,
        role=user.role.name,
        token=token,
        permissions=permissions,
    )


def _set_access_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.ACCESS_TOKEN_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.ACCESS_TOKEN_COOKIE_SECURE,
        samesite=settings.ACCESS_TOKEN_COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


def _clear_access_cookie(response: Response) -> None:
    response.delete_cookie(key=settings.ACCESS_TOKEN_COOKIE_NAME, path="/")


def _extract_request_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        if token:
            return token
    cookie_token = request.cookies.get(settings.ACCESS_TOKEN_COOKIE_NAME)
    return cookie_token.strip() if cookie_token else None


def _prune_attempts(entries: deque[float], now_ts: float) -> None:
    while entries and now_ts - entries[0] > FAILED_LOGIN_WINDOW_SECONDS:
        entries.popleft()


def _assert_login_not_locked(username: str) -> None:
    key = username.strip().lower()
    if not key:
        return

    now_ts = time.time()
    with _FAILED_LOGIN_LOCK:
        attempts = _FAILED_LOGIN_ATTEMPTS[key]
        _prune_attempts(attempts, now_ts)
        if len(attempts) >= MAX_FAILED_LOGINS_PER_USER_WINDOW:
            retry_after = int(max(1, FAILED_LOGIN_WINDOW_SECONDS - (now_ts - attempts[0])))
            raise HTTPException(status_code=429, detail=f"Too many failed login attempts. Retry in {retry_after}s")


def _record_login_failure(username: str) -> None:
    key = username.strip().lower()
    if not key:
        return

    now_ts = time.time()
    with _FAILED_LOGIN_LOCK:
        attempts = _FAILED_LOGIN_ATTEMPTS[key]
        _prune_attempts(attempts, now_ts)
        attempts.append(now_ts)


def _clear_login_failures(username: str) -> None:
    key = username.strip().lower()
    if not key:
        return
    with _FAILED_LOGIN_LOCK:
        _FAILED_LOGIN_ATTEMPTS.pop(key, None)


@router.post("/login")
@limiter.limit(LOGIN_RATE_LIMIT)
async def login(request: Request, response: Response, data: LoginRequest, db: AsyncSession = Depends(get_db)):
    _assert_login_not_locked(data.username)

    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.username == data.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(
        data.password, user.hashed_password
    ):
        _record_login_failure(data.username)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    _clear_login_failures(data.username)

    login_response = await _build_login_response(user, db)
    if login_response.token:
        _set_access_cookie(response, login_response.token)
    return login_response


@router.get("/me")
async def get_current_session(
    claims: dict = Depends(get_current_user_claims),
    db: AsyncSession = Depends(get_db),
):
    try:
        user_id = uuid.UUID(str(claims.get("sub")))
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token subject")

    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    session_response = await _build_login_response(user, db)
    session_response.token = None
    return session_response


@router.post("/logout")
async def logout(request: Request, response: Response):
    token = _extract_request_token(request)
    if token:
        token_jti: str | None = None
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
                options={"verify_exp": False},
            )
            raw_jti = payload.get("jti")
            token_jti = str(raw_jti) if raw_jti else None
            revoke_access_token(token)
        except JWTError:
            # Invalid/expired tokens are effectively unusable and can be ignored here.
            pass

        if token_jti:
            try:
                await asyncio.wait_for(manager.disconnect_by_jti(token_jti), timeout=2.0)
            except Exception:
                # Logout should remain responsive even if websocket teardown stalls.
                pass

    _clear_access_cookie(response)
    return {"message": "Logged out successfully"}


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    claims: dict = Depends(get_current_user_claims),
    db: AsyncSession = Depends(get_db),
):
    try:
        user_id = uuid.UUID(str(claims.get("sub")))
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token subject")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    _validate_strong_password(payload.new_password)

    user.hashed_password = hash_password(payload.new_password)
    await db.commit()

    return {"message": "Password changed successfully"}


@router.post("/password-reset/request")
@limiter.limit(RESET_RATE_LIMIT)
async def request_password_reset(
    request: Request,
    payload: PasswordResetRequestStart,
    db: AsyncSession = Depends(get_db),
):
    identifier = payload.identifier.strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="Identifier is required")

    result = await db.execute(
        select(User).where(
            (User.username == identifier) | (User.email == identifier),
            User.is_active.is_(True),
        )
    )
    user = result.scalar_one_or_none()

    raw_token: str | None = None
    if user is not None:
        now = datetime.now(timezone.utc)
        await db.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
            .values(used_at=now)
        )

        raw_token = generate_password_reset_token()
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=hash_reset_token(raw_token),
                expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_TTL_MINUTES),
            )
        )
        await db.commit()

    response_payload: dict[str, str] = {"message": "If the account exists, a reset token has been issued."}
    if raw_token and settings.PASSWORD_RESET_EXPOSE_TOKEN_IN_DEV and settings.ENVIRONMENT.lower() == "development":
        response_payload["reset_token"] = raw_token
    return response_payload


@router.post("/password-reset/confirm")
@limiter.limit(RESET_RATE_LIMIT)
async def confirm_password_reset(
    request: Request,
    payload: PasswordResetConfirmRequest,
    db: AsyncSession = Depends(get_db),
):
    _validate_strong_password(payload.new_password)

    token_hash = hash_reset_token(payload.token)
    result = await db.execute(
        select(PasswordResetToken)
        .options(selectinload(PasswordResetToken.user))
        .where(PasswordResetToken.token_hash == token_hash)
    )
    reset_token = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if (
        reset_token is None
        or reset_token.used_at is not None
        or reset_token.expires_at <= now
        or reset_token.user is None
        or not reset_token.user.is_active
    ):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    if verify_password(payload.new_password, reset_token.user.hashed_password):
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    reset_token.user.hashed_password = hash_password(payload.new_password)
    reset_token.used_at = now
    await db.commit()

    return {"message": "Password reset successfully"}