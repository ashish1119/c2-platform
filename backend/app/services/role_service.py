from collections import deque
from sqlalchemy import select, insert
from sqlalchemy.ext.asyncio import AsyncSession
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
		insert(role_permissions).values(role_id=role_id, permission_id=permission_id)
	)
	await db.commit()


async def add_role_inheritance(parent_role_id: int, child_role_id: int, db: AsyncSession):
	await db.execute(
		insert(role_inheritance).values(parent_role_id=parent_role_id, child_role_id=child_role_id)
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
