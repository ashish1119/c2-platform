import { useEffect, useState } from "react";
import { AxiosError } from "axios";
import AppLayout from "../components/layout/AppLayout";
import PageContainer from "../components/layout/PageContainer";
import Card from "../components/ui/Card";
import { useTheme } from "../context/ThemeContext";
import api from "../api/axios";

const DEFAULT_JAMMER_API_HOST = "localhost";
const DEFAULT_JAMMER_API_PORT = "3333";
const JAMMER_API_STORAGE_KEY = "jammer_api_target";
const JAMMER_API_HOST_STORAGE_KEY = "jammer_api_host";
const JAMMER_API_PORT_STORAGE_KEY = "jammer_api_port";

const MODULE_ID_OPTIONS = ["1", "2", "3", "4"];

const JAMMING_CODE_OPTIONS: Array<{ code: number; name: string }> = [
  { code: 0, name: "CW" },
  { code: 1, name: "TBS_868" },
  { code: 2, name: "TBS_915" },
  { code: 3, name: "TBS_868+915" },
  { code: 4, name: "ELRS_868" },
  { code: 5, name: "ELRS_915" },
  { code: 6, name: "ELRS_2450_A" },
  { code: 7, name: "ELRS_868+915" },
  { code: 8, name: "TBS+ELRS_A" },
  { code: 9, name: "GNSS_70M" },
  { code: 10, name: "OFDM_5M" },
  { code: 11, name: "OFDM_10M" },
  { code: 12, name: "OFDM_20M" },
  { code: 13, name: "OFDM_70M" },
  { code: 14, name: "OFDM_100M" },
  { code: 15, name: "OFDM_150M" },
  { code: 16, name: "OFDM_140M" },
  { code: 17, name: "OFDM_200M" },
  { code: 18, name: "LFM_5M" },
  { code: 19, name: "LFM_10M" },
];

const GAIN_OPTIONS = Array.from({ length: 35 }, (_, index) => String(index + 1));

type PortPathEntry = {
  path?: string;
};

type PortsResponse = {
  ports?: Array<string | PortPathEntry>;
};

type JammerApiConfig = {
  host: string;
  port: string;
};

function parseLegacyApiTarget(target: string): JammerApiConfig {
  const trimmedTarget = target.trim();
  if (!trimmedTarget) {
    return {
      host: DEFAULT_JAMMER_API_HOST,
      port: DEFAULT_JAMMER_API_PORT,
    };
  }

  const withProtocol =
    trimmedTarget.startsWith("http://") || trimmedTarget.startsWith("https://")
      ? trimmedTarget
      : `http://${trimmedTarget}`;

  try {
    const parsed = new URL(withProtocol);
    return {
      host: parsed.hostname || DEFAULT_JAMMER_API_HOST,
      port: parsed.port || DEFAULT_JAMMER_API_PORT,
    };
  } catch {
    const [hostPart, portPart] = trimmedTarget.split(":");
    return {
      host: (hostPart || DEFAULT_JAMMER_API_HOST).trim(),
      port: (portPart || DEFAULT_JAMMER_API_PORT).trim(),
    };
  }
}

function getInitialJammerApiConfig(): JammerApiConfig {
  const savedHost = window.localStorage.getItem(JAMMER_API_HOST_STORAGE_KEY)?.trim();
  const savedPort = window.localStorage.getItem(JAMMER_API_PORT_STORAGE_KEY)?.trim();

  if (savedHost && savedPort) {
    return {
      host: savedHost,
      port: savedPort,
    };
  }

  const legacyTarget = window.localStorage.getItem(JAMMER_API_STORAGE_KEY) ?? "";
  return parseLegacyApiTarget(legacyTarget);
}

function normalizePortList(payload: unknown): string[] {
  const normalizeItem = (item: unknown): string | null => {
    if (typeof item === "string") {
      const value = item.trim();
      return value || null;
    }

    if (item && typeof item === "object" && "path" in item) {
      const value = (item as { path?: unknown }).path;
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    return null;
  };

  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as PortsResponse).ports)
      ? (payload as PortsResponse).ports ?? []
      : [];

  return list
    .map(normalizeItem)
    .filter((value): value is string => Boolean(value));
}

function buildJammerApiTarget(host: string, port: string): string {
  const normalizedHost = host
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  if (!normalizedHost) {
    throw new Error("Jammer API IP is required.");
  }

  const normalizedPortText = port.trim();
  if (!normalizedPortText) {
    throw new Error("Jammer API web port is required.");
  }

  const normalizedPort = Number(normalizedPortText);
  if (!Number.isInteger(normalizedPort) || normalizedPort < 1 || normalizedPort > 65535) {
    throw new Error("Jammer API web port must be between 1 and 65535.");
  }

  return `${normalizedHost}:${normalizedPort}`;
}

async function requestJammer<T>(
  endpoint: string,
  method: "GET" | "POST",
  apiTarget: string,
  body?: Record<string, unknown>
): Promise<T> {
  try {
    if (method === "GET") {
      const response = await api.get<T>(endpoint, {
        params: {
          api_target: apiTarget,
        },
      });
      return response.data;
    }

    const response = await api.post<T>(endpoint, body ?? {}, {
      params: {
        api_target: apiTarget,
      },
    });
    return response.data;
  } catch (error: unknown) {
    if (error instanceof AxiosError) {
      const payload = error.response?.data as
        | { message?: string; detail?: string }
        | string
        | undefined;
      const message =
        typeof payload === "string"
          ? payload
          : payload?.detail ?? payload?.message ?? error.message;
      throw new Error(message || "Jammer API request failed.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Jammer API request failed.");
  }
}

function buildJammerApiBase(host: string, port: string): string {
  const target = buildJammerApiTarget(host, port);
  return `http://${target}`;
}

export default function JammerControlPage() {
  const { theme } = useTheme();

  const [jammerApiConfig, setJammerApiConfig] = useState<JammerApiConfig>(getInitialJammerApiConfig);

  const [availablePorts, setAvailablePorts] = useState<string[]>([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [baudRate, setBaudRate] = useState("115200");

  const [moduleId, setModuleId] = useState("1");
  const [jammingCode, setJammingCode] = useState("0");
  const [frequency, setFrequency] = useState("");
  const [ch1Gain, setCh1Gain] = useState("35");
  const [ch2Gain, setCh2Gain] = useState("35");

  const [loadingPorts, setLoadingPorts] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<unknown>(null);

  let activeApiLabel = "Not set";
  try {
    activeApiLabel = buildJammerApiBase(jammerApiConfig.host, jammerApiConfig.port);
  } catch {
    activeApiLabel = "Invalid target";
  }

  useEffect(() => {
    const host = jammerApiConfig.host.trim();
    const port = jammerApiConfig.port.trim();
    window.localStorage.setItem(JAMMER_API_HOST_STORAGE_KEY, host);
    window.localStorage.setItem(JAMMER_API_PORT_STORAGE_KEY, port);
    if (host && port) {
      window.localStorage.setItem(JAMMER_API_STORAGE_KEY, `${host}:${port}`);
    }
  }, [jammerApiConfig.host, jammerApiConfig.port]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleGetPorts = async () => {
    try {
      clearMessages();
      setLoadingPorts(true);
      const apiTarget = buildJammerApiTarget(jammerApiConfig.host, jammerApiConfig.port);
      const response = await requestJammer<PortsResponse | PortPathEntry[] | string[]>(
        "/jammer-control/ports",
        "GET",
        apiTarget
      );
      const ports = normalizePortList(response);
      setAvailablePorts(ports);
      if (!selectedPort && ports.length > 0) {
        setSelectedPort(ports[0]);
      }
      setLastResponse(response);
      setSuccess(ports.length > 0 ? "Ports loaded successfully." : "No ports found.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch ports.");
    } finally {
      setLoadingPorts(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedPort.trim()) {
      setError("Port is required.");
      return;
    }

    try {
      clearMessages();
      setConnecting(true);
      const apiTarget = buildJammerApiTarget(jammerApiConfig.host, jammerApiConfig.port);
      const response = await requestJammer<unknown>("/jammer-control/connect", "POST", apiTarget, {
        port: selectedPort.trim(),
        baudRate: baudRate.trim() ? Number(baudRate) : 115200,
      });
      setLastResponse(response);
      setSuccess("Connected successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to connect.");
    } finally {
      setConnecting(false);
    }
  };

  const handleConfigure = async () => {
    const moduleValue = Number(moduleId);
    if (!Number.isInteger(moduleValue) || moduleValue < 1 || moduleValue > 4) {
      setError("moduleId must be between 1 and 4.");
      return;
    }

    const payload: Record<string, unknown> = {
      moduleId: moduleValue,
      jammingCode: Number(jammingCode),
    };

    if (frequency.trim()) payload.frequency = Number(frequency);
    if (ch1Gain.trim()) payload.ch1Gain = Number(ch1Gain);
    if (ch2Gain.trim()) payload.ch2Gain = Number(ch2Gain);

    try {
      clearMessages();
      setConfiguring(true);
      const apiTarget = buildJammerApiTarget(jammerApiConfig.host, jammerApiConfig.port);
      const response = await requestJammer<unknown>("/jammer-control/configure", "POST", apiTarget, payload);
      setLastResponse(response);
      setSuccess("Configuration sent successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to configure jammer.");
    } finally {
      setConfiguring(false);
    }
  };

  const handleStart = async () => {
    const moduleValue = Number(moduleId);
    if (!Number.isInteger(moduleValue) || moduleValue < 1 || moduleValue > 4) {
      setError("moduleId must be between 1 and 4.");
      return;
    }

    try {
      clearMessages();
      setStarting(true);
      const apiTarget = buildJammerApiTarget(jammerApiConfig.host, jammerApiConfig.port);
      const response = await requestJammer<unknown>("/jammer-control/jamming/start", "POST", apiTarget, {
        moduleId: moduleValue,
      });
      setLastResponse(response);
      setSuccess(`Jamming started for module ${moduleValue}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start jamming.");
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    try {
      clearMessages();
      setStopping(true);
      const apiTarget = buildJammerApiTarget(jammerApiConfig.host, jammerApiConfig.port);
      const response = await requestJammer<unknown>("/jammer-control/jamming/stop", "POST", apiTarget);
      setLastResponse(response);
      setSuccess("Jamming stop command sent.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to stop jamming.");
    } finally {
      setStopping(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    background: theme.colors.surfaceAlt,
    color: theme.colors.textPrimary,
  };

  const buttonStyle: React.CSSProperties = {
    border: "none",
    borderRadius: theme.radius.md,
    background: theme.colors.primary,
    color: "#fff",
    cursor: "pointer",
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
  };

  return (
    <AppLayout>
      <PageContainer title="Jammer Control">
        <div style={{ display: "grid", gap: theme.spacing.md }}>
          <Card>
            <h3 style={{ marginTop: 0, marginBottom: theme.spacing.md }}>Connection</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: theme.spacing.sm,
                alignItems: "end",
              }}
            >
              <label>
                Jammer API IP
                <input
                  type="text"
                  value={jammerApiConfig.host}
                  onChange={(event) =>
                    setJammerApiConfig((prev) => ({
                      ...prev,
                      host: event.target.value,
                    }))
                  }
                  placeholder="192.168.0.10"
                  style={inputStyle}
                />
              </label>

              <label>
                Jammer API Web Port
                <input
                  type="number"
                  value={jammerApiConfig.port}
                  onChange={(event) =>
                    setJammerApiConfig((prev) => ({
                      ...prev,
                      port: event.target.value,
                    }))
                  }
                  placeholder="3333"
                  style={inputStyle}
                />
              </label>

              <label>
                Port
                <select
                  value={selectedPort}
                  onChange={(event) => setSelectedPort(event.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select port</option>
                  {availablePorts.map((port) => (
                    <option key={port} value={port}>
                      {port}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Baud Rate
                <input
                  type="number"
                  value={baudRate}
                  onChange={(event) => setBaudRate(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <div style={{ display: "flex", gap: theme.spacing.sm }}>
                <button onClick={handleGetPorts} disabled={loadingPorts} style={buttonStyle}>
                  {loadingPorts ? "Loading..." : "Get Ports"}
                </button>
                <button onClick={handleConnect} disabled={connecting} style={buttonStyle}>
                  {connecting ? "Connecting..." : "Connect"}
                </button>
              </div>
            </div>
            <div style={{ marginTop: theme.spacing.sm, color: theme.colors.textSecondary }}>
              Active API: {activeApiLabel}
            </div>
          </Card>

          <Card>
            <h3 style={{ marginTop: 0, marginBottom: theme.spacing.md }}>Configure Module</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: theme.spacing.sm,
                alignItems: "end",
              }}
            >
              <label>
                Module ID (1-4)
                <select
                  value={moduleId}
                  onChange={(event) => setModuleId(event.target.value)}
                  style={inputStyle}
                >
                  {MODULE_ID_OPTIONS.map((moduleValue) => (
                    <option key={moduleValue} value={moduleValue}>
                      {moduleValue}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Jamming Code
                <select
                  value={jammingCode}
                  onChange={(event) => setJammingCode(event.target.value)}
                  style={inputStyle}
                >
                  {JAMMING_CODE_OPTIONS.map((option) => (
                    <option key={option.code} value={String(option.code)}>
                      {option.code} - {option.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Frequency (MHz)
                <input
                  type="number"
                  step="0.1"
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value)}
                  placeholder="optional"
                  style={inputStyle}
                />
              </label>

              <label>
                Ch1 Gain (1-35)
                <select
                  value={ch1Gain}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setCh1Gain(nextValue);
                    setCh2Gain(nextValue);
                  }}
                  style={inputStyle}
                >
                  {GAIN_OPTIONS.map((gain) => (
                    <option key={gain} value={gain}>
                      {gain}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Ch2 Gain (1-35)
                <select
                  value={ch2Gain}
                  disabled
                  style={inputStyle}
                >
                  {GAIN_OPTIONS.map((gain) => (
                    <option key={gain} value={gain}>
                      {gain}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ marginTop: theme.spacing.sm, display: "flex", gap: theme.spacing.sm }}>
              <button onClick={handleConfigure} disabled={configuring} style={buttonStyle}>
                {configuring ? "Configuring..." : "Configure"}
              </button>
              <button onClick={handleStart} disabled={starting} style={buttonStyle}>
                {starting ? "Starting..." : "Start Jammer"}
              </button>
              <button
                onClick={handleStop}
                disabled={stopping}
                style={{
                  ...buttonStyle,
                  background: theme.colors.danger,
                }}
              >
                {stopping ? "Stopping..." : "Stop Jammer"}
              </button>
            </div>
          </Card>

          {error && (
            <Card>
              <div style={{ color: theme.colors.danger }}>{error}</div>
            </Card>
          )}

          {success && (
            <Card>
              <div style={{ color: theme.colors.success }}>{success}</div>
            </Card>
          )}

          <Card>
            <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>Last API Response</h3>
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                color: theme.colors.textPrimary,
                background: theme.colors.surfaceAlt,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.sm,
                padding: theme.spacing.sm,
              }}
            >
              {lastResponse ? JSON.stringify(lastResponse, null, 2) : "No response yet."}
            </pre>
          </Card>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
