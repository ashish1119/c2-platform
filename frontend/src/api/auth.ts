import api from "./axios";

export type ChangePasswordRequest = {
  current_password: string;
  new_password: string;
};

export const changePassword = (payload: ChangePasswordRequest) =>
  api.post<{ message: string }>("/auth/change-password", payload);
