import api from "./axios";

export type Role = {
	id: number;
	name: string;
	level: number;
};

export const getRoles = () => api.get<Role[]>("/roles");

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
