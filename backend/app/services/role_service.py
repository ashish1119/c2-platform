from collections import deque
import uuid
from sqlalchemy import select, insert, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AuditLog
from app.models import Role, Permission, role_permissions, role_inheritance


async def list_roles(db: AsyncSession):
	result = await db.execute(select(Role))
	return result.scalars().all()


async def create_permission(resource: str, action: str, scope: str, db: AsyncSession):
	permission = Permission(resource=resource, action=action, scope=scope)
	db.add(permission)
	await db.commit()
	await db.refresh(permission)
	return permission


async def list_permissions(db: AsyncSession):
	result = await db.execute(select(Permission))
	return result.scalars().all()


async def assign_permission_to_role(role_id: int, permission_id: int, db: AsyncSession):
	await db.execute(
		pg_insert(role_permissions)
		.values(role_id=role_id, permission_id=permission_id)
		.on_conflict_do_nothing(index_elements=["role_id", "permission_id"])
	)
	await db.commit()


async def add_role_inheritance(parent_role_id: int, child_role_id: int, db: AsyncSession):
	await db.execute(
		pg_insert(role_inheritance)
		.values(parent_role_id=parent_role_id, child_role_id=child_role_id)
		.on_conflict_do_nothing(index_elements=["parent_role_id", "child_role_id"])
	)
	await db.commit()


async def get_effective_permissions(role_id: int, db: AsyncSession):
	queue = deque([role_id])
	visited = set()
	permissions = set()

	while queue:
		current_role_id = queue.popleft()
		if current_role_id in visited:
			continue
		visited.add(current_role_id)

		role_perm_rows = await db.execute(
			select(Permission.resource, Permission.action, Permission.scope)
			.select_from(role_permissions.join(Permission, role_permissions.c.permission_id == Permission.id))
			.where(role_permissions.c.role_id == current_role_id)
		)
		for resource, action, scope in role_perm_rows.all():
			permissions.add((resource, action, scope))

		parent_rows = await db.execute(
			select(role_inheritance.c.parent_role_id)
			.where(role_inheritance.c.child_role_id == current_role_id)
		)
		for (parent_id,) in parent_rows.all():
			queue.append(parent_id)

	return [
		{"resource": resource, "action": action, "scope": scope}
		for resource, action, scope in sorted(permissions)
	]


async def grant_decodio_read_to_operator(db: AsyncSession, actor_user_id: str | None = None):
	operator_role = (await db.execute(select(Role).where(Role.name == "OPERATOR"))).scalar_one_or_none()
	if operator_role is None:
		raise ValueError("OPERATOR role not found")

	read_permission = (
		await db.execute(
			select(Permission).where(Permission.resource == "decodio", Permission.action == "read")
		)
	).scalar_one_or_none()

	if read_permission is None:
		read_permission = Permission(resource="decodio", action="read", scope="GLOBAL")
		db.add(read_permission)
		await db.flush()

	write_permission = (
		await db.execute(
			select(Permission).where(Permission.resource == "decodio", Permission.action == "write")
		)
	).scalar_one_or_none()

	await db.execute(
		pg_insert(role_permissions)
		.values(role_id=operator_role.id, permission_id=read_permission.id)
		.on_conflict_do_nothing(index_elements=["role_id", "permission_id"])
	)

	removed_write = 0
	if write_permission is not None:
		result = await db.execute(
			delete(role_permissions).where(
				role_permissions.c.role_id == operator_role.id,
				role_permissions.c.permission_id == write_permission.id,
			)
		)
		removed_write = result.rowcount or 0

	audit_user_id = None
	if actor_user_id:
		try:
			audit_user_id = uuid.UUID(str(actor_user_id))
		except (ValueError, TypeError):
			audit_user_id = None

	db.add(
		AuditLog(
			user_id=audit_user_id,
			action="PERMISSION_WORKFLOW_APPLY",
			entity="ROLE",
			entity_id=None,
			details={
				"workflow": "decodio-read-operator",
				"target_role": "OPERATOR",
				"granted": "decodio:read",
				"removed": ["decodio:write"] if removed_write > 0 else [],
				"removed_write_assignments": removed_write,
			},
		)
	)

	await db.commit()

	return {
		"status": "ok",
		"role": "OPERATOR",
		"granted": "decodio:read",
		"removed_write_assignments": removed_write,
	}
