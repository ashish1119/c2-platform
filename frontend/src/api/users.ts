import api from "./axios";

export type UserRecord = {
	id: string;
	username: string;
	email: string;
	is_active: boolean;
	role_id?: number | null;
	created_at?: string | null;
};

export type CreateUserRequest = {
	username: string;
	email: string;
	password: string;
	role_id?: number;
};

export const getUsers = () => api.get<UserRecord[]>("/users");
export const createUser = (data: CreateUserRequest) => api.post<UserRecord>("/users", data);