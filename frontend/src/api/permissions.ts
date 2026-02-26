import api from "./axios";

export type Permission = {
	id: number;
	resource: string;
	action: string;
	scope: string;
};

export const getPermissions = () => api.get<Permission[]>("/permissions");

export const createPermission = (payload: { resource: string; action: string; scope: string }) =>
	api.post<Permission>("/permissions", payload);
