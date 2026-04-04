import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { fft } from "fft-js";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";
import MetricCard from "../../components/ui/MetricCard";
import {
  getTcpClientStatus,
  getTcpListenerHealth,
  type TcpClientStatus,
  type TcpListenerHealth,
} from "../../api/tcpListener";
import { useTheme } from "../../context/ThemeContext";

const REFRESH_MS = 5000;
const STREAM_BUFFER_LIMIT = 100;
const STREAM_TABLE_ROWS = 20;

// -----------------------------------------------------------------------------
// Streamer types
// -----------------------------------------------------------------------------
type StreamPacket = {
  metadata: Record<string, unknown>;
  signalData: Float32Array;
  receivedAt: number;
};

type StreamStats = {
  packetsReceived: number;
  totalBytes: number;
  lastPacketTime: number;
  averageFrequency: number;
  averageAmplitude: number;
};

// -----------------------------------------------------------------------------
// Adaptive input + sidebar UI (from your spec)
// -----------------------------------------------------------------------------
function AdaptiveInput({
  value,
  defaultValue,
  placeholder,
  type = "text",
  minLength,
  maxLength,
  width = "100%",
  textAlign = "left",
  label,
  labelWidth = "120px",
  onChange,
}: {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  minLength?: number;
  maxLength?: number;
  width?: string;
  textAlign?: "left" | "center" | "right";
  label?: string;
  labelWidth?: string;
  onChange?: (value: string) => void;
}) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const inputStyle = useMemo(
    () => ({
      padding: theme.spacing.xs,
      border: `1px solid ${isFocused ? theme.colors.primary : theme.colors.border}`,
      borderRadius: theme.radius.sm,
      background: theme.colors.surface,
      color: theme.colors.textPrimary,
      width,
      textAlign,
      fontSize: "0.9em",
      outline: "none",
      transition: "all 0.2s ease",
      boxShadow: isFocused ? `0 0 0 2px ${theme.colors.primary}20` : "none",
      caretColor: theme.colors.textPrimary,
    }),
    [theme, isFocused, width, textAlign],
  );

  const labelStyle = useMemo(
    () => ({
      minWidth: labelWidth,
      fontSize: "0.9em",
      color: theme.colors.textPrimary,
      fontWeight: 600,
    }),
    [theme, labelWidth],
  );

  const input = (
    <input
      type={type}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      minLength={minLength}
      maxLength={maxLength}
      style={inputStyle}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );

  if (!label) return input;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.md }}>
      <label style={labelStyle}>{label}:</label>
      {input}
    </div>
  );
}

function SidebarItem({
  label,
  isActive = false,
  onClick,
}: {
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const buttonStyle = useMemo(
    () => ({
      padding: theme.spacing.sm,
      backgroundColor: isActive || isHovered || isFocused ? theme.colors.surface : "transparent",
      color: isActive || isHovered || isFocused ? theme.colors.primary : theme.colors.textPrimary,
      border: "none",
      borderRadius: theme.radius.sm,
      cursor: "pointer",
      textAlign: "left" as const,
      fontSize: "0.9em",
      fontWeight: 600,
      transition: "all 0.2s ease",
      outline: isFocused ? `2px solid ${theme.colors.primary}` : "none",
      outlineOffset: "2px",
      transform: isHovered ? "translateX(2px)" : "translateX(0)",
    }),
    [theme, isHovered, isFocused, isActive],
  );

  return (
    <button
      type="button"
      onClick={onClick}
      style={buttonStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      {label}
    </button>
  );
}

function FormLabel({
  children,
  color,
  fontWeight = "normal",
}: {
  children: React.ReactNode;
  color?: string;
  fontWeight?: string;
}) {
  const { theme } = useTheme();
  const labelStyle = useMemo(
    () => ({
      color: color || theme.colors.textPrimary,
      fontWeight,
    }),
    [theme, color, fontWeight],
  );
  return <span style={labelStyle}>{children}</span>;
}

// -----------------------------------------------------------------------------
// Spectrum / waterfall charts (driven by stream data)
// -----------------------------------------------------------------------------
type SignalData = {
  frequencies: number[];
  power: number[];
};

const DEFAULT_POWER_MIN = -120;
const DEFAULT_POWER_MAX = -20;

const SPECTROGRAM_BAND_BINS = 32;

/** Visible band so the spectrogram canvas draws immediately before the first FFT arrives. */
function buildPlaceholderSpectrogramBand(binCount = SPECTROGRAM_BAND_BINS): number[] {
  const mid = (binCount - 1) / 2;
  return Array.from({ length: binCount }, (_, i) => {
    const d = (i - mid) / (mid || 1);
    const noise = -88 + Math.random() * 4;
    const peak = 28 * Math.exp(-d * d * 6);
    return noise + peak;
  });
}

const getNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const computeSpectrum = (samples: Float32Array, sampleRateHz: number): SignalData => {
  const complex = fft(Array.from(samples)) as Array<[number, number]>;
  const n = complex.length;
  const half = Math.floor(n / 2);

  const frequencies: number[] = [];
  const power: number[] = [];

  for (let i = 0; i < half; i++) {
    const [re, im] = complex[i] ?? [0, 0];
    const mag2 = re * re + im * im;
    const db = 10 * Math.log10(mag2 + 1e-12);
    const f = (i * sampleRateHz) / n;
    frequencies.push(f);
    power.push(db);
  }

  return { frequencies, power };
};

function BandwidthScale({ width, height }: { width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = Math.max(1, Math.floor(width));
    canvas.height = Math.max(1, Math.floor(height));

    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";
    ctx.textAlign = "center";

    ctx.fillText("0 Hz", 30, canvas.height - 5);
    ctx.fillText("Nyquist", canvas.width / 2, canvas.height - 5);
    ctx.fillText("Fs/2", canvas.width - 40, canvas.height - 5);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = 30 + ((canvas.width - 40) / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 3);
      ctx.stroke();
    }
  }, [width, height]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}

function FrequencyPowerChart({
  spectrum,
  powerRange,
}: {
  spectrum: SignalData | null;
  powerRange: { min: number; max: number };
}) {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setDimensions({
        width: entry.contentRect.width,
        height: entry.contentRect.height - 30,
      });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!spectrum) return;
    if (dimensions.width === 0 || dimensions.height === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = Math.max(1, Math.floor(dimensions.width));
    canvas.height = Math.max(1, Math.floor(dimensions.height));

    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 8; i++) {
      const y = (canvas.height / 8) * i;
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(canvas.width - 10, y);
      ctx.stroke();
      if (i % 2 === 0) {
        ctx.fillStyle = "#ffffff";
        ctx.font =
          "10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";
        const p = powerRange.min + (powerRange.max - powerRange.min) * (1 - i / 8);
        ctx.fillText(`${p.toFixed(0)} dB`, 2, y + 3);
      }
    }

    for (let i = 0; i <= 10; i++) {
      const x = 40 + ((canvas.width - 50) / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    ctx.strokeStyle = "#ffff00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    spectrum.power.forEach((p, idx) => {
      const x = 40 + (idx / (spectrum.power.length - 1)) * (canvas.width - 50);
      const y = ((p - powerRange.min) / (powerRange.max - powerRange.min)) * canvas.height;
      if (idx === 0) ctx.moveTo(x, canvas.height - y);
      else ctx.lineTo(x, canvas.height - y);
    });
    ctx.stroke();
  }, [dimensions, theme, spectrum, powerRange.min, powerRange.max]);

  return (
    <div style={{ width: "100%", height: 400, position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height: "calc(100% - 30px)" }}>
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            background: "#0a0a0a",
            borderRadius: theme.radius.sm,
            border: `1px solid ${theme.colors.border}`,
            display: "block",
          }}
        />
      </div>
      <div style={{ height: 30, width: "100%" }}>
        <BandwidthScale width={dimensions.width} height={30} />
      </div>
    </div>
  );
}

function WaterfallChart({
  rows,
  powerRange,
}: {
  rows: number[][];
  powerRange: { min: number; max: number };
}) {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setDimensions({
        width: entry.contentRect.width,
        height: entry.contentRect.height - 30,
      });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const mapPowerToColor = (power: number): [number, number, number] => {
    const normalizedPower = Math.max(
      0,
      Math.min(1, (power - powerRange.min) / (powerRange.max - powerRange.min)),
    );
    let r = 0;
    let g = 0;
    let b = 0;
    if (normalizedPower < 0.15) {
      const t = normalizedPower / 0.15;
      r = 0;
      g = 0;
      b = Math.floor(10 + t * 40);
    } else if (normalizedPower < 0.3) {
      const t = (normalizedPower - 0.15) / 0.15;
      r = 0;
      g = 0;
      b = Math.floor(50 + t * 100);
    } else if (normalizedPower < 0.5) {
      const t = (normalizedPower - 0.3) / 0.2;
      r = 0;
      g = Math.floor(t * 150);
      b = Math.floor(150 + t * 105);
    } else if (normalizedPower < 0.7) {
      const t = (normalizedPower - 0.5) / 0.2;
      r = Math.floor(t * 255);
      g = Math.floor(150 + t * 105);
      b = Math.floor(255 - t * 255);
    } else {
      const t = (normalizedPower - 0.7) / 0.3;
      r = 255;
      g = Math.floor(255 - t * 200);
      b = 0;
    }
    return [r, g, b];
  };

  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = Math.max(1, Math.floor(dimensions.width));
    canvas.height = Math.max(1, Math.floor(dimensions.height));

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (rows.length === 0) {
      return;
    }

    const image = ctx.createImageData(canvas.width, canvas.height);
    const rowCount = rows.length;
    for (let y = 0; y < canvas.height; y++) {
      const rowIndex = Math.min(rowCount - 1, Math.floor((y / canvas.height) * rowCount));
      const row = rows[rowIndex] ?? rows[rowCount - 1] ?? [];
      for (let x = 0; x < canvas.width; x++) {
        const idx = Math.min(row.length - 1, Math.floor((x / canvas.width) * row.length));
        const intensity = row[idx] ?? powerRange.min;
        const [r, g, b] = mapPowerToColor(intensity);
        const off = (y * canvas.width + x) * 4;
        image.data[off] = r;
        image.data[off + 1] = g;
        image.data[off + 2] = b;
        image.data[off + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }, [dimensions, theme, rows, powerRange.min, powerRange.max]);

  return (
    <div style={{ width: "100%", height: 400, position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height: "calc(100% - 30px)" }}>
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            background: "#000000",
            borderRadius: theme.radius.sm,
            border: `1px solid ${theme.colors.border}`,
            display: "block",
          }}
        />
      </div>
      <div style={{ height: 30, width: "100%" }}>
        <BandwidthScale width={dimensions.width} height={30} />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers for TCP listener messages
// -----------------------------------------------------------------------------
type RecentMessage = TcpClientStatus["recent_messages"][number];

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

const resolveProtocolTheme = (
  standard: string | null | undefined,
  protocol: string | null | undefined,
): ProtocolTheme => {
  const haystack = `${standard ?? ""} ${protocol ?? ""}`.toLowerCase();
  if (haystack.includes("tetra")) return PROTOCOL_THEME_MAP.tetrA;
  if (haystack.includes("dmr")) return PROTOCOL_THEME_MAP.dmr;
  if (haystack.includes("p25") || haystack.includes("project 25")) return PROTOCOL_THEME_MAP.p25;
  if (haystack.includes("nxdn")) return PROTOCOL_THEME_MAP.nxdn;
  if (haystack.includes("satcom") || haystack.includes("satellite")) return PROTOCOL_THEME_MAP.satcom;
  return PROTOCOL_THEME_MAP.unknown;
};

type NormalizedFieldMap = Record<string, unknown>;

const buildNormalizedFieldMap = (message: RecentMessage): NormalizedFieldMap => {
  const normalized: NormalizedFieldMap = {};
  const fields = message.parsed_fields ?? {};
  for (const [key, value] of Object.entries(fields)) {
    normalized[key.toLowerCase().replace(/[^a-z0-9]/g, "_")] = value;
  }
  return normalized;
};

const formatBytes = (bytes: number | null | undefined): string => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const formatDuration = (seconds: number | null | undefined): string => {
  if (!seconds) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
};

export default function OperatorSignalAnalyzerPage() {
  const { theme } = useTheme();

  const [tcpClientStatus, setTcpClientStatus] = useState<TcpClientStatus | null>(null);
  const [tcpListenerHealth, setTcpListenerHealth] = useState<TcpListenerHealth | null>(null);
  const [activeTab, setActiveTab] = useState("Device");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected">(
    "disconnected",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Streamer state
  const [isStreamerActive, setIsStreamerActive] = useState(false);
  const [streamData, setStreamData] = useState<StreamPacket[]>([]);
  const [streamStats, setStreamStats] = useState<StreamStats>({
    packetsReceived: 0,
    totalBytes: 0,
    lastPacketTime: 0,
    averageFrequency: 0,
    averageAmplitude: 0,
  });
  const [streamError, setStreamError] = useState<string | null>(null);
  const [selectedPacket, setSelectedPacket] = useState<StreamPacket | null>(null);
  const streamSocketRef = useRef<WebSocket | null>(null);
  const mockTimerRef = useRef<number | null>(null);
  const [latestSpectrum, setLatestSpectrum] = useState<SignalData | null>(null);
  const [waterfallRows, setWaterfallRows] = useState<number[][]>([]);
  const [selectedSpectrogramHz, setSelectedSpectrogramHz] = useState<number | null>(null);
  const [spectrogramRows, setSpectrogramRows] = useState<number[][]>([]);
  const selectedSpectrogramHzRef = useRef<number | null>(null);
  const mockTimeRef = useRef(0);

  useEffect(() => {
    selectedSpectrogramHzRef.current = selectedSpectrogramHz;
  }, [selectedSpectrogramHz]);

  const extractSpectrogramBand = useCallback(
    (spectrum: SignalData, targetHz: number, halfWidthBins = 16) => {
      if (spectrum.frequencies.length === 0 || spectrum.power.length === 0) {
        return [];
      }
      const idx = spectrum.frequencies.reduce((bestIdx, f, i) => {
        const bestF = spectrum.frequencies[bestIdx] ?? 0;
        return Math.abs(f - targetHz) < Math.abs(bestF - targetHz) ? i : bestIdx;
      }, 0);
      const start = Math.max(0, idx - halfWidthBins);
      const end = Math.min(spectrum.power.length, idx + halfWidthBins);
      return spectrum.power.slice(start, end);
    },
    [],
  );

  const selectSpectrogram = useCallback(
    (hz: number) => {
      setSelectedSpectrogramHz(hz);
      selectedSpectrogramHzRef.current = hz;
      // Seed immediately so the waterfall draws without waiting for the next packet.
      if (latestSpectrum) {
        const band = extractSpectrogramBand(latestSpectrum, hz);
        setSpectrogramRows(band.length > 0 ? [band] : [buildPlaceholderSpectrogramBand()]);
      } else {
        setSpectrogramRows([buildPlaceholderSpectrogramBand()]);
      }
    },
    [extractSpectrogramBand, latestSpectrum],
  );

  const handleConnect = useCallback(async () => {
    setConnectionStatus("connected");
  }, []);

  const handleDisconnect = useCallback(async () => {
    setConnectionStatus("disconnected");
  }, []);

  const handleTabClick = useCallback((tabName: string) => {
    setActiveTab(tabName);
    if (tabName === "Protocols") {
      setActiveDropdown((prev) => (prev === "protocols" ? null : "protocols"));
    } else if (tabName === "Tools") {
      setActiveDropdown((prev) => (prev === "tools" ? null : "tools"));
    } else if (tabName === "Windows") {
      setActiveDropdown((prev) => (prev === "windows" ? null : "windows"));
    } else if (tabName === "Info") {
      setActiveDropdown((prev) => (prev === "info" ? null : "info"));
    } else {
      setActiveDropdown(null);
    }
  }, [activeDropdown]);

  const handleDropdownItemClick = useCallback((protocol: string) => {
    console.log(`${protocol} selected`);
    setActiveDropdown(null);
  }, []);

  const handleClickOutside = useCallback(() => {
    setActiveDropdown(null);
  }, []);

  const stopMockTimer = useCallback(() => {
    if (mockTimerRef.current) {
      window.clearInterval(mockTimerRef.current);
      mockTimerRef.current = null;
    }
  }, []);

  const handleStartStreamer = useCallback(() => {
    setIsStreamerActive(true);
    setStreamError(null);
    setStreamData([]);
    setSelectedPacket(null);
    setStreamStats({
      packetsReceived: 0,
      totalBytes: 0,
      lastPacketTime: 0,
      averageFrequency: 0,
      averageAmplitude: 0,
    });

    try {
      const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
      const wsUrl = `${wsProto}://${window.location.hostname}:8000/ws/signal-analyzer`;
      const ws = new WebSocket(wsUrl);
      streamSocketRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as any;
          if (data?.type !== "stream_data") return;
          const floatData = Array.isArray(data.signalData)
            ? new Float32Array(data.signalData)
            : new Float32Array();

          const packet: StreamPacket = {
            metadata: (data.metadata ?? {}) as Record<string, unknown>,
            signalData: floatData,
            receivedAt: Date.now(),
          };

          setStreamData((prev) => [...prev, packet].slice(-STREAM_BUFFER_LIMIT));
          setStreamStats((prev) => {
            const amps = Array.isArray(packet.metadata.amplitudes)
              ? (packet.metadata.amplitudes as number[])
              : [];
            const avgAmp =
              amps.length > 0 ? amps.reduce((a, b) => a + b, 0) / amps.length : 0;
            const freq = typeof packet.metadata.center_frequency === "number" ? packet.metadata.center_frequency : 0;
            return {
              packetsReceived: prev.packetsReceived + 1,
              totalBytes: prev.totalBytes + floatData.length * 4,
              lastPacketTime: packet.receivedAt,
              averageFrequency: freq,
              averageAmplitude: avgAmp,
            };
          });

          const sampleRateHz = getNumber(packet.metadata.sample_rate, 1024);
          const spectrum = computeSpectrum(packet.signalData, sampleRateHz);
          setLatestSpectrum(spectrum);
          setWaterfallRows((prev) => [spectrum.power, ...prev].slice(0, 200));

          const specHz = selectedSpectrogramHzRef.current;
          if (specHz !== null) {
            const band = extractSpectrogramBand(spectrum, specHz);
            if (band.length > 0) {
              setSpectrogramRows((prev) => [band, ...prev].slice(0, 200));
            }
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        setStreamError("WebSocket connection failed - using mock data instead");
      };
    } catch {
      setStreamError("WebSocket connection failed - using mock data instead");
    }

    stopMockTimer();
    mockTimerRef.current = window.setInterval(() => {
      // Realistic-ish simulator matching your Python streamer fields.
      const sampleRateHz = 1024;
      const chunkSize = 1024;
      const dt = 1 / sampleRateHz;

      const baseFreqs = [50, 120, 300];
      const baseAmps = [1.0, 0.5, 0.2];

      // If a spectrogram column is selected, bias one tone to make the stripe obvious.
      const targetHz = selectedSpectrogramHzRef.current;

      const freqs = baseFreqs.map((f) => f + (Math.random() - 0.5) * 2.0);
      const amps = baseAmps.map((a) => Math.max(0.1, Math.min(2.0, a + (Math.random() - 0.5) * 0.15)));
      if (typeof targetHz === "number") {
        const already = freqs.some((f) => Math.abs(f - targetHz) < 1);
        if (!already) {
          freqs.unshift(targetHz);
          amps.unshift(1.6);
        } else {
          const idx = freqs.findIndex((f) => Math.abs(f - targetHz) < 1);
          if (idx >= 0) amps[idx] = Math.max(amps[idx] ?? 0, 1.6);
        }
      }

      const noiseLevel = Math.max(0.05, Math.min(0.5, 0.2 + (Math.random() - 0.5) * 0.12));
      const modulations = ["FM", "AM", "None"] as const;
      const modulation = modulations[Math.floor(Math.random() * modulations.length)] ?? "None";

      const signalData = new Float32Array(chunkSize);
      const tStart = mockTimeRef.current;
      for (let i = 0; i < chunkSize; i++) {
        const t = tStart + i * dt;
        let v = 0;
        for (let k = 0; k < freqs.length; k++) {
          const f = freqs[k] ?? 0;
          const a = amps[k] ?? 0;
          if (modulation === "FM") {
            const carrier = Math.sin(2 * Math.PI * f * t);
            v += a * Math.sin(2 * Math.PI * f * 10 * t + carrier);
          } else if (modulation === "AM") {
            v += a * (1 + 0.5 * Math.sin(2 * Math.PI * f * t)) * Math.sin(2 * Math.PI * f * t);
          } else {
            v += a * Math.sin(2 * Math.PI * f * t);
          }
        }
        // Gaussian-ish noise (sum of uniforms)
        const n =
          (Math.random() + Math.random() + Math.random() + Math.random() - 2) *
          0.5 *
          noiseLevel;
        signalData[i] = v + n;
      }
      mockTimeRef.current += chunkSize / sampleRateHz;

      const centerFrequency = 2.4e9 + (Math.random() - 0.5) * 2e6;

      const packet: StreamPacket = {
        metadata: {
          timestamp: Date.now() / 1000,
          sample_rate: sampleRateHz,
          center_frequency: centerFrequency,
          frequencies: freqs.map((f) => Math.round(f * 100) / 100),
          amplitudes: amps.map((a) => Math.round(a * 100) / 100),
          noise_level: Math.round(noiseLevel * 1000) / 1000,
          modulation,
          chunk_size: chunkSize,
          source: "mock_simulator",
        },
        signalData,
        receivedAt: Date.now(),
      };

      setStreamData((prev) => [...prev, packet].slice(-STREAM_BUFFER_LIMIT));
      setStreamStats((prev) => {
        const amps = packet.metadata.amplitudes as number[];
        const avgAmp = amps.reduce((a, b) => a + b, 0) / amps.length;
        return {
          packetsReceived: prev.packetsReceived + 1,
          totalBytes: prev.totalBytes + signalData.length * 4,
          lastPacketTime: packet.receivedAt,
          averageFrequency: packet.metadata.center_frequency as number,
          averageAmplitude: avgAmp,
        };
      });

      const spectrum = computeSpectrum(signalData, getNumber(packet.metadata.sample_rate, 1024));
      setLatestSpectrum(spectrum);
      setWaterfallRows((prev) => [spectrum.power, ...prev].slice(0, 200));

      const specHz = selectedSpectrogramHzRef.current;
      if (specHz !== null) {
        const band = extractSpectrogramBand(spectrum, specHz);
        if (band.length > 0) {
          setSpectrogramRows((prev) => [band, ...prev].slice(0, 200));
        }
      }
    }, 1000);
  }, [stopMockTimer, extractSpectrogramBand]);

  const handleStopStreamer = useCallback(() => {
    setIsStreamerActive(false);
    if (streamSocketRef.current) {
      try {
        streamSocketRef.current.close();
      } catch {
        // ignore
      }
      streamSocketRef.current = null;
    }
    stopMockTimer();
  }, [stopMockTimer]);

  const handlePacketClick = useCallback((packet: StreamPacket) => {
    setSelectedPacket(packet);
  }, []);

  const streamTableColumns = useMemo(() => {
    const first = streamData[streamData.length - 1]?.metadata;
    const freqs = Array.isArray(first?.frequencies) ? (first?.frequencies as number[]) : [];
    return freqs.slice(0, 8);
  }, [streamData]);

  const powerRange = useMemo(() => {
    const p = latestSpectrum?.power ?? [];
    if (p.length === 0) {
      return { min: DEFAULT_POWER_MIN, max: DEFAULT_POWER_MAX };
    }
    let min = p[0] ?? DEFAULT_POWER_MIN;
    let max = p[0] ?? DEFAULT_POWER_MAX;
    for (const v of p) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return { min: Math.floor(min - 5), max: Math.ceil(max + 5) };
  }, [latestSpectrum]);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [statusResponse, healthResponse] = await Promise.all([
        getTcpClientStatus(),
        getTcpListenerHealth(),
      ]);
      setTcpClientStatus(statusResponse.data);
      setTcpListenerHealth(healthResponse.data);
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? (err.response?.data?.detail ?? err.message)
          : "Failed to fetch TCP client data",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = window.setInterval(fetchData, REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    return () => {
      handleStopStreamer();
    };
  }, [handleStopStreamer]);

  const protocolStats = useMemo(() => {
    const stats = new Map<string, { count: number; bytes: number; duration: number }>();
    const msgs = tcpClientStatus?.recent_messages ?? [];
    for (const message of msgs) {
      const protocol = message.protocol ?? "unknown";
      const existing = stats.get(protocol) ?? { count: 0, bytes: 0, duration: 0 };
      existing.count += 1;
      existing.bytes += (message.byte_length ?? 0) as number;
      existing.duration += (message.duration_seconds ?? 0) as number;
      stats.set(protocol, existing);
    }
    return stats;
  }, [tcpClientStatus?.recent_messages]);

  const recentMessages = useMemo(() => {
    const msgs = tcpClientStatus?.recent_messages ?? [];
    return msgs.slice().reverse().slice(0, 20);
  }, [tcpClientStatus?.recent_messages]);

  return (
    <AppLayout>
      <PageContainer title="SIGNAL ANALYZER">
        <div style={{ display: "grid", gap: theme.spacing.lg }}>
          <div
            style={{
              display: "grid",
              gap: theme.spacing.lg,
              gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
            }}
          >
            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                <div style={{ fontWeight: 800, color: theme.colors.primary }}>Operation Mode</div>
                <div style={{ display: "grid", gap: theme.spacing.sm, justifyItems: "start" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm, cursor: "pointer" }}>
                    <input type="radio" name="operationMode" checked readOnly />
                    <FormLabel color={theme.colors.textPrimary}>Local mode</FormLabel>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm, cursor: "pointer" }}>
                    <input type="radio" name="operationMode" readOnly />
                    <FormLabel color={theme.colors.textPrimary}>Server mode</FormLabel>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm, cursor: "pointer" }}>
                    <input type="radio" name="operationMode" readOnly />
                    <FormLabel color={theme.colors.textPrimary}>Remote mode</FormLabel>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", marginLeft: theme.spacing.xl }}>
                    <FormLabel color={theme.colors.textPrimary} fontWeight="700">
                      Port: 
                    </FormLabel>
                    <AdaptiveInput defaultValue="12345" minLength={5} maxLength={6} width="80px" textAlign="center" />
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                <div style={{ fontWeight: 800, color: theme.colors.primary }}>License options</div>
                <div style={{ display: "grid", gap: theme.spacing.sm }}>
                  <label style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm, cursor: "pointer" }}>
                    <input type="radio" name="licenseOptions" checked readOnly />
                    <FormLabel color={theme.colors.textPrimary}>Local</FormLabel>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm, cursor: "pointer" }}>
                    <input type="radio" name="licenseOptions" readOnly />
                    <FormLabel color={theme.colors.textPrimary}>LAN</FormLabel>
                  </label>

                  <div style={{ display: "flex", alignItems: "center", marginLeft: theme.spacing.xl }}>
                    <FormLabel color={theme.colors.textPrimary} fontWeight="700">
                      Server : 
                    </FormLabel>
                    <AdaptiveInput defaultValue="localhost" width="120px" />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", marginLeft: theme.spacing.xl }}>
                    <FormLabel color={theme.colors.textPrimary} fontWeight="700">
                      Dongle : 
                    </FormLabel>
                    <AdaptiveInput defaultValue="123#abc" minLength={1} maxLength={12} width="120px" textAlign="center" />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <div style={{ display: "grid", gap: theme.spacing.md }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>Device Connection Control</h3>
                <div style={{ display: "flex", gap: 10, alignItems: "center", color: theme.colors.textSecondary }}>
                  <span>TCP Listener:</span>
                  <strong style={{ color: theme.colors.textPrimary }}>
                    {tcpListenerHealth?.running ? "RUNNING" : "STOPPED"}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: theme.spacing.xs,
                  borderBottom: `1px solid ${theme.colors.border}`,
                  paddingBottom: theme.spacing.xs,
                  flexWrap: "wrap",
                  position: "relative",
                }}
              >
                {["Device", "Protocols", "Tools", "Windows", "Settings", "Projects", "Info", "Signal Command"].map((tab) => (
                  <div key={tab} style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => handleTabClick(tab)}
                      style={{
                        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                        backgroundColor: activeTab === tab ? theme.colors.primary : "transparent",
                        color: activeTab === tab ? theme.colors.surface : theme.colors.textSecondary,
                        border: activeTab === tab ? `1px solid ${theme.colors.primary}` : "1px solid transparent",
                        borderRadius: theme.radius.sm,
                        cursor: "pointer",
                        fontSize: "0.9em",
                        transition: "all 0.2s ease",
                        outline: "none",
                      }}
                    >
                      {tab}
                    </button>
                    
                    {/* Protocols Dropdown Menu */}
                    {tab === "Protocols" && activeDropdown === "protocols" && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          backgroundColor: theme.colors.surface,
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: theme.radius.sm,
                          padding: theme.spacing.xs,
                          marginTop: theme.spacing.xs,
                          zIndex: 10,
                          minWidth: "200px",
                          maxHeight: "300px",
                          overflowY: "auto",
                          boxShadow: `0 2px 8px ${theme.colors.border}50`,
                        }}
                      >
                        {[
                          "Recording", "Classifier", "Digital", "TETRA", "Tetrapol", 
                          "DMR", "dPMR", "P25", "P25 Phase 2", "NXDN", 
                          "DSTAR", "MPT 1327", "POCSAG", "AM", "FM", "SSB", 
                          "C4FM", "Packet Radio", "Hopper", "LoRa", 
                          "Aeronautical", "Nautical", "Cellular", "Broadcast"
                        ].map((protocol) => (
                          <button
                            key={protocol}
                            type="button"
                            onClick={() => handleDropdownItemClick(protocol)}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                              backgroundColor: "transparent",
                              color: theme.colors.textPrimary,
                              border: "none",
                              borderRadius: theme.radius.xs,
                              cursor: "pointer",
                              fontSize: "0.9em",
                              textAlign: "left",
                              transition: "all 0.2s ease",
                              outline: "none",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = theme.colors.primary + "20";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            {protocol}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Tools Dropdown Menu */}
                    {tab === "Tools" && activeDropdown === "tools" && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          backgroundColor: theme.colors.surface,
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: theme.radius.sm,
                          padding: theme.spacing.xs,
                          marginTop: theme.spacing.xs,
                          zIndex: 10,
                          minWidth: "200px",
                          maxHeight: "300px",
                          overflowY: "auto",
                          boxShadow: `0 2px 8px ${theme.colors.border}50`,
                        }}
                      >
                        {[
                          "DF", "Signal Marker", "Emission Detection", "Device Control", 
                          "Channel Scanning", "Task Management", "Alert System"
                        ].map((tool) => (
                          <button
                            key={tool}
                            type="button"
                            onClick={() => handleDropdownItemClick(tool)}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                              backgroundColor: "transparent",
                              color: theme.colors.textPrimary,
                              border: "none",
                              borderRadius: theme.radius.xs,
                              cursor: "pointer",
                              fontSize: "0.9em",
                              textAlign: "left",
                              transition: "all 0.2s ease",
                              outline: "none",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = theme.colors.primary + "20";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            {tool}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Windows Dropdown Menu */}
                    {tab === "Windows" && activeDropdown === "windows" && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          backgroundColor: theme.colors.surface,
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: theme.radius.sm,
                          padding: theme.spacing.xs,
                          marginTop: theme.spacing.xs,
                          zIndex: 10,
                          minWidth: "200px",
                          maxHeight: "300px",
                          overflowY: "auto",
                          boxShadow: `0 2px 8px ${theme.colors.border}50`,
                        }}
                      >
                        {[
                          "Project", "Device", "Time Domain", "Map"
                        ].map((window) => (
                          <button
                            key={window}
                            type="button"
                            onClick={() => handleDropdownItemClick(window)}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                              backgroundColor: "transparent",
                              color: theme.colors.textPrimary,
                              border: "none",
                              borderRadius: theme.radius.xs,
                              cursor: "pointer",
                              fontSize: "0.9em",
                              textAlign: "left",
                              transition: "all 0.2s ease",
                              outline: "none",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = theme.colors.primary + "20";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            {window}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Info Dropdown Menu */}
                    {tab === "Info" && activeDropdown === "info" && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          backgroundColor: theme.colors.surface,
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: theme.radius.sm,
                          padding: theme.spacing.xs,
                          marginTop: theme.spacing.xs,
                          zIndex: 10,
                          minWidth: "200px",
                          maxHeight: "300px",
                          overflowY: "auto",
                          boxShadow: `0 2px 8px ${theme.colors.border}50`,
                        }}
                      >
                        {[
                          "About", "License info", "Technical support", "Available Licenses"
                        ].map((info) => (
                          <button
                            key={info}
                            type="button"
                            onClick={() => handleDropdownItemClick(info)}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                              backgroundColor: "transparent",
                              color: theme.colors.textPrimary,
                              border: "none",
                              borderRadius: theme.radius.xs,
                              cursor: "pointer",
                              fontSize: "0.9em",
                              textAlign: "left",
                              transition: "all 0.2s ease",
                              outline: "none",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = theme.colors.primary + "20";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            {info}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Signal Command Dropdown - Keep existing functionality */}
                    {tab === "Signal Command" && activeTab === "Signal Command" && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          backgroundColor: theme.colors.surface,
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: theme.radius.sm,
                          padding: theme.spacing.xs,
                          marginTop: theme.spacing.xs,
                          zIndex: 10,
                          minWidth: "150px",
                          boxShadow: `0 2px 8px ${theme.colors.border}50`,
                        }}
                      >
                        {["Start Device", "Modify Device", "Stop Device", "Delete Device"].map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => console.log(`${item} clicked`)}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                              backgroundColor: "transparent",
                              color: theme.colors.textPrimary,
                              border: "none",
                              borderRadius: theme.radius.xs,
                              cursor: "pointer",
                              fontSize: "0.9em",
                              textAlign: "left",
                              transition: "all 0.2s ease",
                              outline: "none",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = theme.colors.primary + "20";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {activeTab === "Device" ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "150px 1fr",
                    gap: theme.spacing.lg,
                    minHeight: 200,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gap: theme.spacing.xs,
                      borderRight: `1px solid ${theme.colors.border}`,
                      paddingRight: theme.spacing.md,
                    }}
                  >
                    {["File", "Stream Recording", "Network Stream", "IZT R3000", "IZT R5000", "DDF"].map((item) => (
                      <SidebarItem key={item} label={item} />
                    ))}
                  </div>

                  <div style={{ display: "grid", gap: theme.spacing.md, alignItems: "end" }}>
                    <div style={{ display: "grid", gap: theme.spacing.sm }}>
                      <AdaptiveInput label="Frequency" defaultValue="433.5" />
                      <AdaptiveInput label="Bandwidth" defaultValue="2.0" />
                      <AdaptiveInput label="IP Address" defaultValue="192.168.1.100" />
                      <AdaptiveInput label="Streaming port" defaultValue="8080" />
                    </div>

                    <div style={{ display: "flex", gap: theme.spacing.sm, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={handleConnect}
                        disabled={connectionStatus === "connected"}
                        style={{
                          padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                          backgroundColor:
                            connectionStatus === "connected" ? theme.colors.surfaceAlt : theme.colors.primary,
                          color:
                            connectionStatus === "connected" ? theme.colors.textSecondary : theme.colors.surface,
                          border: `1px solid ${
                            connectionStatus === "connected" ? theme.colors.border : theme.colors.primary
                          }`,
                          borderRadius: theme.radius.sm,
                          cursor: connectionStatus === "connected" ? "not-allowed" : "pointer",
                          fontSize: "0.9em",
                          fontWeight: 700,
                        }}
                      >
                        Connect
                      </button>
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        disabled={connectionStatus === "disconnected"}
                        style={{
                          padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                          backgroundColor:
                            connectionStatus === "disconnected" ? theme.colors.surfaceAlt : theme.colors.danger,
                          color:
                            connectionStatus === "disconnected" ? theme.colors.textSecondary : theme.colors.surface,
                          border: `1px solid ${
                            connectionStatus === "disconnected" ? theme.colors.border : theme.colors.danger
                          }`,
                          borderRadius: theme.radius.sm,
                          cursor: connectionStatus === "disconnected" ? "not-allowed" : "pointer",
                          fontSize: "0.9em",
                          fontWeight: 700,
                        }}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: theme.spacing.md, color: theme.colors.textSecondary }}>
                  {activeTab} content placeholder.
                </div>
              )}
            </div>
          </Card>

          <div
            style={{
              display: "grid",
              gap: theme.spacing.lg,
              gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
            }}
          >
            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                <div style={{ fontWeight: 800, color: theme.colors.primary }}>Frequency vs Power</div>
                <FrequencyPowerChart spectrum={latestSpectrum} powerRange={powerRange} />
              </div>
            </Card>
            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                <div style={{ fontWeight: 800, color: theme.colors.primary }}>Waterfall</div>
                <WaterfallChart rows={waterfallRows} powerRange={powerRange} />
              </div>
            </Card>
          </div>

          <div
            style={{
              display: "grid",
              gap: theme.spacing.lg,
              gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
            }}
          >
            {/* Protocol Statistics Card - Displays communication protocol data and metrics */}
            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                {/* Section title */}
                <h3 style={{ margin: 0 }}>Protocol Statistics</h3>
                {/* Conditional rendering based on loading state */}
                {loading ? (
                  // Show loading message while fetching data
                  <div style={{ color: theme.colors.textSecondary }}>Loading…</div>
                ) : error ? (
                  // Show error message if data fetch fails
                  <div style={{ color: theme.colors.danger }}>{error}</div>
                ) : (
                  // Display protocol statistics when data is available
                  <div style={{ display: "grid", gap: theme.spacing.sm }}>
                    {/* Map through protocol statistics and display each protocol's data */}
                    {Array.from(protocolStats.entries()).map(([protocol, stats]) => {
                      // Get theme colors for specific protocol (TETRA, DMR, P25, etc.)
                      const protocolTheme = resolveProtocolTheme(protocol, protocol);
                      return (
                        // Individual protocol statistics card
                        <div
                          key={protocol}
                          style={{
                            padding: theme.spacing.md,
                            border: `1px solid ${protocolTheme.borderColor}`,
                            borderRadius: theme.radius.md,
                            background: protocolTheme.background,
                          }}
                        >
                          {/* Protocol name with theme-specific styling */}
                          <div
                            style={{
                              fontWeight: 800,
                              color: protocolTheme.textColor,
                              marginBottom: theme.spacing.xs,
                            }}
                          >
                            {protocolTheme.label}
                          </div>
                          {/* Protocol metrics display */}
                          <div style={{ fontSize: 14, color: theme.colors.textSecondary }}>
                            <div>Messages: {stats.count}</div>
                            <div>Data: {formatBytes(stats.bytes)}</div>
                            <div>Duration: {formatDuration(stats.duration)}</div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Show message when no protocol data is available */}
                    {protocolStats.size === 0 && (
                      <div style={{ padding: theme.spacing.md, color: theme.colors.textSecondary }}>
                        No protocol data available.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Recent Messages Card - Displays a table of recent TCP communication messages */}
            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                {/* Section title */}
                <h3 style={{ margin: 0 }}>Recent Messages</h3>
                {/* Scrollable container for the messages table */}
                <div style={{ overflowX: "auto" }}>
                  {/* Table structure for displaying message data */}
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    {/* Table header with column titles */}
                    <thead>
                      <tr>
                        {/* Time column header */}
                        <th
                          style={{
                            textAlign: "left",
                            padding: theme.spacing.sm,
                            borderBottom: `1px solid ${theme.colors.border}`,
                          }}
                        >
                          Time
                        </th>
                        {/* Protocol column header */}
                        <th
                          style={{
                            textAlign: "left",
                            padding: theme.spacing.sm,
                            borderBottom: `1px solid ${theme.colors.border}`,
                          }}
                        >
                          Protocol
                        </th>
                        {/* Size column header */}
                        <th
                          style={{
                            textAlign: "left",
                            padding: theme.spacing.sm,
                            borderBottom: `1px solid ${theme.colors.border}`,
                          }}
                        >
                          Size
                        </th>
                        {/* Preview column header */}
                        <th
                          style={{
                            textAlign: "left",
                            padding: theme.spacing.sm,
                            borderBottom: `1px solid ${theme.colors.border}`,
                          }}
                        >
                          Preview
                        </th>
                      </tr>
                    </thead>
                    {/* Table body with message data rows */}
                    <tbody>
                      {/* Map through recent messages and create table rows */}
                      {recentMessages.map((message, index) => {
                        // Normalize message fields for consistent access
                        const normalized = buildNormalizedFieldMap(message);
                        // Get theme colors for the message's protocol
                        const protocolTheme = resolveProtocolTheme(
                          typeof normalized.standard === "string" ? normalized.standard : null,
                          message.protocol ?? null,
                        );
                        return (
                          // Individual message row
                          <tr key={`${message.received_at ?? "na"}-${index}`}>
                            {/* Time column - displays formatted timestamp */}
                            <td
                              style={{
                                padding: theme.spacing.sm,
                                borderBottom: `1px solid ${theme.colors.border}`,
                              }}
                            >
                              {message.received_at ? new Date(message.received_at).toLocaleTimeString() : "N/A"}
                            </td>
                            {/* Protocol column - displays protocol type with themed styling */}
                            <td
                              style={{
                                padding: theme.spacing.sm,
                                borderBottom: `1px solid ${theme.colors.border}`,
                              }}
                            >
                              {/* Protocol badge with theme-specific colors */}
                              <span
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: 999,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  background: protocolTheme.background,
                                  color: protocolTheme.textColor,
                                  border: `1px solid ${protocolTheme.borderColor}`,
                                }}
                              >
                                {protocolTheme.label}
                              </span>
                            </td>
                            {/* Size column - displays message size in formatted bytes */}
                            <td
                              style={{
                                padding: theme.spacing.sm,
                                borderBottom: `1px solid ${theme.colors.border}`,
                              }}
                            >
                              {formatBytes(message.byte_length)}
                            </td>
                            {/* Preview column - displays ASCII preview of message content */}
                            <td
                              style={{
                                padding: theme.spacing.sm,
                                borderBottom: `1px solid ${theme.colors.border}`,
                                color: theme.colors.textSecondary,
                                fontFamily:
                                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
                                fontSize: 12,
                              }}
                            >
                              {message.ascii_preview ?? "-"}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Show message when no recent messages are available */}
                      {recentMessages.length === 0 && (
                        <tr>
                          <td style={{ padding: theme.spacing.sm }} colSpan={4}>
                            No messages available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <div style={{ display: "grid", gap: theme.spacing.lg, padding: theme.spacing.md }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: `1px solid ${theme.colors.border}`,
                  paddingBottom: theme.spacing.sm,
                }}
              >
                <h4 style={{ margin: 0, color: theme.colors.primary, fontSize: "1.1em", fontWeight: 800 }}>
                  Signal Streamer (Port 9999)
                </h4>
                <div style={{ display: "flex", gap: theme.spacing.sm }}>
                  <button
                    type="button"
                    onClick={handleStartStreamer}
                    disabled={isStreamerActive}
                    style={{
                      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                      backgroundColor: isStreamerActive ? theme.colors.surfaceAlt : theme.colors.primary,
                      color: isStreamerActive ? theme.colors.textSecondary : theme.colors.surface,
                      border: `1px solid ${isStreamerActive ? theme.colors.border : theme.colors.primary}`,
                      borderRadius: theme.radius.sm,
                      cursor: isStreamerActive ? "not-allowed" : "pointer",
                      fontSize: "0.9em",
                      fontWeight: 800,
                      transition: "all 0.2s ease",
                    }}
                  >
                    {isStreamerActive ? "⏸ Streamer Active" : "▶ Start Streamer"}
                  </button>
                  <button
                    type="button"
                    onClick={handleStopStreamer}
                    disabled={!isStreamerActive}
                    style={{
                      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                      backgroundColor: !isStreamerActive ? theme.colors.surfaceAlt : theme.colors.danger,
                      color: !isStreamerActive ? theme.colors.textSecondary : theme.colors.surface,
                      border: `1px solid ${!isStreamerActive ? theme.colors.border : theme.colors.danger}`,
                      borderRadius: theme.radius.sm,
                      cursor: !isStreamerActive ? "not-allowed" : "pointer",
                      fontSize: "0.9em",
                      fontWeight: 800,
                      transition: "all 0.2s ease",
                    }}
                  >
                    {isStreamerActive ? "⏹ Stop Streamer" : "⏹ Inactive"}
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: theme.spacing.sm,
                  padding: theme.spacing.sm,
                  backgroundColor: isStreamerActive ? `${theme.colors.primary}10` : theme.colors.surfaceAlt,
                  borderRadius: theme.radius.sm,
                  border: `1px solid ${isStreamerActive ? theme.colors.primary : theme.colors.border}`,
                }}
              >
                <MetricCard label="Status" value={isStreamerActive ? "Active" : "Inactive"} />
                <MetricCard label="Packets" value={streamStats.packetsReceived} />
                <MetricCard label="Data Size" value={formatBytes(streamStats.totalBytes)} />
                <MetricCard
                  label="Avg Frequency"
                  value={`${(streamStats.averageFrequency / 1e9).toFixed(3)} GHz`}
                />
              </div>

              {streamError && (
                <div
                  style={{
                    padding: theme.spacing.sm,
                    backgroundColor: `${theme.colors.danger}10`,
                    border: `1px solid ${theme.colors.danger}`,
                    borderRadius: theme.radius.sm,
                    color: theme.colors.danger,
                    fontSize: "0.9em",
                  }}
                >
                  Error: {streamError}
                </div>
              )}

              {streamData.length > 0 && (
                <>
                  <div
                    style={{
                      padding: theme.spacing.sm,
                      backgroundColor: theme.colors.background,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radius.sm,
                      maxHeight: 360,
                      overflow: "auto",
                    }}
                  >
                    <h5 style={{ margin: `0 0 ${theme.spacing.sm} 0`, color: theme.colors.primary }}>
                      Stream Packets (latest {Math.min(streamData.length, STREAM_TABLE_ROWS)})
                    </h5>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: 10, borderBottom: `1px solid ${theme.colors.border}` }}>
                            Time
                          </th>
                          <th style={{ textAlign: "left", padding: 10, borderBottom: `1px solid ${theme.colors.border}` }}>
                            Center Freq
                          </th>
                          <th style={{ textAlign: "left", padding: 10, borderBottom: `1px solid ${theme.colors.border}` }}>
                            Modulation
                          </th>
                          <th style={{ textAlign: "left", padding: 10, borderBottom: `1px solid ${theme.colors.border}` }}>
                            Noise
                          </th>
                          {streamTableColumns.map((hz) => (
                            <th
                              key={hz}
                              style={{ textAlign: "left", padding: 10, borderBottom: `1px solid ${theme.colors.border}` }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  selectSpectrogram(hz);
                                }}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  cursor: "pointer",
                                  color: theme.colors.primary,
                                  fontWeight: 900,
                                }}
                                title="Click to plot spectrogram for this frequency"
                              >
                                {hz} Hz
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {streamData
                          .slice(-STREAM_TABLE_ROWS)
                          .slice()
                          .reverse()
                          .map((packet) => {
                            const meta = packet.metadata;
                            const ts = getNumber(meta.timestamp, packet.receivedAt);
                            const center = getNumber(meta.center_frequency, 0);
                            const modulation = typeof meta.modulation === "string" ? meta.modulation : "-";
                            const noise = getNumber(meta.noise_level, NaN);
                            const isSelected = selectedPacket?.receivedAt === packet.receivedAt;

                            const displayTimeMs = ts > 1e12 ? ts : ts * 1000;

                            return (
                              <tr
                                key={packet.receivedAt}
                                onClick={() => handlePacketClick(packet)}
                                style={{
                                  background: isSelected ? `${theme.colors.primary}15` : "transparent",
                                  cursor: "pointer",
                                }}
                              >
                                <td style={{ padding: 10, borderBottom: `1px solid ${theme.colors.border}` }}>
                                  {new Date(displayTimeMs).toLocaleTimeString()}
                                  {isSelected ? (
                                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 900, color: theme.colors.primary }}>
                                      ✓ SELECTED
                                    </span>
                                  ) : null}
                                </td>
                                <td style={{ padding: 10, borderBottom: `1px solid ${theme.colors.border}` }}>
                                  {center ? `${(center / 1e9).toFixed(6)} GHz` : "-"}
                                </td>
                                <td style={{ padding: 10, borderBottom: `1px solid ${theme.colors.border}` }}>
                                  {modulation}
                                </td>
                                <td style={{ padding: 10, borderBottom: `1px solid ${theme.colors.border}` }}>
                                  {Number.isFinite(noise) ? noise.toFixed(3) : "-"}
                                </td>
                                {streamTableColumns.map((hz) => (
                                  <td key={`${packet.receivedAt}-${hz}`} style={{ padding: 10, borderBottom: `1px solid ${theme.colors.border}` }}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        selectSpectrogram(hz);
                                      }}
                                      style={{
                                        border: `1px solid ${theme.colors.border}`,
                                        background: theme.colors.surfaceAlt,
                                        color: theme.colors.textPrimary,
                                        borderRadius: 999,
                                        padding: "2px 8px",
                                        cursor: "pointer",
                                        fontWeight: 800,
                                      }}
                                    >
                                      Plot
                                    </button>
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                      </tbody>
                      </table>
                    </div>
                  </div>

                  {selectedSpectrogramHz !== null && (
                    <div
                      style={{
                        marginTop: theme.spacing.md,
                        padding: theme.spacing.sm,
                        backgroundColor: theme.colors.background,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.radius.sm,
                        display: "grid",
                        gap: theme.spacing.md,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ fontWeight: 800, color: theme.colors.primary }}>
                          Spectrogram (band around {selectedSpectrogramHz} Hz)
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSpectrogramHz(null);
                            selectedSpectrogramHzRef.current = null;
                            setSpectrogramRows([]);
                          }}
                          style={{
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: theme.radius.md,
                            background: theme.colors.surfaceAlt,
                            color: theme.colors.textPrimary,
                            padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          Clear
                        </button>
                      </div>
                      <WaterfallChart rows={spectrogramRows} powerRange={powerRange} />
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>
      </PageContainer>
    </AppLayout>
  );
}

