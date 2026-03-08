import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";
import MetricCard from "../../components/ui/MetricCard";
import {
  connectTcpClient,
  disconnectTcpClient,
  getTcpClientStatus,
  getTcpListenerHealth,
  type TcpClientStatus,
  type TcpListenerHealth,
} from "../../api/tcpListener";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

const REFRESH_MS = 5000;

const normalizeIpv4Input = (value: string) => {
  const sanitized = value.replace(/[^\d.]/g, "");
  const parts = sanitized.split(".").slice(0, 4);
  return parts.map((part) => part.slice(0, 3)).join(".");
};

const isValidIpv4 = (value: string) => {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const number = Number(part);
    return number >= 0 && number <= 255;
  });
};

const parseApiErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim().length > 0) {
      return detail;
    }
  }
  return fallback;
};

export default function OperatorTcpClientPage() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [health, setHealth] = useState<TcpListenerHealth | null>(null);
  const [clientStatus, setClientStatus] = useState<TcpClientStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverHost, setServerHost] = useState("");
  const [serverPort, setServerPort] = useState("");
  const [protocol, setProtocol] = useState<"line" | "proto">("proto");
  const [lengthEndian, setLengthEndian] = useState<"big" | "little">("little");
  const [serverDirty, setServerDirty] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  const hasPermission = (requiredPermission: string) => {
    const permissions = user?.permissions ?? [];
    const [requiredResource, requiredAction] = requiredPermission.split(":");

    return (
      permissions.includes(requiredPermission) ||
      permissions.includes(`${requiredResource}:*`) ||
      permissions.includes(`*:${requiredAction}`) ||
      permissions.includes("*:*")
    );
  };

  const canReadEndpoint = hasPermission("tcp_listener:read");
  const canEditEndpoint = hasPermission("tcp_listener:write");
  const isConnected = clientStatus?.connected ?? false;

  const load = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [healthResponse, clientResponse] = await Promise.all([
        getTcpListenerHealth(),
        getTcpClientStatus(),
      ]);
      setHealth(healthResponse.data);
      setClientStatus(clientResponse.data);

      if (!serverDirty) {
        const resolvedHost = clientResponse.data.target_host ?? healthResponse.data.host;
        const resolvedPort = clientResponse.data.target_port ?? healthResponse.data.port;
        setServerHost(resolvedHost ?? "");
        setServerPort(resolvedPort ? String(resolvedPort) : "");
        setProtocol(clientResponse.data.protocol ?? "proto");
        setLengthEndian(clientResponse.data.length_endian ?? "little");
      }
    } catch (loadError) {
      setError(parseApiErrorMessage(loadError, "Failed to load TCP client status."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serverDirty]);

  useEffect(() => {
    if (!canReadEndpoint) {
      setLoading(false);
      setError("You do not have permission to view TCP listener status.");
      return;
    }

    load();
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [canReadEndpoint, load]);

  const statusLabel = loading
    ? "Loading..."
    : health?.running
      ? "Running"
      : "Stopped";

  const connectToServer = async () => {
    if (!canEditEndpoint) {
      setConnectionStatus("You do not have permission to connect/disconnect TCP client.");
      return;
    }

    const host = serverHost.trim();
    const parsedPort = Number(serverPort);

    if (!host) {
      setConnectionStatus("Server IP is required.");
      return;
    }

    if (!isValidIpv4(host)) {
      setConnectionStatus("Please enter a valid server IPv4 address.");
      return;
    }

    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      setConnectionStatus("Port must be between 1 and 65535.");
      return;
    }

    try {
      setConnecting(true);
      setConnectionStatus(null);
      const response = await connectTcpClient({
        host,
        port: parsedPort,
        protocol,
        length_endian: lengthEndian,
      });
      setClientStatus(response.data);
      setServerDirty(false);
      setConnectionStatus("Connected successfully.");
    } catch (error) {
      setConnectionStatus(parseApiErrorMessage(error, "Failed to connect TCP client."));
    } finally {
      setConnecting(false);
    }
  };

  const disconnectFromServer = async () => {
    if (!canEditEndpoint) {
      setConnectionStatus("You do not have permission to connect/disconnect TCP client.");
      return;
    }

    try {
      setDisconnecting(true);
      setConnectionStatus(null);
      const response = await disconnectTcpClient();
      setClientStatus(response.data);
      setConnectionStatus("Disconnected.");
    } catch (error) {
      setConnectionStatus(parseApiErrorMessage(error, "Failed to disconnect TCP client."));
    } finally {
      setDisconnecting(false);
    }
  };

  const recentMessages = (clientStatus?.recent_messages ?? []).slice().reverse();

  return (
    <AppLayout>
      <PageContainer title="TCP Client">
        <div style={{ display: "grid", gap: theme.spacing.lg }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ margin: 0 }}>TCP Client</h2>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing || !canReadEndpoint}
              style={{
                border: "none",
                borderRadius: theme.radius.md,
                background: theme.colors.primary,
                color: theme.colors.surface,
                cursor: refreshing || !canReadEndpoint ? "not-allowed" : "pointer",
                opacity: refreshing || !canReadEndpoint ? 0.75 : 1,
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              }}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <Card>
            <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>Access</h3>
            <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap" }}>
              <span
                style={{
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  borderRadius: theme.radius.md,
                  border: `1px solid ${canReadEndpoint ? theme.colors.success : theme.colors.danger}`,
                  color: canReadEndpoint ? theme.colors.success : theme.colors.danger,
                  background: theme.colors.surfaceAlt,
                }}
              >
                Read: {canReadEndpoint ? "Allowed" : "Denied"}
              </span>
              <span
                style={{
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  borderRadius: theme.radius.md,
                  border: `1px solid ${canEditEndpoint ? theme.colors.success : theme.colors.danger}`,
                  color: canEditEndpoint ? theme.colors.success : theme.colors.danger,
                  background: theme.colors.surfaceAlt,
                }}
              >
                Write: {canEditEndpoint ? "Allowed" : "Denied"}
              </span>
            </div>
          </Card>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: theme.spacing.md,
            }}
          >
            <MetricCard label="Listener" value={statusLabel} />
            <MetricCard label="Active Connections" value={loading ? "..." : health?.active_connections ?? 0} />
            <MetricCard label="Total Connections" value={loading ? "..." : health?.total_connections ?? 0} />
            <MetricCard label="Messages Received" value={loading ? "..." : health?.messages_received ?? 0} />
            <MetricCard label="Messages Rejected" value={loading ? "..." : health?.messages_rejected ?? 0} />
          </div>

          {error && <div style={{ color: theme.colors.danger }}>{error}</div>}

          <Card>
            <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>TCP Client Connection</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: theme.spacing.sm,
                alignItems: "end",
              }}
            >
              <label style={{ display: "grid", gap: theme.spacing.xs }}>
                <span>Server IP</span>
                <input
                  value={serverHost}
                  disabled={!canEditEndpoint}
                  onChange={(event) => {
                    setServerHost(normalizeIpv4Input(event.target.value));
                    setServerDirty(true);
                  }}
                  placeholder="192.168.1.10"
                  style={{
                    width: "100%",
                    padding: theme.spacing.sm,
                    borderRadius: theme.radius.sm,
                    border: `1px solid ${theme.colors.border}`,
                    background: theme.colors.surfaceAlt,
                    color: theme.colors.textPrimary,
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: theme.spacing.xs }}>
                <span>Server Port</span>
                <input
                  value={serverPort}
                  disabled={!canEditEndpoint}
                  onChange={(event) => {
                    setServerPort(event.target.value.replace(/\D/g, "").slice(0, 5));
                    setServerDirty(true);
                  }}
                  placeholder="9300"
                  inputMode="numeric"
                  style={{
                    width: "100%",
                    padding: theme.spacing.sm,
                    borderRadius: theme.radius.sm,
                    border: `1px solid ${theme.colors.border}`,
                    background: theme.colors.surfaceAlt,
                    color: theme.colors.textPrimary,
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: theme.spacing.xs }}>
                <span>Protocol</span>
                <select
                  value={protocol}
                  disabled={!canEditEndpoint}
                  onChange={(event) => {
                    setProtocol(event.target.value as "line" | "proto");
                    setServerDirty(true);
                  }}
                  style={{
                    width: "100%",
                    padding: theme.spacing.sm,
                    borderRadius: theme.radius.sm,
                    border: `1px solid ${theme.colors.border}`,
                    background: theme.colors.surfaceAlt,
                    color: theme.colors.textPrimary,
                    height: 38,
                  }}
                >
                  <option value="proto">proto (length-prefixed protobuf)</option>
                  <option value="line">line (newline text/json)</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: theme.spacing.xs }}>
                <span>Length Endian</span>
                <select
                  value={lengthEndian}
                  disabled={!canEditEndpoint || protocol !== "proto"}
                  onChange={(event) => {
                    setLengthEndian(event.target.value as "big" | "little");
                    setServerDirty(true);
                  }}
                  style={{
                    width: "100%",
                    padding: theme.spacing.sm,
                    borderRadius: theme.radius.sm,
                    border: `1px solid ${theme.colors.border}`,
                    background: theme.colors.surfaceAlt,
                    color: theme.colors.textPrimary,
                    height: 38,
                    opacity: protocol === "proto" ? 1 : 0.6,
                  }}
                >
                  <option value="big">big-endian</option>
                  <option value="little">little-endian</option>
                </select>
              </label>

              <button
                type="button"
                onClick={connectToServer}
                disabled={!canEditEndpoint || connecting || isConnected}
                style={{
                  border: "none",
                  borderRadius: theme.radius.md,
                  background: theme.colors.primary,
                  color: theme.colors.surface,
                  cursor: !canEditEndpoint || connecting || isConnected ? "not-allowed" : "pointer",
                  opacity: !canEditEndpoint || connecting || isConnected ? 0.75 : 1,
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  height: 38,
                }}
              >
                {connecting ? "Connecting..." : "Connect"}
              </button>

              <button
                type="button"
                onClick={disconnectFromServer}
                disabled={!canEditEndpoint || disconnecting || !isConnected}
                style={{
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.md,
                  background: theme.colors.surfaceAlt,
                  color: theme.colors.textPrimary,
                  cursor: !canEditEndpoint || disconnecting || !isConnected ? "not-allowed" : "pointer",
                  opacity: !canEditEndpoint || disconnecting || !isConnected ? 0.75 : 1,
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  height: 38,
                }}
              >
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>

            <div style={{ marginTop: theme.spacing.sm, color: theme.colors.textSecondary }}>
              Connection: {isConnected ? "Connected" : "Disconnected"}
              {clientStatus?.target_host && clientStatus?.target_port
                ? ` (${clientStatus.target_host}:${clientStatus.target_port})`
                : ""}
              {clientStatus?.protocol ? ` | protocol=${clientStatus.protocol}` : ""}
              {clientStatus?.protocol === "proto" && clientStatus.length_endian
                ? ` (${clientStatus.length_endian})`
                : ""}
            </div>

            {connectionStatus && (
              <div
                style={{
                  marginTop: theme.spacing.sm,
                  color:
                    connectionStatus.toLowerCase().includes("failed") ||
                    connectionStatus.toLowerCase().includes("invalid") ||
                    connectionStatus.toLowerCase().includes("unable") ||
                    connectionStatus.toLowerCase().includes("required")
                      ? theme.colors.danger
                      : theme.colors.textSecondary,
                }}
              >
                {connectionStatus}
              </div>
            )}

            {!canEditEndpoint && (
              <div style={{ marginTop: theme.spacing.sm, color: theme.colors.textSecondary }}>
                Read-only: contact admin for `tcp_listener:write` permission.
              </div>
            )}
          </Card>

          <Card>
            <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>Client Receive Metrics</h3>
            <div style={{ display: "grid", gap: theme.spacing.xs }}>
              <div>Messages Received: {clientStatus?.messages_received ?? 0}</div>
              <div>Messages Rejected: {clientStatus?.messages_rejected ?? 0}</div>
              <div>Last Message At: {clientStatus?.last_message_at ?? "-"}</div>
              <div>Last Client Error: {clientStatus?.last_error ?? "-"}</div>
            </div>
          </Card>

          <Card>
            <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>Received Data (Latest First)</h3>
            <div style={{ display: "grid", gap: theme.spacing.sm }}>
              {recentMessages.length === 0 && (
                <div style={{ color: theme.colors.textSecondary }}>
                  No messages received yet. Connect to a server and wait for incoming data.
                </div>
              )}

              {recentMessages.slice(0, 20).map((message, index) => (
                <div
                  key={`${message.received_at ?? "na"}-${index}`}
                  style={{
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radius.md,
                    padding: theme.spacing.sm,
                    background: theme.colors.surfaceAlt,
                    display: "grid",
                    gap: theme.spacing.xs,
                  }}
                >
                  <div style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                    {message.received_at ?? "Unknown time"}
                    {typeof message.byte_length === "number" ? ` | ${message.byte_length} bytes` : ""}
                    {message.protocol ? ` | ${message.protocol}` : ""}
                  </div>

                  {message.ascii_preview && (
                    <div style={{ color: theme.colors.textPrimary }}>{message.ascii_preview}</div>
                  )}

                  {message.parsed_fields && Object.keys(message.parsed_fields).length > 0 && (
                    <div
                      style={{
                        display: "grid",
                        gap: theme.spacing.xs,
                        color: theme.colors.textSecondary,
                      }}
                    >
                      {Object.entries(message.parsed_fields).map(([key, value]) => (
                        <div key={key}>
                          <strong>{key}</strong>: {value}
                        </div>
                      ))}
                    </div>
                  )}

                  <code
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      color: theme.colors.textPrimary,
                    }}
                  >
                    {message.hex_preview ? `hex: ${message.hex_preview}` : message.raw ?? ""}
                  </code>

                  {message.decode_error && (
                    <div style={{ color: theme.colors.danger }}>{message.decode_error}</div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
