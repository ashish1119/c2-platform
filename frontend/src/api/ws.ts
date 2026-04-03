export function resolveBackendWsUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const configuredBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  if (configuredBaseUrl) {
    try {
      const parsed = new URL(configuredBaseUrl);
      const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
      return `${wsProtocol}//${parsed.host}${normalizedPath}`;
    } catch {
      // Fall through to hostname-based fallback when env is malformed.
    }
  }

  if (typeof window === "undefined") {
    return `ws://localhost:8000${normalizedPath}`;
  }

  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${window.location.hostname}:8000${normalizedPath}`;
}
