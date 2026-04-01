import api from "./axios";

export type Role = {
	id: number;
	name: string;
	level: number;
};

export type CreateRoleRequest = {
	name: string;
	level: number;
};

export type UpdateRoleRequest = {
	name: string;
	level: number;
};

export const getRoles = () => api.get<Role[]>("/roles");
export const createRole = (data: CreateRoleRequest) => api.post<Role>("/roles", data);
export const updateRole = (roleId: number, data: UpdateRoleRequest) => api.put<Role>(`/roles/${roleId}`, data);
export const deleteRole = (roleId: number) => api.delete(`/roles/${roleId}`);

export const assignPermissionToRole = (roleId: number, permissionId: number) =>
	api.post(`/roles/${roleId}/permissions`, { permission_id: permissionId });

export const createRoleInheritance = (parent_role_id: number, child_role_id: number) =>
	api.post("/roles/inheritance", { parent_role_id, child_role_id });

export const getEffectivePermissions = (roleId: number) =>
	api.get<{ resource: string; action: string; scope: string }[]>(`/roles/${roleId}/effective-permissions`);

export const grantDecodioReadToOperator = () =>
	api.post<{ status: string; role: string; granted: string; removed_write_assignments: number }>(
		"/roles/workflows/decodio-read-operator"
	);

export const removePermissionFromRole = (
  roleId: number,
  permissionId: number
) =>
  api.delete(`/roles/${roleId}/permissions/${permissionId}`);
