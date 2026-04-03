import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getAssets } from "../../api/assets";
import type { AssetRecord } from "../../api/assets";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";
import { useTheme } from "../../context/ThemeContext";

// Types for stream data
interface StreamPacket {
  metadata: any;
  signalData: Float32Array;
  receivedAt: number;
}

// Simple form input component
const AdaptiveInput: React.FC<{
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  width?: string;
  textAlign?: string;
}> = ({ label, defaultValue, placeholder, minLength, maxLength, width = "120px", textAlign = "left" }) => {
  const { theme } = useTheme();
  
  return (
    <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm }}>
      {label && (
        <div style={{ fontSize: "0.9em", color: theme.colors.textPrimary, fontWeight: "500" }}>
          {label}
        </div>
      )}
      <input
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        minLength={minLength}
        maxLength={maxLength}
        style={{
          width,
          padding: theme.spacing.xs,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
          textAlign: textAlign as any,
          fontSize: "0.9em"
        }}
      />
    </div>
  );
};

// Form label component
const FormLabel: React.FC<{
  children: React.ReactNode;
  color?: string;
  fontWeight?: string;
}> = ({ children, color, fontWeight }) => {
  const { theme } = useTheme();
  
  return (
    <span style={{
      color: color || theme.colors.text,
      fontWeight: fontWeight || "normal",
      fontSize: "0.9em"
    }}>
      {children}
    </span>
  );
};

// Sidebar item component
const SidebarItem: React.FC<{
  label: string;
}> = ({ label }) => {
  const { theme } = useTheme();
  
  return (
    <div style={{
      padding: theme.spacing.sm,
      color: theme.colors.textSecondary,
      cursor: "pointer",
      borderRadius: theme.radius.sm,
      fontSize: "0.9em",
      transition: "background-color 0.2s ease"
    }}>
      {label}
    </div>
  );
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

export default function OperatorSignalSimulationPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Device');
  const [isSignalCommandOpen, setIsSignalCommandOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tcpClientStatus, setTcpClientStatus] = useState<any>(null);
  const [tcpListenerHealth, setTcpListenerHealth] = useState<any>(null);

  // Signal Streamer State
  const [isStreamerActive, setIsStreamerActive] = useState(false);
  const [streamData, setStreamData] = useState<StreamPacket[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamStats, setStreamStats] = useState({
    packetsReceived: 0,
    totalBytes: 0,
    lastPacketTime: 0,
    averageFrequency: 0,
    averageAmplitude: 0
  });
  const streamSocketRef = useRef<WebSocket | null>(null);
  const [selectedPacket, setSelectedPacket] = useState<StreamPacket | null>(null);

  // Signal Streamer Handlers
  const handleStartStreamer = useCallback(async () => {
    try {
      setIsStreamerActive(true);
      setStreamError(null);
      setStreamData([]);
      setStreamStats({
        packetsReceived: 0,
        totalBytes: 0,
        lastPacketTime: 0,
        averageFrequency: 0,
        averageAmplitude: 0
      });
      
      console.log('Starting signal streamer...');
      
      // Try to connect to WebSocket, but also start mock data generation
      const ws = new WebSocket('ws://localhost:8081/stream');
      streamSocketRef.current = ws;
      
      ws.onopen = () => {
        console.log('Connected to stream data WebSocket');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'stream_data') {
            const newStreamData: StreamPacket = {
              metadata: data.metadata,
              signalData: new Float32Array(data.signalData),
              receivedAt: Date.now()
            };
            
            setStreamData((prev: StreamPacket[]) => {
              const updated = [...prev, newStreamData];
              // Keep only last 100 packets for performance
              return updated.slice(-100);
            });
            
            // Update stats
            setStreamStats((prev: typeof streamStats) => ({
              packetsReceived: prev.packetsReceived + 1,
              totalBytes: prev.totalBytes + data.signalData.length * 4, // Float32 = 4 bytes
              lastPacketTime: Date.now(),
              averageFrequency: data.metadata.center_frequency || 0,
              averageAmplitude: data.metadata.amplitudes ? 
                data.metadata.amplitudes.reduce((a: number, b: number) => a + b, 0) / data.metadata.amplitudes.length : 0
            }));
          }
        } catch (err) {
          console.error('Error parsing stream data:', err);
        }
      };
      
      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setStreamError('WebSocket connection failed - using mock data instead');
      };
      
      ws.onclose = () => {
        console.log('WebSocket connection closed');
        if (isStreamerActive) {
          setStreamError('WebSocket connection lost - using mock data');
        }
      };
      
      // Start mock data generation for demonstration
      const mockDataInterval = setInterval(() => {
        if (!isStreamerActive) {
          clearInterval(mockDataInterval);
          return;
        }
        
        // Generate mock signal data
        const sampleCount = 1024;
        const signalData = new Float32Array(sampleCount);
        const frequencies = [433.92, 434.5, 432.1, 435.2];
        const randomFreq = frequencies[Math.floor(Math.random() * frequencies.length)];
        
        // Generate mock signal samples
        for (let i = 0; i < sampleCount; i++) {
          const t = i / 44100; // Sample rate
          signalData[i] = Math.sin(2 * Math.PI * randomFreq * 1e6 * t) * 
                          (0.5 + Math.random() * 0.5) * 
                          Math.exp(-t * 0.1);
        }
        
        const mockPacket: StreamPacket = {
          metadata: {
            center_frequency: randomFreq * 1e9, // Convert to Hz
            sample_rate: 44100,
            bandwidth: 2000000,
            amplitudes: Array.from({length: 10}, () => -50 + Math.random() * 20),
            timestamp: Date.now(),
            device_id: `device_${Math.floor(Math.random() * 1000)}`,
            signal_strength: -60 + Math.random() * 30,
            modulation: ['FSK', 'PSK', 'QAM', 'FM'][Math.floor(Math.random() * 4)]
          },
          signalData: signalData,
          receivedAt: Date.now()
        };
        
        setStreamData((prev: StreamPacket[]) => {
          const updated = [...prev, mockPacket];
          return updated.slice(-100); // Keep last 100 packets
        });
        
        setStreamStats((prev: typeof streamStats) => ({
          packetsReceived: prev.packetsReceived + 1,
          totalBytes: prev.totalBytes + signalData.length * 4,
          lastPacketTime: Date.now(),
          averageFrequency: randomFreq * 1e9,
          averageAmplitude: mockPacket.metadata.amplitudes.reduce((a: number, b: number) => a + b, 0) / mockPacket.metadata.amplitudes.length
        }));
      }, 1000); // Generate mock data every second
      
      // Store interval ID for cleanup
      (window as any).mockDataInterval = mockDataInterval;
      
    } catch (err) {
      console.error('Failed to start streamer:', err);
      setStreamError('Failed to start streamer');
      setIsStreamerActive(false);
    }
  }, [isStreamerActive]);

  const handleStopStreamer = useCallback(() => {
    setIsStreamerActive(false);
    
    if (streamSocketRef.current) {
      streamSocketRef.current.close();
      streamSocketRef.current = null;
    }
    
    // Clear mock data interval
    if ((window as any).mockDataInterval) {
      clearInterval((window as any).mockDataInterval);
      (window as any).mockDataInterval = null;
    }
    
    console.log('Signal streamer stopped');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      handleStopStreamer();
    };
  }, [handleStopStreamer]);

  const handleConnect = useCallback(async () => {
    setConnectionStatus('connected');
  }, []);

  const handleDisconnect = useCallback(async () => {
    setConnectionStatus('disconnected');
  }, []);

  const handleStartDevice = useCallback(async () => {
    console.log('Start Device command triggered');
    // TODO: Implement device start API call
  }, []);

  const handleStopDevice = useCallback(async () => {
    console.log('Stop Device command triggered');
    // TODO: Implement device stop API call
  }, []);

  const handleDeleteDevice = useCallback(async () => {
    if (window.confirm('Are you sure you want to delete this device? This action cannot be undone.')) {
      console.log('Delete Device command triggered');
      // TODO: Implement device delete API call
    }
  }, []);

  const handleModifyDevice = useCallback(async () => {
    console.log('Modify Device command triggered');
    // TODO: Implement device modify API call
  }, []);

  const handlePacketClick = useCallback((packet: StreamPacket) => {
    setSelectedPacket(packet);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isSignalCommandOpen && !(event.target as Element).closest('.signal-command-container')) {
        setIsSignalCommandOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSignalCommandOpen]);

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
                paddingBottom: theme.spacing.xs,
                position: "relative"
              }}>
                {['Device', 'Protocols', 'Tools', 'Windows', 'Settings', 'Projects', 'Info', 'Signal Command'].map((tab) => (
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
                    onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                      if (activeTab !== tab) {
                        e.currentTarget.style.backgroundColor = theme.colors.surface;
                      }
                    }}
                    onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                      if (activeTab !== tab) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                    onFocus={(e: React.FocusEvent<HTMLDivElement>) => {
                      e.currentTarget.style.outline = `2px solid ${theme.colors.primary}`;
                      e.currentTarget.style.outlineOffset = "2px";
                    }}
                    onBlur={(e: React.FocusEvent<HTMLDivElement>) => {
                      e.currentTarget.style.outline = "none";
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
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
                        onFocus={(e: React.FocusEvent<HTMLButtonElement>) => {
                          if (connectionStatus !== 'connected') {
                            e.currentTarget.style.outline = `2px solid ${theme.colors.primary}`;
                            e.currentTarget.style.outlineOffset = "2px";
                          }
                        }}
                        onBlur={(e: React.FocusEvent<HTMLButtonElement>) => {
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
                        onFocus={(e: React.FocusEvent<HTMLButtonElement>) => {
                          if (connectionStatus !== 'disconnected') {
                            e.currentTarget.style.outline = `2px solid ${theme.colors.error}`;
                            e.currentTarget.style.outlineOffset = "2px";
                          }
                        }}
                        onBlur={(e: React.FocusEvent<HTMLButtonElement>) => {
                          e.currentTarget.style.outline = "none";
                        }}
                      >
                        Disconnect
                      </button>
                    </div>

                    {/* Signal Streamer Section */}
                    <div style={{ 
                      marginTop: theme.spacing.lg,
                      padding: theme.spacing.md,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radius.md,
                      backgroundColor: theme.colors.surface
                    }}>
                      <h4 style={{ margin: 0, marginBottom: theme.spacing.md, color: theme.colors.primary }}>
                        Signal Streamer (Port 9999)
                      </h4>
                      
                      {/* Streamer Controls */}
                      <div style={{ 
                        display: "flex", 
                        gap: theme.spacing.sm, 
                        marginBottom: theme.spacing.md
                      }}>
                        <button
                          type="button"
                          onClick={handleStartStreamer}
                          disabled={isStreamerActive}
                          style={{
                            padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                            backgroundColor: isStreamerActive ? theme.colors.surface : theme.colors.primary,
                            color: isStreamerActive ? theme.colors.textSecondary : theme.colors.text,
                            border: `1px solid ${isStreamerActive ? theme.colors.border : theme.colors.primary}`,
                            borderRadius: theme.radius.sm,
                            cursor: isStreamerActive ? "not-allowed" : "pointer",
                            fontSize: "0.9em",
                            fontWeight: "500",
                            outline: "none",
                            transition: "all 0.2s ease",
                            transform: isStreamerActive ? "scale(0.98)" : "scale(1)",
                            boxShadow: isStreamerActive ? "none" : `0 2px 4px ${theme.colors.primary}30`
                          }}
                          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                            if (!isStreamerActive) {
                              e.currentTarget.style.backgroundColor = theme.colors.primary + '90';
                              e.currentTarget.style.transform = "scale(1.05)";
                              e.currentTarget.style.boxShadow = `0 4px 8px ${theme.colors.primary}40`;
                            }
                          }}
                          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                            if (!isStreamerActive) {
                              e.currentTarget.style.backgroundColor = theme.colors.primary;
                              e.currentTarget.style.transform = "scale(1)";
                              e.currentTarget.style.boxShadow = `0 2px 4px ${theme.colors.primary}30`;
                            }
                          }}
                        >
                          {isStreamerActive ? '⏸ Streamer Active' : '▶ Start Streamer'}
                        </button>
                        <button
                          type="button"
                          onClick={handleStopStreamer}
                          disabled={!isStreamerActive}
                          style={{
                            padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                            backgroundColor: !isStreamerActive ? theme.colors.surface : theme.colors.error,
                            color: !isStreamerActive ? theme.colors.textSecondary : theme.colors.text,
                            border: `1px solid ${!isStreamerActive ? theme.colors.border : theme.colors.error}`,
                            borderRadius: theme.radius.sm,
                            cursor: !isStreamerActive ? "not-allowed" : "pointer",
                            fontSize: "0.9em",
                            fontWeight: "500",
                            outline: "none",
                            transition: "all 0.2s ease",
                            transform: !isStreamerActive ? "scale(0.98)" : "scale(1)",
                            boxShadow: !isStreamerActive ? "none" : `0 2px 4px ${theme.colors.error}30`
                          }}
                          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                            if (isStreamerActive) {
                              e.currentTarget.style.backgroundColor = theme.colors.error + '90';
                              e.currentTarget.style.transform = "scale(1.05)";
                              e.currentTarget.style.boxShadow = `0 4px 8px ${theme.colors.error}40`;
                            }
                          }}
                          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                            if (isStreamerActive) {
                              e.currentTarget.style.backgroundColor = theme.colors.error;
                              e.currentTarget.style.transform = "scale(1)";
                              e.currentTarget.style.boxShadow = `0 2px 4px ${theme.colors.error}30`;
                            }
                          }}
                        >
                          {isStreamerActive ? '⏹ Stop Streamer' : '⏹ Inactive'}
                        </button>
                      </div>

                      {/* Streamer Status */}
                      <div style={{ 
                        display: "grid", 
                        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                        gap: theme.spacing.sm,
                        marginBottom: theme.spacing.md,
                        padding: theme.spacing.sm,
                        backgroundColor: isStreamerActive ? theme.colors.primary + '10' : theme.colors.surface,
                        borderRadius: theme.radius.sm,
                        border: `1px solid ${isStreamerActive ? theme.colors.primary : theme.colors.border}`
                      }}>
                        <div>
                          <div style={{ fontSize: "0.8em", color: theme.colors.textSecondary }}>Status</div>
                          <div style={{ fontWeight: "600", color: isStreamerActive ? theme.colors.primary : theme.colors.textSecondary }}>
                            {isStreamerActive ? 'Active' : 'Inactive'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: "0.8em", color: theme.colors.textSecondary }}>Packets</div>
                          <div style={{ fontWeight: "600", color: theme.colors.text }}>
                            {streamStats.packetsReceived}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: "0.8em", color: theme.colors.textSecondary }}>Data Size</div>
                          <div style={{ fontWeight: "600", color: theme.colors.text }}>
                            {formatBytes(streamStats.totalBytes)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: "0.8em", color: theme.colors.textSecondary }}>Avg Frequency</div>
                          <div style={{ fontWeight: "600", color: theme.colors.text }}>
                            {(streamStats.averageFrequency / 1e9).toFixed(3)} GHz
                          </div>
                        </div>
                      </div>

                      {/* Stream Error */}
                      {streamError && (
                        <div style={{
                          padding: theme.spacing.sm,
                          backgroundColor: theme.colors.error + '10',
                          border: `1px solid ${theme.colors.error}`,
                          borderRadius: theme.radius.sm,
                          color: theme.colors.error,
                          fontSize: "0.9em",
                          marginBottom: theme.spacing.md
                        }}>
                          Error: {streamError}
                        </div>
                      )}

                      {/* Stream Data JSON Tree */}
                      {streamData.length > 0 && (
                        <div style={{
                          marginTop: theme.spacing.md,
                          padding: theme.spacing.sm,
                          backgroundColor: theme.colors.background,
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: theme.radius.sm,
                          maxHeight: "300px",
                          overflow: "auto"
                        }}>
                          <h5 style={{ margin: "0 0 " + theme.spacing.sm + " 0", color: theme.colors.primary }}>
                            Stream Data (Last {streamData.length} packets)
                          </h5>
                          <div style={{ fontSize: "0.8em", fontFamily: "monospace" }}>
                            {streamData.slice(-5).reverse().map((data: StreamPacket, index: number) => (
                              <div 
                                key={data.receivedAt} 
                                onClick={() => handlePacketClick(data)}
                                style={{
                                  marginBottom: theme.spacing.sm,
                                  padding: theme.spacing.sm,
                                  backgroundColor: selectedPacket?.receivedAt === data.receivedAt ? theme.colors.primary + '25' : theme.colors.surface,
                                  border: selectedPacket?.receivedAt === data.receivedAt ? `2px solid ${theme.colors.primary}` : `1px solid ${theme.colors.border}`,
                                  borderRadius: theme.radius.sm,
                                  cursor: "pointer",
                                  transition: "all 0.3s ease",
                                  transform: selectedPacket?.receivedAt === data.receivedAt ? "scale(1.02)" : "scale(1)",
                                  boxShadow: selectedPacket?.receivedAt === data.receivedAt ? `0 4px 12px ${theme.colors.primary}40` : `0 1px 3px rgba(0,0,0,0.1)`
                                }}
                                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                                  if (selectedPacket?.receivedAt !== data.receivedAt) {
                                    e.currentTarget.style.backgroundColor = theme.colors.surface + 'CC';
                                    e.currentTarget.style.transform = "scale(1.01)";
                                    e.currentTarget.style.boxShadow = `0 2px 8px rgba(0,0,0,0.15)`;
                                  }
                                }}
                                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                                  if (selectedPacket?.receivedAt !== data.receivedAt) {
                                    e.currentTarget.style.backgroundColor = theme.colors.surface;
                                    e.currentTarget.style.transform = "scale(1)";
                                    e.currentTarget.style.boxShadow = `0 1px 3px rgba(0,0,0,0.1)`;
                                  }
                                }}
                              >
                                <div style={{ fontWeight: "600", color: theme.colors.primary, marginBottom: theme.spacing.xs, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span>
                                    📦 Packet #{streamStats.packetsReceived - index} - {new Date(data.receivedAt).toLocaleTimeString()}
                                  </span>
                                  {selectedPacket?.receivedAt === data.receivedAt && (
                                    <span style={{ 
                                      marginLeft: theme.spacing.sm, 
                                      fontSize: "0.8em", 
                                      color: theme.colors.primary,
                                      backgroundColor: theme.colors.primary + '20',
                                      padding: "2px 6px",
                                      borderRadius: "4px",
                                      fontWeight: "700"
                                    }}>
                                      ✓ SELECTED
                                    </span>
                                  )}
                                </div>
                                <div style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.xs, fontSize: "0.85em" }}>
                                  <strong>📊 Metadata:</strong>
                                </div>
                                <pre style={{ 
                                  margin: 0, 
                                  fontSize: "0.75em", 
                                  color: theme.colors.text,
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-all",
                                  backgroundColor: theme.colors.background,
                                  padding: theme.spacing.xs,
                                  borderRadius: "4px",
                                  border: `1px solid ${theme.colors.border}`
                                }}>
                                  {JSON.stringify(data.metadata, null, 2)}
                                </pre>
                                <div style={{ 
                                  color: theme.colors.textSecondary, 
                                  marginTop: theme.spacing.xs, 
                                  fontSize: "0.75em",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}>
                                  <span>📡 Signal Data: {data.signalData.length} samples</span>
                                  <span style={{ 
                                    color: theme.colors.success,
                                    fontWeight: "600"
                                  }}>
                                    {data.metadata.modulation || 'N/A'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Signal Command' && (
                <div style={{ padding: theme.spacing.md, color: theme.colors.text }}>
                  <h4 style={{ margin: 0, marginBottom: theme.spacing.md }}>Signal Command Options</h4>
                  <div style={{ display: "grid", gap: theme.spacing.sm, maxWidth: "200px" }}>
                    <button
                      type="button"
                      onClick={handleModifyDevice}
                      style={{
                        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                        backgroundColor: theme.colors.surface,
                        color: theme.colors.text,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.radius.sm,
                        cursor: "pointer",
                        fontSize: "0.9em",
                        textAlign: "left",
                        transition: "background-color 0.2s ease"
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                        e.currentTarget.style.backgroundColor = theme.colors.primary + '20';
                      }}
                      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                        e.currentTarget.style.backgroundColor = theme.colors.surface;
                      }}
                    >
                      Modify Device
                    </button>
                    <button
                      type="button"
                      onClick={handleStartDevice}
                      style={{
                        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                        backgroundColor: theme.colors.surface,
                        color: theme.colors.text,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.radius.sm,
                        cursor: "pointer",
                        fontSize: "0.9em",
                        textAlign: "left",
                        transition: "background-color 0.2s ease"
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                        e.currentTarget.style.backgroundColor = theme.colors.primary + '20';
                      }}
                      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                        e.currentTarget.style.backgroundColor = theme.colors.surface;
                      }}
                    >
                      Start Device
                    </button>
                    <button
                      type="button"
                      onClick={handleStopDevice}
                      style={{
                        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                        backgroundColor: theme.colors.surface,
                        color: theme.colors.text,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.radius.sm,
                        cursor: "pointer",
                        fontSize: "0.9em",
                        textAlign: "left",
                        transition: "background-color 0.2s ease"
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                        e.currentTarget.style.backgroundColor = theme.colors.primary + '20';
                      }}
                      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                        e.currentTarget.style.backgroundColor = theme.colors.surface;
                      }}
                    >
                      Stop Device
                    </button>
                    <div style={{ height: "1px", backgroundColor: theme.colors.border, margin: `${theme.spacing.xs} 0` }} />
                    <button
                      type="button"
                      onClick={handleDeleteDevice}
                      style={{
                        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                        backgroundColor: theme.colors.error + '15',
                        color: theme.colors.error,
                        border: `1px solid ${theme.colors.error}`,
                        borderRadius: theme.radius.sm,
                        cursor: "pointer",
                        fontSize: "0.9em",
                        fontWeight: "500",
                        textAlign: "left",
                        transition: "background-color 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme.colors.error + '25';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = theme.colors.error + '15';
                      }}
                    >
                      Delete Device
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
