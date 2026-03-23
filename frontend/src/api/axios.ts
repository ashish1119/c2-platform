import axios from "axios";

/** Resolves API base URL based on deployment environment */
const resolveApiBaseUrl = () => {
  // 1. Check environment variable (for explicit override)
  const configuredBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  if (configuredBaseUrl && configuredBaseUrl.trim().length > 0) {
    return configuredBaseUrl;
  }

  // 2. At runtime, detect localhost vs deployed environment
  if (typeof window !== "undefined") {
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (isLocalhost) {
      // Development: localhost frontend → localhost backend on port 8000
      return "http://localhost:8000";
    } else {
      // Deployed: network frontend → same host backend on port 8000
      return `http://${window.location.hostname}:8000`;
    }
  }

  // 3. SSR fallback
  return "http://localhost:8000";
};

const API_BASE_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 second timeout
});

// Request interceptor: attach auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle backend connectivity errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === "ERR_NETWORK" || !error.response) {
      // Network error: backend is not reachable
      const errorMsg = `Backend server not reachable (${API_BASE_URL})`;
      console.error(errorMsg);
      // Store error globally for UI display if needed
      sessionStorage.setItem("backendError", errorMsg);
    }
    return Promise.reject(error);
  }
);

export default api;