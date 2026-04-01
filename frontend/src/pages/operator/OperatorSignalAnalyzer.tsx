import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";
import {
  connectTcpClient,
  disconnectTcpClient,
  getTcpClientStatus,
  getTcpListenerHealth,
  type TcpClientStatus,
  type TcpListenerHealth,
} from "../../api/tcpListener";
import { useTheme } from "../../context/ThemeContext";

// Reusable Input Field Component with Dynamic Contrast
const AdaptiveInput: React.FC<{
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  minLength?: number;
  maxLength?: number;
  width?: string;
  textAlign?: 'left' | 'center' | 'right';
  label?: string;
  labelWidth?: string;
}> = ({ 
  value, 
  defaultValue, 
  placeholder, 
  type = "text", 
  minLength, 
  maxLength, 
  width = "100%", 
  textAlign = "left",
  label,
  labelWidth = "120px"
}) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const inputStyle = useMemo(() => ({
    padding: theme.spacing.xs,
    border: `1px solid ${isFocused ? theme.colors.primary : theme.colors.border}`,
    borderRadius: theme.radius.sm,
    background: theme.colors.surface,
    color: theme.colors.textPrimary, // High contrast text
    width,
    textAlign,
    fontSize: "0.9em",
    outline: "none",
    transition: "all 0.2s ease",
    boxShadow: isFocused ? `0 0 0 2px ${theme.colors.primary}20` : "none",
    caretColor: theme.colors.textPrimary, // Visible caret
  }), [theme, isFocused, width, textAlign]);

  const labelStyle = useMemo(() => ({
    minWidth: labelWidth,
    fontSize: "0.9em",
    color: theme.colors.textPrimary, // High contrast labels
    fontWeight: "500"
  }), [theme, labelWidth]);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  if (label) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.md }}>
        <label style={labelStyle}>
          {label}:
        </label>
        <input
          type={type}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          minLength={minLength}
          maxLength={maxLength}
          style={inputStyle}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </div>
    );
  }

  return (
    <input
      type={type}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      minLength={minLength}
      maxLength={maxLength}
      style={inputStyle}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
};

// Reusable Sidebar Item Component with Dynamic Contrast
const SidebarItem: React.FC<{
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}> = ({ label, isActive = false, onClick }) => {
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const buttonStyle = useMemo(() => ({
    padding: theme.spacing.sm,
    backgroundColor: isHovered || isFocused ? theme.colors.surface : 'transparent',
    color: isHovered || isFocused ? theme.colors.primary : theme.colors.textPrimary,
    border: 'none',
    borderRadius: theme.radius.sm,
    cursor: "pointer",
    textAlign: "left" as const,
    fontSize: "0.9em",
    fontWeight: "500",
    transition: "all 0.2s ease",
    outline: isFocused ? `2px solid ${theme.colors.primary}` : "none",
    outlineOffset: "2px",
    transform: isHovered ? "translateX(2px)" : "translateX(0)",
    textShadow: "0 0 1px rgba(255,255,255,0.1)"
  }), [theme, isHovered, isFocused]);

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);
  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  return (
    <button
      type="button"
      onClick={onClick}
      style={buttonStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {label}
    </button>
  );
};

// Reusable Form Label Component
const FormLabel: React.FC<{
  children: React.ReactNode;
  color?: string;
  fontWeight?: string;
}> = ({ children, color, fontWeight = "normal" }) => {
  const { theme } = useTheme();

  const labelStyle = useMemo(() => ({
    color: color || theme.colors.textPrimary,
    fontWeight
  }), [theme, color, fontWeight]);

  return <span style={labelStyle}>{children}</span>;
};

const REFRESH_MS = 5000;

// Real-Time Spectrum Analyzer Components
interface SpectrumDataPoint {
  frequency: number;
  power: number;
}

interface SignalData {
  frequencies: number[];
  power: number[];
  waterfall: number[][];
}

// Shared configuration for both graphs
const SPECTRUM_CONFIG = {
  frequencyMin: 433,    // MHz
  frequencyMax: 435,    // MHz  
  powerMin: -120,        // dBm
  powerMax: -20,         // dBm
  waterfallRows: 200,     // Time history
  frequencyPoints: 400,   // High resolution
  updateRate: 50,         // ms between updates
};

// Shared Bandwidth Scale Component
const BandwidthScale: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw frequency scale
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    const { frequencyMin, frequencyMax } = SPECTRUM_CONFIG;
    const bandwidth = frequencyMax - frequencyMin;

    // Draw frequency labels
    ctx.fillText(`${frequencyMin} MHz`, 30, height - 5);
    ctx.fillText(`${frequencyMin + bandwidth/2} MHz`, width / 2, height - 5);
    ctx.fillText(`${frequencyMax} MHz`, width - 40, height - 5);

    // Draw tick marks
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= 10; i++) {
      const x = 30 + ((width - 40) / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 3);
      ctx.stroke();
    }

  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block'
      }}
    />
  );
};

const generateSignalData = (): SignalData => {
  const { frequencyMin, frequencyMax, frequencyPoints } = SPECTRUM_CONFIG;
  const frequencies = Array.from({length: frequencyPoints}, (_, i) => 
    frequencyMin + (i / (frequencyPoints - 1)) * (frequencyMax - frequencyMin)
  );
  
  const power = frequencies.map((freq, i) => {
    // Simulate realistic RF signals
    let signal = -85 + Math.random() * 8; // Noise floor
    
    // Add multiple signal sources
    const signal1 = Math.sin(Date.now() * 0.0008 + freq * 8) * 25;
    const signal2 = Math.cos(Date.now() * 0.0005 + freq * 12) * 20;
    const signal3 = Math.sin(Date.now() * 0.0012 + freq * 5) * 15;
    
    // Create signal peaks at specific frequencies
    if (Math.abs(freq - 433.5) < 0.1) {
      signal += signal1 * 1.5;
    }
    if (Math.abs(freq - 434.2) < 0.15) {
      signal += signal2 * 1.2;
    }
    if (Math.abs(freq - 434.8) < 0.08) {
      signal += signal3 * 0.8;
    }
    
    return signal;
  });
  
  // Generate waterfall data (time history)
  const waterfall = Array.from({length: SPECTRUM_CONFIG.waterfallRows}, (_, time) => 
    frequencies.map((freq, idx) => {
      const basePower = power[idx];
      // Add time variation for realistic waterfall
      const timeVariation = Math.sin(Date.now() * 0.0003 + time * 0.1) * 5;
      return basePower + timeVariation + (Math.random() - 0.5) * 3;
    })
  );
  
  return { frequencies, power, waterfall };
};

const FrequencyPowerChart: React.FC = () => {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Handle container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height - 30 // Reserve space for bandwidth scale
        });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastUpdateTime = 0;

    const animate = (timestamp: number) => {
      // Throttle updates to configured rate
      if (timestamp - lastUpdateTime < SPECTRUM_CONFIG.updateRate) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      lastUpdateTime = timestamp;

      // Set canvas to actual pixel dimensions
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;

      // Generate real-time data
      const data = generateSignalData();

      // Clear canvas
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      
      // Horizontal grid lines (power scale)
      for (let i = 0; i <= 8; i++) {
        const y = (canvas.height / 8) * i;
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(canvas.width - 10, y);
        ctx.stroke();
        
        // Power labels
        if (i % 2 === 0) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px monospace';
          const power = SPECTRUM_CONFIG.powerMin + ((SPECTRUM_CONFIG.powerMax - SPECTRUM_CONFIG.powerMin) * (1 - i/8));
          ctx.fillText(`${power} dBm`, 2, y + 3);
        }
      }

      // Vertical grid lines (frequency scale)
      for (let i = 0; i <= 10; i++) {
        const x = 40 + ((canvas.width - 50) / 10) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Draw signal line (FULL WIDTH)
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.beginPath();

      data.power.forEach((power, index) => {
        const x = 40 + (index / (data.power.length - 1)) * (canvas.width - 50);
        const y = ((power - SPECTRUM_CONFIG.powerMin) / (SPECTRUM_CONFIG.powerMax - SPECTRUM_CONFIG.powerMin)) * canvas.height;
        
        if (index === 0) {
          ctx.moveTo(x, canvas.height - y);
        } else {
          ctx.lineTo(x, canvas.height - y);
        }
      });

      ctx.stroke();

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dimensions, theme]);

  return (
    <div style={{ width: '100%', height: '400px', position: 'relative' }}>
      <div 
        ref={containerRef}
        style={{ 
          width: '100%', 
          height: 'calc(100% - 30px)', // Reserve space for bandwidth scale
          position: 'relative'
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            background: '#0a0a0a',
            borderRadius: theme.radius.sm,
            border: `1px solid ${theme.colors.border}`,
            display: 'block'
          }}
        />
      </div>
      <div style={{ height: '30px', width: '100%' }}>
        <BandwidthScale width={dimensions.width} height={30} />
      </div>
    </div>
  );
};

const WaterfallChart: React.FC = () => {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const containerRef = useRef<HTMLDivElement>(null);
  const waterfallBufferRef = useRef<number[][]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Handle container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height - 30 // Reserve space for bandwidth scale
        });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Professional RF color mapping (matching reference image)
  const mapPowerToColor = (power: number): [number, number, number] => {
    // Map -120 to -40 dBm range to colors
    const normalizedPower = Math.max(0, Math.min(1, (power + 120) / 80));
    
    let r, g, b;
    if (normalizedPower < 0.15) {
      // Deep blue to dark blue
      const t = normalizedPower / 0.15;
      r = 0;
      g = 0;
      b = Math.floor(10 + t * 40);
    } else if (normalizedPower < 0.3) {
      // Dark blue to blue
      const t = (normalizedPower - 0.15) / 0.15;
      r = 0;
      g = 0;
      b = Math.floor(50 + t * 100);
    } else if (normalizedPower < 0.5) {
      // Blue to cyan
      const t = (normalizedPower - 0.3) / 0.2;
      r = 0;
      g = Math.floor(t * 150);
      b = Math.floor(150 + t * 105);
    } else if (normalizedPower < 0.7) {
      // Cyan to yellow
      const t = (normalizedPower - 0.5) / 0.2;
      r = Math.floor(t * 255);
      g = Math.floor(150 + t * 105);
      b = Math.floor(255 - t * 255);
    } else {
      // Yellow to red
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

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize waterfall buffer with proper dimensions
    const initializeBuffer = () => {
      const buffer: number[][] = [];
      for (let y = 0; y < dimensions.height; y++) {
        const row: number[] = [];
        for (let x = 0; x < dimensions.width; x++) {
          // Initialize with noise floor
          row.push(-90 + Math.random() * 5);
        }
        buffer.push(row);
      }
      waterfallBufferRef.current = buffer;
    };

    // Initialize buffer on first run
    if (waterfallBufferRef.current.length === 0) {
      initializeBuffer();
    }

    let lastUpdateTime = 0;

    const animate = (timestamp: number) => {
      // Throttle updates to configured rate
      if (timestamp - lastUpdateTime < SPECTRUM_CONFIG.updateRate) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      lastUpdateTime = timestamp;

      // Set canvas to actual pixel dimensions
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;

      // Generate real-time signal data
      const data = generateSignalData();
      
      // Create full-width frequency data with enhanced signal spread
      const newRow: number[] = [];
      
      for (let x = 0; x < dimensions.width; x++) {
        const dataIndex = Math.floor((x / dimensions.width) * data.power.length);
        let power = data.power[dataIndex];
        
        // Create strong signal bands at specific frequencies
        const freqPosition = x / dimensions.width;
        let signalBoost = 0;
        
        // Signal at 433.5 MHz (left side)
        if (Math.abs(freqPosition - 0.25) < 0.05) {
          signalBoost += Math.sin(Date.now() * 0.001) * 20 + 15;
        }
        
        // Signal at 434.2 MHz (center)
        if (Math.abs(freqPosition - 0.6) < 0.08) {
          signalBoost += Math.cos(Date.now() * 0.0008) * 18 + 20;
        }
        
        // Signal at 434.8 MHz (right side)
        if (Math.abs(freqPosition - 0.9) < 0.04) {
          signalBoost += Math.sin(Date.now() * 0.0012) * 15 + 25;
        }
        
        power += signalBoost;
        
        // Add noise for realism
        power += (Math.random() - 0.5) * 2;
        
        newRow.push(power);
      }

      // Apply enhanced smoothing for continuous signal bands
      const smoothedRow: number[] = [];
      for (let x = 0; x < dimensions.width; x++) {
        let sum = 0;
        let count = 0;
        
        // Wider smoothing window for better signal continuity
        for (let i = -3; i <= 3; i++) {
          const idx = x + i;
          if (idx >= 0 && idx < newRow.length) {
            sum += newRow[idx];
            count++;
          }
        }
        
        smoothedRow.push(sum / count);
      }

      // Shift buffer up and add new smoothed row at bottom
      waterfallBufferRef.current.shift();
      waterfallBufferRef.current.push(smoothedRow);

      // Create full-resolution image data
      const imageData = ctx.createImageData(dimensions.width, dimensions.height);
      const buffer = waterfallBufferRef.current;

      // Apply temporal smoothing for continuous appearance
      for (let y = 0; y < dimensions.height; y++) {
        for (let x = 0; x < dimensions.width; x++) {
          let intensity = buffer[y][x];
          
          // Apply temporal smoothing with previous frame
          if (y > 0) {
            intensity = intensity * 0.9 + buffer[y - 1][x] * 0.1;
          }
          
          // Map power to professional RF colors
          const [r, g, b] = mapPowerToColor(intensity);
          const index = (y * dimensions.width + x) * 4;
          
          imageData.data[index] = r;
          imageData.data[index + 1] = g;
          imageData.data[index + 2] = b;
          imageData.data[index + 3] = 255;
        }
      }

      // Draw full-resolution waterfall
      ctx.putImageData(imageData, 0, 0);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dimensions, theme]);

  return (
    <div style={{ width: '100%', height: '400px', position: 'relative' }}>
      <div 
        ref={containerRef}
        style={{ 
          width: '100%', 
          height: 'calc(100% - 30px)', // Reserve space for bandwidth scale
          position: 'relative'
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            background: '#000000', // Pure black background like reference image
            borderRadius: theme.radius.sm,
            border: `1px solid ${theme.colors.border}`,
            display: 'block'
          }}
        />
      </div>
      <div style={{ height: '30px', width: '100%' }}>
        <BandwidthScale width={dimensions.width} height={30} />
      </div>
    </div>
  );
};

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
  const key = (standard ?? protocol)?.toLowerCase() as ProtocolTheme["key"];
  return PROTOCOL_THEME_MAP[key] ?? PROTOCOL_THEME_MAP.unknown;
};

type NormalizedFieldMap = Record<string, string | number | boolean | null>;

const buildNormalizedFieldMap = (
  message: Record<string, unknown>,
): NormalizedFieldMap => {
  const normalized: NormalizedFieldMap = {};

  for (const [key, value] of Object.entries(message)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "_");
    normalized[normalizedKey] = value;
  }

  return normalized;
};

type RecentMessage = TcpClientStatus["recent_messages"][number];

type SignalAnalyzerMetadata = {
  talkgroup: string | null;
  timeslot: string | null;
  lcn: string | null;
  nac: string | null;
  source: string | null;
  destination: string | null;
  service_type: string | null;
  encryption: string | null;
  emergency: boolean;
  priority: number | null;
  aliv: boolean;
};

const getSignalAnalyzerMetadataFromMessage = (
  message: RecentMessage,
): SignalAnalyzerMetadata => {
  const normalized = buildNormalizedFieldMap(message);

  return {
    talkgroup: normalized.talkgroup as string | null,
    timeslot: normalized.timeslot as string | null,
    lcn: normalized.lcn as string | null,
    nac: normalized.nac as string | null,
    source: normalized.source as string | null,
    destination: normalized.destination as string | null,
    service_type: normalized.service_type as string | null,
    encryption: normalized.encryption as string | null,
    emergency: Boolean(normalized.emergency),
    priority: normalized.priority as number | null,
    aliv: Boolean(normalized.aliv),
  };
};

const formatBytes = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined) return "0 B";
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
  if (seconds === null || seconds === undefined) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

export default function OperatorSignalAnalyzerPage(): React.FC {
  const { theme } = useTheme();
  const [tcpClientStatus, setTcpClientStatus] = useState<TcpClientStatus | null>(
    null
  );
  const [tcpListenerHealth, setTcpListenerHealth] =
    useState<TcpListenerHealth | null>(null);
  const [activeTab, setActiveTab] = useState('Device');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setConnectionStatus('connected');
  }, []);

  const handleDisconnect = useCallback(async () => {
    setConnectionStatus('disconnected');
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [statusResponse, healthResponse] = await Promise.all([
        getTcpClientStatus(),
        getTcpListenerHealth(),
      ]);

      setTcpClientStatus(statusResponse);
      setTcpListenerHealth(healthResponse);
    } catch (err) {
      console.error("Failed to fetch TCP client data:", err);
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.detail ?? err.message
          : "Failed to fetch TCP client data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  const protocolStats = useMemo(() => {
    const stats = new Map<string, { count: number; bytes: number; duration: number }>();

    if (!tcpClientStatus?.recent_messages) return stats;

    for (const message of tcpClientStatus.recent_messages) {
      const protocol = message.protocol ?? "unknown";
      const existing = stats.get(protocol) ?? {
        count: 0,
        bytes: 0,
        duration: 0,
      };

      existing.count += 1;
      if (message.received_at) {
        existing.bytes += message.bytes ?? 0;
        existing.duration += message.duration_seconds ?? 0;
      }

      stats.set(protocol, existing);
    }

    return stats;
  }, [tcpClientStatus?.recent_messages]);

  const recentMessages = useMemo(() => {
    if (!tcpClientStatus?.recent_messages) return [];
    return tcpClientStatus.recent_messages.slice(0, 20);
  }, [tcpClientStatus?.recent_messages]);

  return (
    <AppLayout>
      <PageContainer title="SIGNAL ANALYZER">
        <div style={{ display: "grid", gap: theme.spacing.lg }}>
          {/* Status Overview Cards */}
          <div
            style={{
              display: "grid",
              gap: theme.spacing.lg,
              gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
            }}
          >
            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                <div style={{ fontWeight: 700, color: theme.colors.primary }}>Operation Mode</div>
                <div style={{ display: "grid", gap: theme.spacing.sm, justifyItems: "start" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm, cursor: "pointer" }}>
                    <input type="radio" name="operationMode" checked readOnly />
                    <FormLabel color={theme.colors.textPrimary}>Local mode</FormLabel>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm, cursor: "pointer" }}>
                    <input type="radio" name="operationMode" />
                    <FormLabel color={theme.colors.textPrimary}>Server mode</FormLabel>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm, cursor: "pointer" }}>
                    <input type="radio" name="operationMode" />
                    <FormLabel color={theme.colors.textPrimary}>Remote mode</FormLabel>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", marginLeft: theme.spacing.xl }}>
                    <FormLabel color={theme.colors.textPrimary} fontWeight="500">Port</FormLabel>
                    <AdaptiveInput
                      defaultValue="12345"
                      minLength={5}
                      maxLength={6}
                      width="80px"
                      textAlign="center"
                    />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm, cursor: "pointer" }}>
                    <input type="radio" name="operationMode" />
                    <span>Remote mode</span>
                  </label>
                </div>
              </div>
            </Card>
            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                <div style={{ fontWeight: 700, color: theme.colors.primary }}>License options</div>
                <div style={{ display: "grid", gap: theme.spacing.sm }}>
                  <label style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm, cursor: "pointer" }}>
                    <input type="radio" name="licenseOptions" checked readOnly />
                    <FormLabel color={theme.colors.textPrimary}>Local</FormLabel>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm, cursor: "pointer" }}>
                    <input type="radio" name="licenseOptions" />
                    <FormLabel color={theme.colors.textPrimary}>LAN</FormLabel>
                  </label>
                  
                  <div style={{ display: "flex", alignItems: "center", marginLeft: theme.spacing.xl }}>
                    <FormLabel color={theme.colors.textPrimary} fontWeight="500">Server</FormLabel>
                    <AdaptiveInput
                      defaultValue="localhost"
                      width="120px"
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", marginLeft: theme.spacing.xl }}>
                    <FormLabel color={theme.colors.textPrimary} fontWeight="500">Dongle</FormLabel>
                    <AdaptiveInput
                      defaultValue="123#abc"
                      minLength={1}
                      maxLength={5}
                      width="80px"
                      textAlign="center"
                    />
                  </div>      
                </div>
              </div>
            </Card>
          </div>

          {/* Device Connection Control Row */}
          <Card>
            <div style={{ display: "grid", gap: theme.spacing.md }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>Device Connection Control</h3>
              </div>
              
              {/* Tabs Bar */}
              <div style={{ 
                display: "flex", 
                gap: theme.spacing.xs, 
                borderBottom: `1px solid ${theme.colors.border}`,
                paddingBottom: theme.spacing.xs
              }}>
                {['Device', 'Protocols', 'Tools', 'Windows', 'Settings', 'Projects', 'Info'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      backgroundColor: activeTab === tab ? theme.colors.primary : 'transparent',
                      color: activeTab === tab ? theme.colors.text : theme.colors.textSecondary,
                      border: activeTab === tab ? `1px solid ${theme.colors.primary}` : `1px solid transparent`,
                      borderRadius: theme.radius.sm,
                      cursor: "pointer",
                      fontSize: "0.9em",
                      transition: "all 0.2s ease",
                      outline: "none"
                    }}
                    onMouseEnter={(e) => {
                      if (activeTab !== tab) {
                        e.currentTarget.style.backgroundColor = theme.colors.surface;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeTab !== tab) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.outline = `2px solid ${theme.colors.primary}`;
                      e.currentTarget.style.outlineOffset = "2px";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.outline = "none";
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === 'Device' && (
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "150px 1fr", 
                gap: theme.spacing.lg,
                minHeight: "200px"
              }}>
                {/* Left Sidebar */}
                <div style={{ 
                  display: "grid", 
                  gap: theme.spacing.xs,
                  borderRight: `1px solid ${theme.colors.border}`,
                  paddingRight: theme.spacing.md
                }}>
                  {['File', 'Stream Recording', 'Network Stream', 'IZT R3000', 'IZT R5000', 'DDF'].map((item) => (
                    <SidebarItem
                      key={item}
                      label={item}
                    />
                  ))}
                </div>

                {/* Right Form Panel */}
                <div style={{ 
                  display: "grid", 
                  gap: theme.spacing.md,
                  alignItems: "end"
                }}>
                  {/* Form Fields */}
                  <div style={{ display: "grid", gap: theme.spacing.sm }}>
                    <AdaptiveInput
                    label="Frequency"
                    defaultValue="433.5"
                  />

                  <AdaptiveInput
                    label="Bandwidth"
                    defaultValue="2.0"
                  />

                  <AdaptiveInput
                    label="IP Address"
                    defaultValue="192.168.1.100"
                  />

                  <AdaptiveInput
                    label="Streaming port"
                    defaultValue="8080"
                  />
                  </div>

                  {/* Action Buttons */}
                  <div style={{ 
                    display: "flex", 
                    gap: theme.spacing.sm, 
                    justifyContent: "flex-end",
                    marginTop: theme.spacing.md
                  }}>
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={connectionStatus === 'connected'}
                      style={{
                        padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                        backgroundColor: connectionStatus === 'connected' ? theme.colors.surface : theme.colors.primary,
                        color: connectionStatus === 'connected' ? theme.colors.textSecondary : theme.colors.text,
                        border: `1px solid ${connectionStatus === 'connected' ? theme.colors.border : theme.colors.primary}`,
                        borderRadius: theme.radius.sm,
                        cursor: connectionStatus === 'connected' ? "not-allowed" : "pointer",
                        fontSize: "0.9em",
                        fontWeight: "500",
                        outline: "none"
                      }}
                      onFocus={(e: any) => {
                        if (connectionStatus !== 'connected') {
                          e.currentTarget.style.outline = `2px solid ${theme.colors.primary}`;
                          e.currentTarget.style.outlineOffset = "2px";
                        }
                      }}
                      onBlur={(e: any) => {
                        e.currentTarget.style.outline = "none";
                      }}
                    >
                      Connect
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      disabled={connectionStatus === 'disconnected'}
                      style={{
                        padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                        backgroundColor: connectionStatus === 'disconnected' ? theme.colors.surface : theme.colors.error,
                        color: connectionStatus === 'disconnected' ? theme.colors.textSecondary : theme.colors.text,
                        border: `1px solid ${connectionStatus === 'disconnected' ? theme.colors.border : theme.colors.error}`,
                        borderRadius: theme.radius.sm,
                        cursor: connectionStatus === 'disconnected' ? "not-allowed" : "pointer",
                        fontSize: "0.9em",
                        fontWeight: "500",
                        outline: "none"
                      }}
                      onFocus={(e: any) => {
                        if (connectionStatus !== 'disconnected') {
                          e.currentTarget.style.outline = `2px solid ${theme.colors.error}`;
                          e.currentTarget.style.outlineOffset = "2px";
                        }
                      }}
                      onBlur={(e: any) => {
                        e.currentTarget.style.outline = "none";
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>
              )}

              {activeTab === 'Protocols' && (
                <div style={{ padding: theme.spacing.md, color: theme.colors.text }}>
                  <h4 style={{ margin: 0, marginBottom: theme.spacing.md }}>Protocols Configuration</h4>
                  <p>Protocol settings and configuration options will be displayed here.</p>
                </div>
              )}

              {activeTab === 'Tools' && (
                <div style={{ padding: theme.spacing.md, color: theme.colors.text }}>
                  <h4 style={{ margin: 0, marginBottom: theme.spacing.md }}>Tools</h4>
                  <p>Analysis tools and utilities will be displayed here.</p>
                </div>
              )}

              {activeTab === 'Windows' && (
                <div style={{ padding: theme.spacing.md, color: theme.colors.text }}>
                  <h4 style={{ margin: 0, marginBottom: theme.spacing.md }}>Windows</h4>
                  <p>Window management and layout options will be displayed here.</p>
                </div>
              )}

              {activeTab === 'Settings' && (
                <div style={{ padding: theme.spacing.md, color: theme.colors.text }}>
                  <h4 style={{ margin: 0, marginBottom: theme.spacing.md }}>Settings</h4>
                  <p>Application settings and preferences will be displayed here.</p>
                </div>
              )}

              {activeTab === 'Projects' && (
                <div style={{ padding: theme.spacing.md, color: theme.colors.text }}>
                  <h4 style={{ margin: 0, marginBottom: theme.spacing.md }}>Projects</h4>
                  <p>Project management and saved configurations will be displayed here.</p>
                </div>
              )}

              {activeTab === 'Info' && (
                <div style={{ padding: theme.spacing.md, color: theme.colors.text }}>
                  <h4 style={{ margin: 0, marginBottom: theme.spacing.md }}>Information</h4>
                  <p>System information and help documentation will be displayed here.</p>
                </div>
              )}
            </div>
          </Card>

          {/* Third Row - Spectrum Analyzer */}
          <div
            style={{
              display: "grid",
              gap: theme.spacing.lg,
              gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
            }}
          >
            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                <div style={{ fontWeight: 700, color: theme.colors.primary }}>Frequency vs Power</div>
                <FrequencyPowerChart />
              </div>
            </Card>
            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                <div style={{ fontWeight: 700, color: theme.colors.primary }}>Waterfall</div>
                <WaterfallChart />
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
            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                <h3 style={{ margin: 0 }}>Protocol Statistics</h3>
                <div style={{ display: "grid", gap: theme.spacing.sm }}>
                  {Array.from(protocolStats.entries()).map(([protocol, stats]) => {
                    const protocolTheme = resolveProtocolTheme(protocol, protocol);
                    return (
                      <div
                        key={protocol}
                        style={{
                          padding: theme.spacing.md,
                          border: `1px solid ${protocolTheme.borderColor}`,
                          borderRadius: theme.radius.md,
                          background: protocolTheme.background,
                        }}
                      >
                        <div style={{ fontWeight: 600, color: protocolTheme.textColor, marginBottom: theme.spacing.xs }}>
                          {protocolTheme.label}
                        </div>
                        <div style={{ fontSize: 14, color: theme.colors.textSecondary }}>
                          <div>Messages: {stats.count}</div>
                          <div>Data: {formatBytes(stats.bytes)}</div>
                          <div>Duration: {formatDuration(stats.duration)}</div>
                        </div>
                      </div>
                    );
                  })}
                  {protocolStats.size === 0 && (
                    <div style={{ padding: theme.spacing.md, color: theme.colors.textSecondary }}>
                      No protocol data available.
                    </div>
                  )}
                </div>
              </div>
            </Card>
            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                <h3 style={{ margin: 0 }}>Recent Messages</h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          Time
                        </th>
                        <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          Protocol
                        </th>
                        <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          Source
                        </th>
                        <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          TG/LCN
                        </th>
                        <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          Emergency
                        </th>
                        <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          Size
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentMessages.map((message, index) => {
                        const metadata = getSignalAnalyzerMetadataFromMessage(message);
                        const protocolTheme = resolveProtocolTheme(
                          metadata.service_type,
                          message.protocol ?? null,
                        );

                        return (
                          <tr key={index}>
                            <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                              {message.received_at ? new Date(message.received_at).toLocaleTimeString() : "N/A"}
                            </td>
                            <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                              <span
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  background: protocolTheme.background,
                                  color: protocolTheme.textColor,
                                  border: `1px solid ${protocolTheme.borderColor}`,
                                }}
                              >
                                {protocolTheme.label}
                              </span>
                            </td>
                            <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                              {metadata.source || "N/A"}
                            </td>
                            <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                              {metadata.talkgroup || metadata.lcn || "N/A"}
                            </td>
                            <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                              {metadata.emergency ? (
                                <span style={{ color: "#dc2626", fontWeight: 600 }}>YES</span>
                              ) : (
                                <span style={{ color: theme.colors.textSecondary }}>NO</span>
                              )}
                            </td>
                            <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                              {formatBytes(message.bytes)}
                            </td>
                          </tr>
                        );
                      })}
                      {recentMessages.length === 0 && (
                        <tr>
                          <td style={{ padding: theme.spacing.sm }} colSpan={6}>
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
        </div>
      </PageContainer>
    </AppLayout>
  );
}
