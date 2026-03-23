import { useEffect, useMemo, useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import PageContainer from "../components/layout/PageContainer";
import SpectrumAnalyzer from "../components/SpectrumAnalyzer";
import DFMetricsPanel from "../components/DFMetricsPanel";
import Compass from "../components/Compass";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type DFLiveDatum = {
    frequency: number;
    power: number;
    bearing: number;
    elevation: number;
    dfQuality: number;
    receiver_lat: number;
    receiver_lon: number;
    transmitter_lat: number;
    transmitter_lon: number;
    timestamp: number;
};

const INDIA_CENTER = { lat: 28.6139, lng: 77.209 };

/**
 * Generate realistic RF signal data with variation patterns
 */
function generateRealisticData(previous: DFLiveDatum | null): DFLiveDatum {
    const baseFrequency = 925.5;
    const freqNoise = Math.sin(Date.now() / 2000) * 2 + (Math.random() - 0.5) * 1;
    const frequency = Number((baseFrequency + freqNoise).toFixed(2));

    const basePower = -45;
    const powerNoise = Math.sin(Date.now() / 1500) * 5 + (Math.random() - 0.5) * 2;
    const power = Number((basePower + powerNoise).toFixed(1));

    const bearing = Number(((Math.random() * 360) % 360).toFixed(1));
    const elevation = Number(((Math.random() * 90) - 45).toFixed(1));
    const dfQuality = Number((60 + Math.random() * 35).toFixed(0));

    const receiver_lat = 28.6139;
    const receiver_lon = 77.209;
    const angleRad = (bearing * Math.PI) / 180;
    const rangeDeg = 0.25;
    const transmitter_lat = Number((receiver_lat + Math.sin(angleRad) * rangeDeg).toFixed(6));
    const transmitter_lon = Number((receiver_lon + Math.cos(angleRad) * rangeDeg).toFixed(6));

    return {
        frequency,
        power,
        bearing,
        elevation,
        dfQuality,
        receiver_lat,
        receiver_lon,
        transmitter_lat,
        transmitter_lon,
        timestamp: Date.now(),
    };
}

/**
 * Generate spectrum data points for the analyzer
 */
function generateSpectrumData(): Array<{ frequency: number; power: number }> {
    const baseFreq = 920;
    const points = [];
    for (let i = 0; i < 50; i++) {
        const freq = baseFreq + i * 0.5;
        const noise = Math.sin((freq - 920) / 3) * 8 + (Math.random() - 0.5) * 4;
        points.push({
            frequency: Number(freq.toFixed(2)),
            power: Number((-50 + noise).toFixed(1)),
        });
    }
    return points;
}

export default function DFLive() {
    const [latest, setLatest] = useState<DFLiveDatum | null>(null);
    const [spectrumData, setSpectrumData] = useState<Array<{ frequency: number; power: number }>>([]);
    const [isRunning, setIsRunning] = useState(true);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize data
    useEffect(() => {
        const seedValue = generateRealisticData(null);
        setLatest(seedValue);
        setSpectrumData(generateSpectrumData());
        setIsLoading(false);
    }, []);

    // Real-time update loop
    useEffect(() => {
        if (!isRunning) return;

        const timer = setInterval(() => {
            setLatest((prev) => generateRealisticData(prev));
            setSpectrumData((prev) => {
                // Simulate spectrum sweep by shifting peak
                return prev.map((p) => ({
                    frequency: p.frequency,
                    power: Number((p.power + (Math.random() - 0.5) * 3).toFixed(1)),
                }));
            });
        }, 1500);

        return () => clearInterval(timer);
    }, [isRunning]);

    return (
        <AppLayout>
            <PageContainer title="DF Live Signal Monitoring">
                {/* Header */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "20px",
                    }}
                >
                    <h2 style={{ margin: 0, color: "#00ff64", fontSize: "24px", textTransform: "uppercase" }}>
                        DF Live Signal Monitoring
                    </h2>
                    <div style={{ display: "flex", gap: "12px" }}>
                        <button
                            type="button"
                            onClick={() => setIsRunning((p) => !p)}
                            style={{
                                border: "2px solid #00ff64",
                                background: isRunning ? "#00ff64" : "transparent",
                                color: isRunning ? "#0a0e1a" : "#00ff64",
                                padding: "8px 16px",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontWeight: "bold",
                                transition: "all 0.2s",
                            }}
                        >
                            {isRunning ? "■ Stop" : "▶ Start"}
                        </button>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "8px 16px",
                                background: "#0a0e1a",
                                border: "2px solid #00ff64",
                                borderRadius: "4px",
                                color: "#00ff64",
                                fontSize: "12px",
                            }}
                        >
                            <span
                                style={{
                                    display: "inline-block",
                                    width: "8px",
                                    height: "8px",
                                    background: isRunning ? "#00ff64" : "#ff0055",
                                    borderRadius: "50%",
                                    animation: isRunning ? "pulse 1s infinite" : "none",
                                }}
                            />
                            {isRunning ? "LIVE" : "IDLE"}
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 300px",
                        gap: "16px",
                        marginBottom: "16px",
                    }}
                >
                    {/* Left: Spectrum Analyzer */}
                    {!isLoading && spectrumData.length > 0 && <SpectrumAnalyzer data={spectrumData} height={350} />}

                    {/* Right: DF Panel (Compass + Metrics) */}
                    <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: "16px" }}>
                        {/* Compass */}
                        <div
                            style={{
                                background: "#0a0e1a",
                                border: "2px solid #00ff64",
                                borderRadius: "8px",
                                padding: "16px",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            {latest && <Compass bearing={latest.bearing} size={140} />}
                        </div>

                        {/* Metrics Panel */}
                        {latest && (
                            <DFMetricsPanel
                                frequency={latest.frequency}
                                power={latest.power}
                                bearing={latest.bearing}
                                dfQuality={latest.dfQuality}
                                elevation={latest.elevation}
                            />
                        )}
                    </div>
                </div>

                {/* Bottom: Map (Full Width) */}
                <div
                    style={{
                        background: "#0a0e1a",
                        border: "2px solid #00ff64",
                        borderRadius: "8px",
                        overflow: "hidden",
                        height: "350px",
                    }}
                >
                    <MapContainer center={INDIA_CENTER} zoom={10} style={{ height: "100%", width: "100%" }}>
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; OpenStreetMap contributors'
                        />
                        {latest && (
                            <>
                                {/* Receiver Marker */}
                                <Marker position={[latest.receiver_lat, latest.receiver_lon]}>
                                    <Popup>
                                        <strong>Receiver (DF System)</strong>
                                        <br />
                                        {latest.receiver_lat.toFixed(4)}°, {latest.receiver_lon.toFixed(4)}°
                                    </Popup>
                                </Marker>

                                {/* Transmitter Marker */}
                                <Marker position={[latest.transmitter_lat, latest.transmitter_lon]}>
                                    <Popup>
                                        <strong>Detected Transmitter</strong>
                                        <br />
                                        {latest.transmitter_lat.toFixed(4)}°, {latest.transmitter_lon.toFixed(4)}°
                                        <br />
                                        Bearing: {latest.bearing.toFixed(1)}°
                                    </Popup>
                                </Marker>

                                {/* Bearing Line */}
                                <Polyline
                                    positions={[
                                        [latest.receiver_lat, latest.receiver_lon],
                                        [latest.transmitter_lat, latest.transmitter_lon],
                                    ]}
                                    pathOptions={{ color: "#ff0055", weight: 3, opacity: 0.8 }}
                                />
                            </>
                        )}
                    </MapContainer>
                </div>

                {/* CSS for pulse animation */}
                <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
            </PageContainer>
        </AppLayout>
    );
}
