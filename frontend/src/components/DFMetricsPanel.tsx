import React from "react";

type DFMetricsPanelProps = {
    frequency: number;
    power: number;
    bearing: number;
    dfQuality: number;
    elevation?: number;
};

/**
 * DF Metrics Panel - displays frequency, elevation, quality, and power.
 * Professional dark theme with neon green accents.
 */
export default function DFMetricsPanel({ frequency, power, bearing, dfQuality, elevation = 0 }: DFMetricsPanelProps) {
    return (
        <div
            style={{
                background: "#0a0e1a",
                border: "2px solid #00ff64",
                borderRadius: "8px",
                padding: "16px",
                color: "#00ff64",
                fontFamily: "monospace",
                fontSize: "13px",
            }}
        >
            <h3 style={{ margin: "0 0 12px 0", borderBottom: "1px solid #00ff64", paddingBottom: "8px", textTransform: "uppercase" }}>
                DF Metrics
            </h3>

            {/* Frequency Tuning */}
            <div style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span>Ftune (MHz)</span>
                    <span style={{ color: "#ffff00" }}>{frequency.toFixed(2)}</span>
                </div>
            </div>

            {/* Bearing */}
            <div style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span>Azimuth (°)</span>
                    <span style={{ color: "#ffff00" }}>{bearing.toFixed(1)}</span>
                </div>
            </div>

            {/* Elevation */}
            <div style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span>Elevation</span>
                    <span style={{ color: "#ffff00" }}>{elevation.toFixed(1)}°</span>
                </div>
                <div
                    style={{
                        background: "#1a1f2e",
                        borderRadius: "4px",
                        height: "8px",
                        overflow: "hidden",
                        border: "1px solid #00ff64",
                    }}
                >
                    <div
                        style={{
                            background: "linear-gradient(90deg, #00ff64, #ffff00, #ff0055)",
                            height: "100%",
                            width: `${Math.max(0, Math.min(100, elevation + 45))}%`,
                            transition: "width 0.2s",
                        }}
                    />
                </div>
            </div>

            {/* DF Quality */}
            <div style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span>DF Quality</span>
                    <span style={{ color: "#ffff00" }}>{dfQuality.toFixed(0)}%</span>
                </div>
                <div
                    style={{
                        background: "#1a1f2e",
                        borderRadius: "4px",
                        height: "8px",
                        overflow: "hidden",
                        border: "1px solid #00ff64",
                    }}
                >
                    <div
                        style={{
                            background: dfQuality > 70 ? "#00ff64" : dfQuality > 40 ? "#ffff00" : "#ff0055",
                            height: "100%",
                            width: `${dfQuality}%`,
                            transition: "width 0.2s",
                        }}
                    />
                </div>
            </div>

            {/* RMS Power */}
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span>RMS Power</span>
                    <span style={{ color: "#ffff00" }}>{power.toFixed(1)} dBm</span>
                </div>
                <div
                    style={{
                        background: "#1a1f2e",
                        borderRadius: "4px",
                        height: "8px",
                        overflow: "hidden",
                        border: "1px solid #00ff64",
                    }}
                >
                    <div
                        style={{
                            background: "linear-gradient(90deg, #0099ff, #00ff64, #ffff00)",
                            height: "100%",
                            width: `${Math.max(0, Math.min(100, power + 80))}%`,
                            transition: "width 0.2s",
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
