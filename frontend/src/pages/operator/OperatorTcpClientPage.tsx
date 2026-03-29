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
  const [clientStatus, setClientStatus] = useState<TcpClientStatus | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverHost, setServerHost] = useState("");
  const [serverPort, setServerPort] = useState("");
  const [protocol, setProtocol] = useState<"line" | "proto">("line");
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

  const load = useCallback(
    async (isManualRefresh = false) => {
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
          const resolvedHost =
            clientResponse.data.target_host ?? healthResponse.data.host;
          const resolvedPort =
            clientResponse.data.target_port ?? healthResponse.data.port;
          setServerHost(resolvedHost ?? "");
          setServerPort(resolvedPort ? String(resolvedPort) : "");
          setProtocol(clientResponse.data.protocol ?? "line");
          setLengthEndian(clientResponse.data.length_endian ?? "little");
        }
      } catch (loadError) {
        setError(
          parseApiErrorMessage(loadError, "Failed to load TCP client status."),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [serverDirty],
  );

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
      setConnectionStatus(
        "You do not have permission to connect/disconnect TCP client.",
      );
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
      setConnectionStatus(
        parseApiErrorMessage(error, "Failed to connect TCP client."),
      );
    } finally {
      setConnecting(false);
    }
  };

  const disconnectFromServer = async () => {
    if (!canEditEndpoint) {
      setConnectionStatus(
        "You do not have permission to connect/disconnect TCP client.",
      );
      return;
    }

    try {
      setDisconnecting(true);
      setConnectionStatus(null);
      const response = await disconnectTcpClient();
      setClientStatus(response.data);
      setConnectionStatus("Disconnected.");
    } catch (error) {
      setConnectionStatus(
        parseApiErrorMessage(error, "Failed to disconnect TCP client."),
      );
    } finally {
      setDisconnecting(false);
    }
  };

  const recentMessages = (clientStatus?.recent_messages ?? [])
    .slice()
    .reverse();

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
                cursor:
                  refreshing || !canReadEndpoint ? "not-allowed" : "pointer",
                opacity: refreshing || !canReadEndpoint ? 0.75 : 1,
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              }}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

        <Card>
  <h3 style={{ marginTop: 0, marginBottom: 16 }}>
    Access
  </h3>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16,
    }}
  >
    {/* READ */}
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        backdropFilter: "blur(10px)",
        background:
          theme.mode === "dark"
            ? "rgba(255,255,255,0.05)"
            : "rgba(255,255,255,0.6)",
        border: "1px solid rgba(255,255,255,0.2)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span style={{ fontSize: 12, color: "#64748B" }}>Read Access</span>

      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: canReadEndpoint ? "#22c55e" : "#ef4444",
        }}
      >
        {canReadEndpoint ? "Allowed" : "Denied"}
      </span>
    </div>

    {/* WRITE */}
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        backdropFilter: "blur(10px)",
        background:
          theme.mode === "dark"
            ? "rgba(255,255,255,0.05)"
            : "rgba(255,255,255,0.6)",
        border: "1px solid rgba(255,255,255,0.2)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span style={{ fontSize: 12, color: "#64748B" }}>
        Write Access
      </span>

      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: canEditEndpoint ? "#22c55e" : "#ef4444",
        }}
      >
        {canEditEndpoint ? "Allowed" : "Denied"}
      </span>
    </div>
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
            <MetricCard
              label="Active Connections"
              value={loading ? "..." : (health?.active_connections ?? 0)}
            />
            <MetricCard
              label="Total Connections"
              value={loading ? "..." : (health?.total_connections ?? 0)}
            />
            <MetricCard
              label="Messages Received"
              value={loading ? "..." : (health?.messages_received ?? 0)}
            />
            <MetricCard
              label="Messages Rejected"
              value={loading ? "..." : (health?.messages_rejected ?? 0)}
            />
          </div>

          {error && <div style={{ color: theme.colors.danger }}>{error}</div>}

          <Card>
            <h3 style={{ marginTop: 0, marginBottom: theme.spacing.md }}>
              TCP Client Connection
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 16,
                alignItems: "end",
              }}
            >
              {/* Server IP */}
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, color: "#64748B" }}>
                  Server IP
                </span>
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
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    color: "#0f172a",
                    fontSize: 14,
                  }}
                />
              </label>

              {/* Port */}
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, color: "#64748B" }}>
                  Server Port
                </span>
                <input
                  value={serverPort}
                  disabled={!canEditEndpoint}
                  onChange={(event) => {
                    setServerPort(
                      event.target.value.replace(/\D/g, "").slice(0, 5),
                    );
                    setServerDirty(true);
                  }}
                  placeholder="9300"
                  inputMode="numeric"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    color: "#0f172a",
                    fontSize: 14,
                  }}
                />
              </label>

              {/* Protocol */}
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, color: "#64748B" }}>Protocol</span>
                <select
                  value={protocol}
                  disabled={!canEditEndpoint}
                  onChange={(event) => {
                    setProtocol(event.target.value as "line" | "proto");
                    setServerDirty(true);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    color: "#0f172a",
                    fontSize: 14,
                  }}
                >
                  <option value="proto" disabled>
                    proto (protobuf) - coming soon
                  </option>
                  <option value="line">line (text/json)</option>
                </select>
              </label>

              {/* Endian */}
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 13, color: "#64748B" }}>
                  Length Endian
                </span>
                <select
                  value={lengthEndian}
                  disabled={!canEditEndpoint || protocol !== "proto"}
                  onChange={(event) => {
                    setLengthEndian(event.target.value as "big" | "little");
                    setServerDirty(true);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    color: "#0f172a",
                    fontSize: 14,
                    opacity: protocol === "proto" ? 1 : 0.6,
                  }}
                >
                  <option value="big">big-endian</option>
                  <option value="little">little-endian</option>
                </select>
              </label>

              {/* 🔥 TOGGLE BUTTON */}
              <button
                type="button"
                onClick={isConnected ? disconnectFromServer : connectToServer}
                disabled={!canEditEndpoint || connecting || disconnecting}
                style={{
                  gridColumn: "span 2",
                  height: 44,
                  borderRadius: 6,
                  border: "none",
                  background: isConnected ? "#ef4444" : "#11c1ca",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {connecting || disconnecting
                  ? "Processing..."
                  : isConnected
                    ? "Disconnect"
                    : "Connect"}
              </button>
            </div>

            {/* Connection Info */}
            <div style={{ marginTop: 12, color: "#64748B", fontSize: 13 }}>
              Connection: {isConnected ? "Connected" : "Disconnected"}
              {clientStatus?.target_host && clientStatus?.target_port
                ? ` (${clientStatus.target_host}:${clientStatus.target_port})`
                : ""}
            </div>

            {/* Status Message */}
            {connectionStatus && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color:
                    connectionStatus.toLowerCase().includes("failed") ||
                    connectionStatus.toLowerCase().includes("invalid")
                      ? "#ef4444"
                      : "#64748B",
                }}
              >
                {connectionStatus}
              </div>
            )}
          </Card>

         <div
  style={{
    display: "grid",
    gridTemplateColumns: "1fr 2fr", // left smaller, right bigger
    gap: 20,
    alignItems: "start",
  }}
>
  {/* LEFT CARD */}
  <Card>
    <h3 style={{ marginTop: 0, marginBottom: 16 }}>
      Client Receive Metrics
    </h3>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
      }}
    >
      {/* Item */}
      <div>
        <div style={{ fontSize: 12, color: "#64748B" }}>
          Messages Received
        </div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>
          {clientStatus?.messages_received ?? 0}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: "#64748B" }}>
          Messages Rejected
        </div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>
          {clientStatus?.messages_rejected ?? 0}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: "#64748B" }}>
          Last Message At
        </div>
        <div style={{ fontSize: 14 }}>
          {clientStatus?.last_message_at ?? "-"}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: "#64748B" }}>
          Last Client Error
        </div>
        <div style={{ fontSize: 14, color: "#ef4444" }}>
          {clientStatus?.last_error ?? "-"}
        </div>
      </div>
    </div>
  </Card>

  {/* RIGHT CARD */}
  <Card>
    <h3 style={{ marginTop: 0, marginBottom: 16 }}>
      Received Data (Latest First)
    </h3>

    <div style={{ display: "grid", gap: 12 }}>
      {recentMessages.length === 0 && (
        <div style={{ color: "#64748B", fontSize: 14 }}>
          No messages received yet.
        </div>
      )}

      {recentMessages.slice(0, 20).map((message, index) => (
        <div
          key={`${message.received_at ?? "na"}-${index}`}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            padding: 14,
            background: "#ffffff",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* HEADER */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: "#64748B",
            }}
          >
            <span>{message.received_at ?? "Unknown time"}</span>

            <span style={{ display: "flex", gap: 10 }}>
              {typeof message.byte_length === "number" && (
                <span>{message.byte_length} bytes</span>
              )}
              {message.protocol && <span>{message.protocol}</span>}
            </span>
          </div>

          {/* ASCII */}
          {message.ascii_preview && (
            <div style={{ fontSize: 14, color: "#0f172a" }}>
              {message.ascii_preview}
            </div>
          )}

          {/* PARSED */}
          {message.parsed_fields &&
            Object.keys(message.parsed_fields).length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 8,
                  fontSize: 13,
                  background: "#f8fafc",
                  padding: 10,
                  borderRadius: 6,
                }}
              >
                {Object.entries(message.parsed_fields).map(
                  ([key, value]) => (
                    <div key={key}>
                      <strong>{key}:</strong> {value}
                    </div>
                  ),
                )}
              </div>
            )}

          {/* RAW */}
          <code
            style={{
              fontSize: 12,
              background: "#f1f5f9",
              padding: 10,
              borderRadius: 6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {message.hex_preview
              ? `hex: ${message.hex_preview}`
              : message.raw ?? ""}
          </code>

          {/* ERROR */}
          {message.decode_error && (
            <div style={{ color: "#ef4444", fontSize: 12 }}>
              {message.decode_error}
            </div>
          )}
        </div>
      ))}
    </div>
  </Card>
</div>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
