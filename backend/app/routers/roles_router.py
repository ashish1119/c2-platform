from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_user_claims
from app.schemas import RoleRead, RolePermissionAssign, RoleInheritanceCreate
from app.services.role_service import (
    list_roles as list_roles_service,
    assign_permission_to_role,
    add_role_inheritance,
    get_effective_permissions,
    grant_decodio_read_to_operator,
)

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("/", response_model=list[RoleRead])
async def list_roles(db: AsyncSession = Depends(get_db)):
    return await list_roles_service(db)


@router.post("/{role_id}/permissions")
async def add_permission(role_id: int, payload: RolePermissionAssign, db: AsyncSession = Depends(get_db)):
    await assign_permission_to_role(role_id, payload.permission_id, db)
    return {"status": "ok"}


@router.post("/inheritance")
async def create_inheritance(payload: RoleInheritanceCreate, db: AsyncSession = Depends(get_db)):
    await add_role_inheritance(payload.parent_role_id, payload.child_role_id, db)
    return {"status": "ok"}


@router.get("/{role_id}/effective-permissions")
async def effective_permissions(role_id: int, db: AsyncSession = Depends(get_db)):
    return await get_effective_permissions(role_id, db)


@router.post("/workflows/decodio-read-operator")
async def grant_decodio_read_operator_workflow(
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(get_current_user_claims),
):
    return await grant_decodio_read_to_operator(db, actor_user_id=claims.get("sub"))