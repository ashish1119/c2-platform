import axios from "axios";

const resolveApiBaseUrl = () => {
  const configuredBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  if (configuredBaseUrl && configuredBaseUrl.trim().length > 0) {
    return configuredBaseUrl;
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }

  return "http://localhost:8000";
};

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
});

let _redirectingToLogin = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error?.response?.status === 401 &&
      !_redirectingToLogin &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      _redirectingToLogin = true;
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;