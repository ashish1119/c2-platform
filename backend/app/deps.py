import uuid
from typing import Any

from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.config import settings
from app.core.security import decode_access_token
from app.database import AsyncSessionLocal
from app.models import User
from app.services.role_service import get_effective_permissions
from sqlalchemy import select

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user_claims(
	request: Request,
	credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
	cookie_token: str | None = Cookie(default=None, alias=settings.ACCESS_TOKEN_COOKIE_NAME),
) -> dict[str, Any]:
	token = credentials.credentials if credentials else cookie_token
	if not token:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Authentication required",
		)
	try:
		payload = decode_access_token(token)
	except JWTError:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Invalid token",
		)

	user_id = payload.get("sub")
	role = payload.get("role")
	if not user_id or not role:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Invalid token payload",
		)
	return payload


async def require_admin_role(claims: dict[str, Any] = Depends(get_current_user_claims)) -> dict[str, Any]:
	role = str(claims.get("role", "")).upper()
	if role != "ADMIN":
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
	return claims


def require_permission(resource: str, action: str):
	async def permission_checker(claims: dict[str, Any] = Depends(get_current_user_claims)) -> dict[str, Any]:
		user_id_raw = claims.get("sub")
		try:
			user_id = uuid.UUID(str(user_id_raw))
		except (ValueError, TypeError):
			raise HTTPException(
				status_code=status.HTTP_401_UNAUTHORIZED,
				detail="Invalid token subject",
			)

		async with AsyncSessionLocal() as session:
			user = (
				await session.execute(select(User.id, User.role_id).where(User.id == user_id))
			).one_or_none()

			if user is None:
				raise HTTPException(
					status_code=status.HTTP_401_UNAUTHORIZED,
					detail="User not found",
				)

			role_id = user.role_id
			if role_id is None:
				raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

			effective_permissions = await get_effective_permissions(role_id, session)
			permission_set = {(p["resource"], p["action"]) for p in effective_permissions}

			is_allowed = (
				(resource, action) in permission_set
				or (resource, "*") in permission_set
				or ("*", action) in permission_set
				or ("*", "*") in permission_set
			)

			if not is_allowed:
				raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

		return claims

	return permission_checker
