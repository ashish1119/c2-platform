from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import require_admin_role
from app.schemas import RoleRead, RoleCreate, RoleUpdate, RolePermissionAssign, RoleInheritanceCreate
from app.services.role_service import (
    list_roles as list_roles_service,
    create_role as create_role_service,
    update_role as update_role_service,
    delete_role as delete_role_service,
    assign_permission_to_role,
    add_role_inheritance,
    get_effective_permissions,
    grant_decodio_read_to_operator,
)

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("/", response_model=list[RoleRead])
async def list_roles(db: AsyncSession = Depends(get_db), _claims: dict = Depends(require_admin_role)):
    return await list_roles_service(db)


@router.post("/", response_model=RoleRead)
async def create_role(payload: RoleCreate, db: AsyncSession = Depends(get_db), _claims: dict = Depends(require_admin_role)):
    return await create_role_service(payload.name, payload.level, db)


@router.put("/{role_id}", response_model=RoleRead)
async def update_role(role_id: int, payload: RoleUpdate, db: AsyncSession = Depends(get_db), _claims: dict = Depends(require_admin_role)):
    return await update_role_service(role_id, payload.name, payload.level, db)


@router.delete("/{role_id}")
async def remove_role(role_id: int, db: AsyncSession = Depends(get_db), _claims: dict = Depends(require_admin_role)):
    await delete_role_service(role_id, db)
    return {"status": "ok"}


@router.post("/{role_id}/permissions")
async def add_permission(role_id: int, payload: RolePermissionAssign, db: AsyncSession = Depends(get_db), _claims: dict = Depends(require_admin_role)):
    await assign_permission_to_role(role_id, payload.permission_id, db)
    return {"status": "ok"}


@router.post("/inheritance")
async def create_inheritance(payload: RoleInheritanceCreate, db: AsyncSession = Depends(get_db), _claims: dict = Depends(require_admin_role)):
    await add_role_inheritance(payload.parent_role_id, payload.child_role_id, db)
    return {"status": "ok"}


@router.get("/{role_id}/effective-permissions")
async def effective_permissions(role_id: int, db: AsyncSession = Depends(get_db), _claims: dict = Depends(require_admin_role)):
    return await get_effective_permissions(role_id, db)


@router.post("/workflows/decodio-read-operator")
async def grant_decodio_read_operator_workflow(
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(require_admin_role),
):
    return await grant_decodio_read_to_operator(db, actor_user_id=claims.get("sub"))