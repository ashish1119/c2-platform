import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const RED_CAPABILITIES = [
  "Monitor and record VHF/UHF signals for immediate playback",
  "Create alerts for signals of interest through automatic detection",
  "Use inherent direction finding to localize signals and interference",
  "Adapt to existing government or commercial sensors",
  "Support one-operator control across distributed EW sensing",
  "Extend toward triangulation workflows with external localizer tooling",
];

const EW_MISSION_AREAS = [
  "Electronic support and spectrum hunting",
  "Interference reporting and spectrum policing",
  "EMOE training and emissions-footprint awareness",
  "Multinational exercise support with shared signatures",
];

type ProtocolTheme = {
  key: "tetrA" | "dmr" | "p25" | "nxdn" | "satcom" | "unknown";
  label: string;
  textColor: string;
  background: string;
  borderColor: string;
};

const PROTOCOL_THEME_MAP: Record<ProtocolTheme["key"], ProtocolTheme> = {
  tetrA: {
    key: "tetrA",
    label: "TETRA",
    textColor: "#9a3412",
    background: "#ffedd5",
    borderColor: "#fdba74",
  },
  dmr: {
    key: "dmr",
    label: "DMR",
    textColor: "#1d4ed8",
    background: "#dbeafe",
    borderColor: "#93c5fd",
  },
  p25: {
    key: "p25",
    label: "P25",
    textColor: "#14532d",
    background: "#dcfce7",
    borderColor: "#86efac",
  },
  nxdn: {
    key: "nxdn",
    label: "NXDN",
    textColor: "#5b21b6",
    background: "#ede9fe",
    borderColor: "#c4b5fd",
  },
  satcom: {
    key: "satcom",
    label: "SATCOM",
    textColor: "#0f766e",
    background: "#ccfbf1",
    borderColor: "#99f6e4",
  },
  unknown: {
    key: "unknown",
    label: "UNKNOWN",
    textColor: "#334155",
    background: "#e2e8f0",
    borderColor: "#cbd5e1",
  },
};

const PROTOCOL_THEME_LEGEND: Array<ProtocolTheme["key"]> = [
  "tetrA",
  "dmr",
  "p25",
  "nxdn",
  "satcom",
];

const resolveProtocolTheme = (
  standard: string | null | undefined,
  protocol: string | null | undefined,
): ProtocolTheme => {
  const haystack = `${standard ?? ""} ${protocol ?? ""}`.toLowerCase();

  if (haystack.includes("tetra")) {
    return PROTOCOL_THEME_MAP.tetrA;
  }
  if (haystack.includes("dmr")) {
    return PROTOCOL_THEME_MAP.dmr;
  }
  if (haystack.includes("p25") || haystack.includes("project 25")) {
    return PROTOCOL_THEME_MAP.p25;
  }
  if (haystack.includes("nxdn")) {
    return PROTOCOL_THEME_MAP.nxdn;
  }
  if (
    haystack.includes("satcom") ||
    haystack.includes("satellite") ||
    haystack.includes("inmarsat") ||
    haystack.includes("iridium")
  ) {
    return PROTOCOL_THEME_MAP.satcom;
  }

  return PROTOCOL_THEME_MAP.unknown;
};

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

type RecentMessage = TcpClientStatus["recent_messages"][number];

type DecodioMetadata = {
  talkgroup: string | null;
  timeslot: string | null;
  lcn: string | null;
  standard: string | null;
};

type StreamerPacket = {
  id: string;
  createdAt: string;
  frequencyHz: number;
  byteLength: number;
  payloadHex: string;
  metadata: Record<string, unknown>;
};

type ChannelSummary = {
  id: string;
  label: string;
  messageCount: number;
  lastReceivedAt: string | null;
  protocols: string[];
  metadata: {
    talkgroups: string[];
    timeslots: string[];
    lcns: string[];
    standards: string[];
  };
};

const CHANNEL_FIELD_PRIORITY = [
  "channel",
  "channel_id",
  "receiver_channel",
  "receiver",
  "lcn",
  "slot",
  "timeslot",
  "ts",
  "talkgroup",
  "tgid",
];

const TALKGROUP_FIELDS = ["tgid", "talkgroup", "talkgroup_id", "group_id"];
const TIMESLOT_FIELDS = ["timeslot", "slot", "ts", "time_slot", "tdma_slot"];
const LCN_FIELDS = ["lcn", "logical_channel", "logical_channel_number", "channel_number"];
const STANDARD_FIELDS = [
  "standard",
  "protocol_family",
  "air_interface",
  "radio_standard",
  "network_type",
  "system_type",
  "service",
];

const buildNormalizedFieldMap = (
  message: RecentMessage,
): Map<string, string> => {
  const normalized = new Map<string, string>();
  const fields = message.parsed_fields;

  if (!fields || Object.keys(fields).length === 0) {
    return normalized;
  }

  Object.entries(fields).forEach(([key, value]) => {
    normalized.set(key.toLowerCase(), value);
  });

  return normalized;
};

const getFirstMatchingValue = (
  normalized: Map<string, string>,
  preferredKeys: string[],
): string | null => {
  for (const key of preferredKeys) {
    const value = normalized.get(key);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  for (const [key, value] of normalized.entries()) {
    if (
      preferredKeys.some(
        (preferredKey) => key.includes(preferredKey) || preferredKey.includes(key),
      )
    ) {
      const normalizedValue = value.trim();
      if (normalizedValue.length > 0) {
        return normalizedValue;
      }
    }
  }

  return null;
};

const getDecodioMetadataFromMessage = (
  message: RecentMessage,
): DecodioMetadata => {
  const normalized = buildNormalizedFieldMap(message);

  return {
    talkgroup: getFirstMatchingValue(normalized, TALKGROUP_FIELDS),
    timeslot: getFirstMatchingValue(normalized, TIMESLOT_FIELDS),
    lcn: getFirstMatchingValue(normalized, LCN_FIELDS),
    standard: getFirstMatchingValue(normalized, STANDARD_FIELDS),
  };
};

const getChannelIdFromMessage = (message: RecentMessage): string | null => {
  const normalized = buildNormalizedFieldMap(message);
  if (normalized.size === 0) {
    return null;
  }

  for (const key of CHANNEL_FIELD_PRIORITY) {
    const value = normalized.get(key);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  for (const [key, value] of normalized.entries()) {
    if (key.includes("channel") || key.includes("slot")) {
      const normalizedValue = value.trim();
      if (normalizedValue.length > 0) {
        return normalizedValue;
      }
    }
  }

  return null;
};

const buildChannelSummaries = (messages: RecentMessage[]): ChannelSummary[] => {
  const map = new Map<string, {
    id: string;
    count: number;
    lastReceivedAt: string | null;
    protocols: Set<string>;
    talkgroups: Set<string>;
    timeslots: Set<string>;
    lcns: Set<string>;
    standards: Set<string>;
  }>();

  messages.forEach((message) => {
    const channelId = getChannelIdFromMessage(message);
    if (!channelId) {
      return;
    }

    const existing = map.get(channelId) ?? {
      id: channelId,
      count: 0,
      lastReceivedAt: null,
      protocols: new Set<string>(),
      talkgroups: new Set<string>(),
      timeslots: new Set<string>(),
      lcns: new Set<string>(),
      standards: new Set<string>(),
    };

    const metadata = getDecodioMetadataFromMessage(message);

    existing.count += 1;
    if (message.received_at) {
      existing.lastReceivedAt = message.received_at;
    }
    if (message.protocol) {
      existing.protocols.add(message.protocol);
    }
    if (metadata.talkgroup) {
      existing.talkgroups.add(metadata.talkgroup);
    }
    if (metadata.timeslot) {
      existing.timeslots.add(metadata.timeslot);
    }
    if (metadata.lcn) {
      existing.lcns.add(metadata.lcn);
    }
    if (metadata.standard) {
      existing.standards.add(metadata.standard);
    }

    map.set(channelId, existing);
  });

  return Array.from(map.values())
    .sort((a, b) => {
      const aDate = a.lastReceivedAt ? Date.parse(a.lastReceivedAt) : 0;
      const bDate = b.lastReceivedAt ? Date.parse(b.lastReceivedAt) : 0;
      return bDate - aDate;
    })
    .map((channel) => ({
      id: channel.id,
      label: `Channel ${channel.id}`,
      messageCount: channel.count,
      lastReceivedAt: channel.lastReceivedAt,
      protocols: Array.from(channel.protocols),
      metadata: {
        talkgroups: Array.from(channel.talkgroups),
        timeslots: Array.from(channel.timeslots),
        lcns: Array.from(channel.lcns),
        standards: Array.from(channel.standards),
      },
    }));
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
  const [selectedChannelId, setSelectedChannelId] = useState<string>("all");

  const wsRef = useRef<WebSocket | null>(null);
  const mockTimerRef = useRef<number | null>(null);
  const [streamerRunning, setStreamerRunning] = useState(false);
  const [streamerMode, setStreamerMode] = useState<
    "websocket" | "mock" | "stopped"
  >("stopped");
  const [streamerFrequencyHz, setStreamerFrequencyHz] = useState<number>(5);
  const [streamerPackets, setStreamerPackets] = useState<StreamerPacket[]>([]);
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(null);
  const [streamerError, setStreamerError] = useState<string | null>(null);
  const [hoveredButton, setHoveredButton] = useState<"start" | "stop" | null>(
    null,
  );

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

  const channelSummaries = useMemo(
    () => buildChannelSummaries(recentMessages),
    [recentMessages],
  );

  const detectedChannelCount = channelSummaries.length;

  const classifiedMessageCount = useMemo(
    () =>
      recentMessages.reduce((total, message) => {
        return getChannelIdFromMessage(message) ? total + 1 : total;
      }, 0),
    [recentMessages],
  );

  const unclassifiedMessageCount = recentMessages.length - classifiedMessageCount;

  const filteredMessages = useMemo(() => {
    if (selectedChannelId === "all") {
      return recentMessages;
    }
    return recentMessages.filter(
      (message) => getChannelIdFromMessage(message) === selectedChannelId,
    );
  }, [recentMessages, selectedChannelId]);

  useEffect(() => {
    if (
      selectedChannelId !== "all" &&
      !channelSummaries.some((channel) => channel.id === selectedChannelId)
    ) {
      setSelectedChannelId("all");
    }
  }, [channelSummaries, selectedChannelId]);

  const streamerStats = useMemo(() => {
    const packets = streamerPackets.length;
    const bytes = streamerPackets.reduce((total, packet) => total + packet.byteLength, 0);
    const lastPacketAt = streamerPackets[0]?.createdAt ?? null;
    return { packets, bytes, lastPacketAt };
  }, [streamerPackets]);

  const stopSignalStreamer = useCallback(() => {
    setStreamerRunning(false);
    setStreamerError(null);

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    if (mockTimerRef.current) {
      window.clearInterval(mockTimerRef.current);
      mockTimerRef.current = null;
    }

    setStreamerMode("stopped");
  }, []);

  const startMockStreamer = useCallback((pps: number) => {
    setStreamerMode("mock");
    setStreamerRunning(true);
    setStreamerError(null);

    const intervalMs = Math.max(80, Math.round(1000 / Math.max(1, pps)));
    if (mockTimerRef.current) {
      window.clearInterval(mockTimerRef.current);
      mockTimerRef.current = null;
    }

    mockTimerRef.current = window.setInterval(() => {
      const now = new Date();
      const id = `${now.getTime()}-${Math.random().toString(16).slice(2)}`;
      const payloadBytes = 48 + Math.floor(Math.random() * 96);
      const payloadHex = Array.from({ length: payloadBytes })
        .map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, "0"))
        .join("");
      const frequencyHz = 430_000_000 + Math.floor(Math.random() * 10_000_000);

      const packet: StreamerPacket = {
        id,
        createdAt: now.toISOString(),
        frequencyHz,
        byteLength: Math.round(payloadHex.length / 2),
        payloadHex,
        metadata: {
          source: "mock",
          protocol: ["DMR", "TETRA", "P25", "NXDN", "SATCOM"][
            Math.floor(Math.random() * 5)
          ],
          rssiDbm: -35 - Math.random() * 55,
          snrDb: 4 + Math.random() * 22,
          channel: `${1 + Math.floor(Math.random() * 12)}`,
          tags: [
            Math.random() > 0.6 ? "SOI" : "ambient",
            Math.random() > 0.75 ? "interference" : "nominal",
          ],
        },
      };

      setStreamerPackets((prev) => {
        const next = [packet, ...prev];
        return next.slice(0, 100);
      });
    }, intervalMs);
  }, []);

  const startSignalStreamer = useCallback(() => {
    stopSignalStreamer();

    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${wsProtocol}://localhost:8081/stream`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const wsFallbackTimer = window.setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          try {
            ws.close();
          } catch {
            // ignore
          }
          wsRef.current = null;
          setStreamerError("WebSocket unavailable. Using mock packet generator.");
          startMockStreamer(streamerFrequencyHz);
        }
      }, 900);

      ws.onopen = () => {
        window.clearTimeout(wsFallbackTimer);
        setStreamerMode("websocket");
        setStreamerRunning(true);
        setStreamerError(null);
      };

      ws.onerror = () => {
        window.clearTimeout(wsFallbackTimer);
        setStreamerError("WebSocket error. Using mock packet generator.");
        startMockStreamer(streamerFrequencyHz);
      };

      ws.onclose = () => {
        window.clearTimeout(wsFallbackTimer);
        if (streamerMode === "websocket") {
          setStreamerRunning(false);
          setStreamerMode("stopped");
        }
      };

      ws.onmessage = (event) => {
        const now = new Date();
        const id = `${now.getTime()}-${Math.random().toString(16).slice(2)}`;

        const safeJsonParse = (value: string): unknown => {
          try {
            return JSON.parse(value);
          } catch {
            return null;
          }
        };

        const parsed = typeof event.data === "string" ? safeJsonParse(event.data) : null;
        const asRecord =
          parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;

        const recordType = typeof asRecord?.type === "string" ? asRecord.type : null;

        if (recordType === "stream_data") {
          const metadata =
            asRecord?.metadata && typeof asRecord.metadata === "object" && !Array.isArray(asRecord.metadata)
              ? (asRecord.metadata as Record<string, unknown>)
              : {};
          const signalData = Array.isArray(asRecord?.signalData)
            ? (asRecord.signalData as unknown[])
            : Array.isArray(asRecord?.signal_data)
              ? (asRecord.signal_data as unknown[])
              : [];

          const floatCount = signalData.length;
          const byteLength = floatCount * 4;

          const frequencyHz =
            typeof metadata.center_frequency === "number"
              ? metadata.center_frequency
              : typeof metadata.centerFrequency === "number"
                ? metadata.centerFrequency
                : 0;

          const packet: StreamerPacket = {
            id,
            createdAt: now.toISOString(),
            frequencyHz,
            byteLength,
            payloadHex: "",
            metadata: {
              ...metadata,
              sample_count: floatCount,
              source: "websocket",
            },
          };

          setStreamerPackets((prev) => {
            const next = [packet, ...prev];
            return next.slice(0, 100);
          });
          return;
        }

        const utf8ToHex = (text: string) => {
          const bytes = new TextEncoder().encode(text);
          return Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        };

        const payloadHex =
          typeof asRecord?.payloadHex === "string"
            ? asRecord.payloadHex
            : typeof asRecord?.payload_hex === "string"
              ? asRecord.payload_hex
              : typeof event.data === "string"
                ? utf8ToHex(event.data)
                : "";

        const byteLength = Math.round(payloadHex.length / 2);
        const frequencyHz =
          typeof asRecord?.frequencyHz === "number"
            ? asRecord.frequencyHz
            : typeof asRecord?.frequency_hz === "number"
              ? asRecord.frequency_hz
              : 0;

        const packet: StreamerPacket = {
          id,
          createdAt: now.toISOString(),
          frequencyHz,
          byteLength,
          payloadHex,
          metadata: asRecord ?? { raw: event.data },
        };

        setStreamerPackets((prev) => {
          const next = [packet, ...prev];
          return next.slice(0, 100);
        });
      };
    } catch {
      setStreamerError("WebSocket unavailable. Using mock packet generator.");
      startMockStreamer(streamerFrequencyHz);
    }
  }, [startMockStreamer, stopSignalStreamer, streamerFrequencyHz, streamerMode]);

  useEffect(() => {
    return () => {
      stopSignalStreamer();
    };
  }, [stopSignalStreamer]);

  const selectedPacket = useMemo(() => {
    if (!selectedPacketId) {
      return null;
    }
    return streamerPackets.find((p) => p.id === selectedPacketId) ?? null;
  }, [selectedPacketId, streamerPackets]);

  const JsonTree = useCallback(
    function JsonTreeInner({
      value,
      depth = 0,
      label,
    }: {
      value: unknown;
      depth?: number;
      label?: string;
    }) {
      const indent = depth * 12;

      const renderPrimitive = (val: unknown) => {
        if (val === null) return <span style={{ color: "#64748B" }}>null</span>;
        if (typeof val === "string")
          return <span style={{ color: "#0f172a" }}>"{val}"</span>;
        if (typeof val === "number")
          return <span style={{ color: "#0f766e" }}>{val}</span>;
        if (typeof val === "boolean")
          return <span style={{ color: "#7c3aed" }}>{String(val)}</span>;
        return <span style={{ color: "#64748B" }}>{String(val)}</span>;
      };

      if (Array.isArray(value)) {
        return (
          <div style={{ marginLeft: indent }}>
            {label && (
              <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
                {label}: <span style={{ color: "#64748B" }}>[{value.length}]</span>
              </div>
            )}
            <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
              {value.map((item, idx) => (
                <JsonTreeInner
                  // eslint-disable-next-line react/no-array-index-key
                  key={idx}
                  value={item}
                  depth={depth + 1}
                  label={String(idx)}
                />
              ))}
            </div>
          </div>
        );
      }

      if (value && typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>);
        return (
          <div style={{ marginLeft: indent }}>
            {label && (
              <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
                {label}
              </div>
            )}
            <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
              {entries.length === 0 ? (
                <div style={{ marginLeft: 12, color: "#64748B", fontSize: 12 }}>
                  {"{ }"}
                </div>
              ) : (
                entries.map(([k, v]) => (
                  <JsonTreeInner key={k} value={v} depth={depth + 1} label={k} />
                ))
              )}
            </div>
          </div>
        );
      }

      return (
        <div style={{ marginLeft: indent, fontSize: 12 }}>
          {label ? (
            <span style={{ fontWeight: 700, color: "#334155" }}>
              {label}:{" "}
            </span>
          ) : null}
          {renderPrimitive(value)}
        </div>
      );
    },
    [],
  );

  return (
    <AppLayout>
      <PageContainer title="DECODIO RED Integration">
        <div style={{ display: "grid", gap: theme.spacing.lg }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: theme.spacing.md,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: 6, minWidth: 280, flex: 1 }}>
              <h2 style={{ margin: 0 }}>DECODIO RED Electronic Warfare Integration</h2>
              <div
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: 14,
                  lineHeight: 1.6,
                  maxWidth: 980,
                }}
              >
                Operator console for integrating DECODIO RED as a spectrum-monitoring and electronic-warfare application layer: monitor and record VHF/UHF activity, surface signals of interest, localize emitters with direction finding, and coordinate one-operator control of distributed sensors.
              </div>
            </div>
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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.95fr)",
              gap: theme.spacing.lg,
              alignItems: "start",
            }}
          >
            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                <div>
                  <h3 style={{ marginTop: 0, marginBottom: 8 }}>EW Mission Fit</h3>
                  <div style={{ color: theme.colors.textSecondary, fontSize: 14, lineHeight: 1.6 }}>
                    Based on Decodio electronic-warfare reference guidance, RED supplements more complex EW systems by helping operators find digital radio protocols, monitor target communications, record traffic for immediate playback, and generate interference or signal-of-interest reporting from a single software package.
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  {RED_CAPABILITIES.map((capability) => (
                    <div
                      key={capability}
                      style={{
                        padding: theme.spacing.md,
                        borderRadius: theme.radius.md,
                        background: theme.colors.surfaceAlt,
                        border: `1px solid ${theme.colors.border}`,
                        color: theme.colors.textSecondary,
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}
                    >
                      {capability}
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                <div>
                  <h3 style={{ marginTop: 0, marginBottom: 8 }}>Operational Application</h3>
                  <div style={{ color: theme.colors.textSecondary, fontSize: 14, lineHeight: 1.6 }}>
                    This integration view aligns the transport layer with EW operations: ingest RED-compatible sensor feeds, classify signals of interest, and pivot quickly into DF, interference reporting, and exercise support workflows.
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {EW_MISSION_AREAS.map((item) => (
                    <span
                      key={item}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#0f766e",
                        background: "#ccfbf1",
                        border: "1px solid #99f6e4",
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    padding: theme.spacing.md,
                    borderRadius: theme.radius.md,
                    background: theme.colors.surfaceAlt,
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: theme.colors.textSecondary }}>
                    Integration Workflow
                  </span>
                  <span style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 1.6 }}>
                    Sensor feed {"->"} RED transport session {"->"} automatic signal detection {"->"} channel and protocol interpretation {"->"} DF/localization support {"->"} operator action or reporting.
                  </span>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <div style={{ display: "grid", gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                Protocol Theme Legend
              </h3>
              <div style={{ color: theme.colors.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
                Color coding prioritizes known EW protocol families for rapid operator triage inside channels and decoded frame cards.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PROTOCOL_THEME_LEGEND.map((key) => {
                  const protocolTheme = PROTOCOL_THEME_MAP[key];
                  return (
                    <span
                      key={protocolTheme.key}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        color: protocolTheme.textColor,
                        background: protocolTheme.background,
                        border: `1px solid ${protocolTheme.borderColor}`,
                      }}
                    >
                      {protocolTheme.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Integration Access</h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
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
                <span style={{ fontSize: 12, color: "#64748B" }}>Write Access</span>
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
            <MetricCard label="RED Gateway" value={statusLabel} />
            <MetricCard
              label="Sensor Links"
              value={loading ? "..." : (health?.active_connections ?? 0)}
            />
            <MetricCard
              label="Observed Links"
              value={loading ? "..." : (health?.total_connections ?? 0)}
            />
            <MetricCard
              label="Frames Received"
              value={loading ? "..." : (health?.messages_received ?? 0)}
            />
            <MetricCard
              label="Frames Rejected"
              value={loading ? "..." : (health?.messages_rejected ?? 0)}
            />
          </div>

          {error && <div style={{ color: theme.colors.danger }}>{error}</div>}

          <Card>
            <h3 style={{ marginTop: 0, marginBottom: theme.spacing.md }}>
              RED Transport Session
            </h3>

            <div
              style={{
                marginBottom: theme.spacing.md,
                color: theme.colors.textSecondary,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              Configure the host transport used to receive RED-compatible sensor output, decoded metadata, and signal-of-interest traffic from connected EW or spectrum-monitoring assets.
            </div>

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

          <Card>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Signals of Interest and Channel Control</h3>

            <div
              style={{
                marginBottom: 14,
                color: theme.colors.textSecondary,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              Decodio RED-style channel management view for sorting active traffic into interpretable channels, protocol families, TGIDs, timeslots, and LCNs so operators can focus on signals of interest quickly.
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <MetricCard label="Detected Channels" value={detectedChannelCount} />
              <MetricCard label="Classified Messages" value={classifiedMessageCount} />
              <MetricCard label="Unclassified" value={unclassifiedMessageCount} />
            </div>

            <label style={{ display: "grid", gap: 6, marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: "#64748B" }}>Active Channel View</span>
              <select
                value={selectedChannelId}
                onChange={(event) => setSelectedChannelId(event.target.value)}
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
                <option value="all">All Channels</option>
                {channelSummaries.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.label} ({channel.messageCount})
                  </option>
                ))}
              </select>
            </label>

            {channelSummaries.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                {channelSummaries.map((channel) => {
                  const isActive = selectedChannelId === channel.id;
                  const protocolTheme = resolveProtocolTheme(
                    channel.metadata.standards[0] ?? null,
                    channel.protocols[0] ?? null,
                  );
                  const metadataBadges = [
                    channel.metadata.talkgroups[0]
                      ? `TGID ${channel.metadata.talkgroups[0]}`
                      : null,
                    channel.metadata.timeslots[0]
                      ? `TS ${channel.metadata.timeslots[0]}`
                      : null,
                    channel.metadata.lcns[0]
                      ? `LCN ${channel.metadata.lcns[0]}`
                      : null,
                    channel.metadata.standards[0]
                      ? `STD ${channel.metadata.standards[0]}`
                      : null,
                  ].filter((badge): badge is string => Boolean(badge));

                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => setSelectedChannelId(channel.id)}
                      style={{
                        border: isActive
                          ? `1px solid ${protocolTheme.borderColor}`
                          : "1px solid #e2e8f0",
                        background: isActive ? protocolTheme.background : "#ffffff",
                        borderRadius: 8,
                        padding: 12,
                        textAlign: "left",
                        cursor: "pointer",
                        display: "grid",
                        gap: 6,
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                        {channel.label}
                      </span>
                      <span style={{ fontSize: 12, color: "#64748B" }}>
                        {channel.messageCount} messages
                      </span>
                      <span style={{ fontSize: 12, color: "#64748B" }}>
                        {channel.protocols.length > 0
                          ? `Protocols: ${channel.protocols.join(", ")}`
                          : "Protocols: unknown"}
                      </span>
                      <span style={{ fontSize: 12, color: "#64748B" }}>
                        Last seen: {channel.lastReceivedAt ?? "-"}
                      </span>

                      <span
                        style={{
                          width: "fit-content",
                          fontSize: 11,
                          fontWeight: 700,
                          color: protocolTheme.textColor,
                          background: protocolTheme.background,
                          border: `1px solid ${protocolTheme.borderColor}`,
                          borderRadius: 999,
                          padding: "2px 8px",
                        }}
                      >
                        {protocolTheme.label}
                      </span>

                      {metadataBadges.length > 0 && (
                        <span
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 6,
                            marginTop: 2,
                          }}
                        >
                          {metadataBadges.map((badge) => (
                            <span
                              key={badge}
                              style={{
                                fontSize: 11,
                                color: protocolTheme.textColor,
                                background: protocolTheme.background,
                                border: `1px solid ${protocolTheme.borderColor}`,
                                borderRadius: 999,
                                padding: "2px 8px",
                                fontWeight: 600,
                              }}
                            >
                              {badge}
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: "#64748B", fontSize: 14 }}>
                No channel metadata found in incoming parsed fields yet.
              </div>
            )}
          </Card>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(280px, 1fr) minmax(420px, 2fr)",
              gap: 20,
              alignItems: "start",
            }}
          >
            <Card>
              <h3 style={{ marginTop: 0, marginBottom: 16 }}>RED Receive Metrics</h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
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

            <Card>
              <h3 style={{ marginTop: 0, marginBottom: 16 }}>
                RED Decoded Traffic (Latest First){" "}
                {selectedChannelId === "all" ? "" : `- Channel ${selectedChannelId}`}
              </h3>

              <div
                style={{
                  marginBottom: 14,
                  color: theme.colors.textSecondary,
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                Review recent decoded transport data, parsed protocol fields, and
                Decodio-oriented metadata extracted from the incoming EW feed.
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {filteredMessages.length === 0 && (
                  <div style={{ color: "#64748B", fontSize: 14 }}>
                    {selectedChannelId === "all"
                      ? "No messages received yet."
                      : "No messages for selected channel."}
                  </div>
                )}

                {filteredMessages.slice(0, 20).map((message, index) => {
                  const metadata = getDecodioMetadataFromMessage(message);
                  const protocolTheme = resolveProtocolTheme(
                    metadata.standard,
                    message.protocol ?? null,
                  );
                  const messageBadges = [
                    metadata.talkgroup ? `TGID ${metadata.talkgroup}` : null,
                    metadata.timeslot ? `TS ${metadata.timeslot}` : null,
                    metadata.lcn ? `LCN ${metadata.lcn}` : null,
                    metadata.standard ? `STD ${metadata.standard}` : null,
                  ].filter((badge): badge is string => Boolean(badge));

                  return (
                    <div
                      key={`${message.received_at ?? "na"}-${index}`}
                      style={{
                        border: `1px solid ${protocolTheme.borderColor}`,
                        borderRadius: 6,
                        padding: 14,
                        background: protocolTheme.background,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
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
                          <span
                            style={{ fontWeight: 700, color: protocolTheme.textColor }}
                          >
                            {protocolTheme.label}
                          </span>
                        </span>
                      </div>

                      {message.ascii_preview && (
                        <div style={{ fontSize: 14, color: "#0f172a" }}>
                          {message.ascii_preview}
                        </div>
                      )}

                      {messageBadges.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {messageBadges.map((badge) => (
                            <span
                              key={badge}
                              style={{
                                fontSize: 11,
                                color: protocolTheme.textColor,
                                background: protocolTheme.background,
                                border: `1px solid ${protocolTheme.borderColor}`,
                                borderRadius: 999,
                                padding: "2px 8px",
                                fontWeight: 600,
                              }}
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                      )}

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
                            {Object.entries(message.parsed_fields).map(([key, value]) => (
                              <div key={key}>
                                <strong>{key}:</strong> {value}
                              </div>
                            ))}
                          </div>
                        )}

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
                        {message.hex_preview ? `hex: ${message.hex_preview}` : message.raw ?? ""}
                      </code>

                      {message.decode_error && (
                        <div style={{ color: "#ef4444", fontSize: 12 }}>
                          {message.decode_error}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <Card>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Signal Streamer</h3>
            <div style={{ color: theme.colors.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
              Real-time packet stream for operator triage. Uses WebSocket when available and falls back to mock packets otherwise.
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
                marginTop: 14,
              }}
            >
              <button
                type="button"
                onClick={startSignalStreamer}
                disabled={streamerRunning}
                onMouseEnter={() => setHoveredButton("start")}
                onMouseLeave={() => setHoveredButton(null)}
                style={{
                  border: "none",
                  borderRadius: 10,
                  background: streamerRunning ? "#94a3b8" : "#11c1ca",
                  color: "#ffffff",
                  fontWeight: 700,
                  padding: "10px 14px",
                  cursor: streamerRunning ? "not-allowed" : "pointer",
                  transition: "transform 0.15s ease, filter 0.15s ease",
                  transform:
                    !streamerRunning && hoveredButton === "start" ? "translateY(-1px)" : "none",
                  filter: !streamerRunning && hoveredButton === "start" ? "brightness(1.05)" : "none",
                }}
              >
                Start Streamer
              </button>

              <button
                type="button"
                onClick={stopSignalStreamer}
                disabled={!streamerRunning}
                onMouseEnter={() => setHoveredButton("stop")}
                onMouseLeave={() => setHoveredButton(null)}
                style={{
                  border: "none",
                  borderRadius: 10,
                  background: !streamerRunning ? "#94a3b8" : "#ef4444",
                  color: "#ffffff",
                  fontWeight: 700,
                  padding: "10px 14px",
                  cursor: !streamerRunning ? "not-allowed" : "pointer",
                  transition: "transform 0.15s ease, filter 0.15s ease",
                  transform:
                    streamerRunning && hoveredButton === "stop" ? "translateY(-1px)" : "none",
                  filter: streamerRunning && hoveredButton === "stop" ? "brightness(1.05)" : "none",
                }}
              >
                Stop Streamer
              </button>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>PPS</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={streamerFrequencyHz}
                  disabled={streamerRunning && streamerMode !== "mock"}
                  onChange={(e) => setStreamerFrequencyHz(Number(e.target.value))}
                  style={{
                    width: 80,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    color: "#0f172a",
                  }}
                />
                <button
                  type="button"
                  disabled={!streamerRunning || streamerMode !== "mock"}
                  onClick={() => startMockStreamer(streamerFrequencyHz)}
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: 10,
                    background: "#ffffff",
                    color: "#0f172a",
                    fontWeight: 700,
                    padding: "10px 12px",
                    cursor:
                      !streamerRunning || streamerMode !== "mock" ? "not-allowed" : "pointer",
                    opacity: !streamerRunning || streamerMode !== "mock" ? 0.6 : 1,
                  }}
                >
                  Apply (Mock)
                </button>
              </label>
            </div>

            {streamerError && (
              <div style={{ marginTop: 10, fontSize: 13, color: "#ef4444" }}>
                {streamerError}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
                marginTop: 14,
              }}
            >
              <MetricCard label="Status" value={streamerRunning ? "RUNNING" : "STOPPED"} />
              <MetricCard label="Mode" value={streamerMode.toUpperCase()} />
              <MetricCard label="Packets" value={streamerStats.packets} />
              <MetricCard label="Data Size" value={`${streamerStats.bytes} bytes`} />
              <MetricCard label="Frequency" value={`${streamerFrequencyHz} pps`} />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(260px, 0.95fr) minmax(360px, 1.6fr)",
                gap: 16,
                marginTop: 16,
                alignItems: "start",
              }}
            >
              <div
                style={{
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.md,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "10px 12px",
                    background: theme.colors.surfaceAlt,
                    borderBottom: `1px solid ${theme.colors.border}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 800, color: theme.colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Packets (Newest First)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStreamerPackets([]);
                      setSelectedPacketId(null);
                    }}
                    style={{
                      border: "1px solid #d1d5db",
                      borderRadius: 10,
                      background: "#ffffff",
                      color: "#0f172a",
                      fontWeight: 700,
                      padding: "8px 10px",
                      cursor: "pointer",
                    }}
                  >
                    Clear
                  </button>
                </div>

                <div style={{ maxHeight: 420, overflow: "auto", background: "#ffffff" }}>
                  {streamerPackets.length === 0 ? (
                    <div style={{ padding: 12, color: "#64748B", fontSize: 13 }}>
                      No packets yet. Start the streamer to generate traffic.
                    </div>
                  ) : (
                    <div style={{ display: "grid" }}>
                      {streamerPackets.slice(0, 5).map((packet) => {
                        const isSelected = packet.id === selectedPacketId;
                        return (
                          <button
                            key={packet.id}
                            type="button"
                            onClick={() => setSelectedPacketId(packet.id)}
                            style={{
                              border: "none",
                              textAlign: "left",
                              padding: 12,
                              cursor: "pointer",
                              background: isSelected ? "#dbeafe" : "#ffffff",
                              borderBottom: "1px solid #e2e8f0",
                              transition: "background 0.12s ease",
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) (e.currentTarget.style.background = "#f8fafc");
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) (e.currentTarget.style.background = "#ffffff");
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                              <div style={{ display: "grid", gap: 4 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                                  {packet.frequencyHz ? `${(packet.frequencyHz / 1_000_000).toFixed(4)} MHz` : "Packet"}
                                </div>
                                <div style={{ fontSize: 12, color: "#64748B" }}>
                                  {packet.byteLength} bytes • {packet.createdAt}
                                </div>
                              </div>

                              {isSelected && (
                                <span
                                  style={{
                                    alignSelf: "start",
                                    fontSize: 11,
                                    fontWeight: 900,
                                    color: "#1d4ed8",
                                    background: "#eff6ff",
                                    border: "1px solid #93c5fd",
                                    borderRadius: 999,
                                    padding: "4px 10px",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  ✓ SELECTED
                                </span>
                              )}
                            </div>

                            <div style={{ marginTop: 8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace", fontSize: 12, color: "#334155" }}>
                              {packet.payloadHex.slice(0, 72)}
                              {packet.payloadHex.length > 72 ? "…" : ""}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.md,
                  overflow: "hidden",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    padding: "10px 12px",
                    background: theme.colors.surfaceAlt,
                    borderBottom: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 800, color: theme.colors.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Packet Metadata (JSON Tree)
                  </span>
                </div>

                <div style={{ padding: 12, maxHeight: 420, overflow: "auto" }}>
                  {!selectedPacket ? (
                    <div style={{ color: "#64748B", fontSize: 13 }}>
                      Click a packet to view metadata.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          border: "1px solid #e2e8f0",
                          background: "#f8fafc",
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>
                          Selected Packet
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: "#64748B" }}>
                          {selectedPacket.createdAt} • {selectedPacket.byteLength} bytes
                        </div>
                      </div>

                      <div>
                        <JsonTree
                          value={{
                            id: selectedPacket.id,
                            createdAt: selectedPacket.createdAt,
                            frequencyHz: selectedPacket.frequencyHz,
                            byteLength: selectedPacket.byteLength,
                            payloadHex: selectedPacket.payloadHex,
                            metadata: selectedPacket.metadata,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
