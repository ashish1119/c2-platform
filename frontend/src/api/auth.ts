import api from "./axios";

export type ChangePasswordRequest = {
  current_password: string;
  new_password: string;
};

export type ResetPasswordRequest = {
  username: string;
  email: string;
  new_password: string;
};

export const changePassword = (payload: ChangePasswordRequest) =>
  api.post<{ message: string }>("/auth/change-password", payload);

export const resetPassword = (payload: ResetPasswordRequest) =>
  api.post<{ message: string }>("/auth/reset-password", payload);
