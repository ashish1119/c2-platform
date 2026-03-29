import api from "./axios";

export type ChangePasswordRequest = {
  current_password: string;
  new_password: string;
};

export type AuthSession = {
  id: string;
  username: string;
  role: "ADMIN" | "OPERATOR";
  token?: string | null;
  permissions?: string[];
};

export type PasswordResetRequestStart = {
  identifier: string;
};

export type PasswordResetConfirmRequest = {
  token: string;
  new_password: string;
};

export const changePassword = (payload: ChangePasswordRequest) =>
  api.post<{ message: string }>("/auth/change-password", payload);

export const loginRequest = (username: string, password: string) =>
  api.post<AuthSession>("/auth/login", { username, password });

export const getCurrentSession = () =>
  api.get<AuthSession>("/auth/me");

export const logoutRequest = () =>
  api.post<{ message: string }>("/auth/logout");

export const requestPasswordReset = (payload: PasswordResetRequestStart) =>
  api.post<{ message: string }>("/auth/password-reset/request", payload);

export const confirmPasswordReset = (payload: PasswordResetConfirmRequest) =>
  api.post<{ message: string }>("/auth/password-reset/confirm", payload);
