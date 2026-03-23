import React, { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";

type SpectrumData = {
    frequency: number;
    power: number;
};

type SpectrumAnalyzerProps = {
    data: SpectrumData[];
    height?: number;
};

/**
 * Professional RF Spectrum Analyzer - with peak detection and neon styling.
 * Shows multiple signal patterns with gradient effects.
 */
export default function SpectrumAnalyzer({ data, height = 350 }: SpectrumAnalyzerProps) {
    const peak = useMemo(() => {
        if (!data || data.length === 0) return null;
        return data.reduce((best, current) => (current.power > best.power ? current : best));
    }, [data]);

    // Calculate RMS (average power)
    const rms = useMemo(() => {
        if (!data || data.length === 0) return 0;
        const sum = data.reduce((acc, d) => acc + d.power, 0);
        return sum / data.length;
    }, [data]);

    return (
        <div style={{ background: "#0a0e1a", border: "2px solid #00ff64", borderRadius: "8px", padding: "16px" }}>
            <h3 style={{ margin: "0 0 12px 0", borderBottom: "1px solid #00ff64", paddingBottom: "8px", color: "#00ff64", textTransform: "uppercase" }}>
                Spectrum Analyzer
            </h3>

            <div style={{ height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        {/* Dark grid */}
                        <CartesianGrid strokeDasharray="3 3" stroke="#1a3a1a" />

                        {/* Axes */}
                        <XAxis
                            dataKey="frequency"
                            type="number"
                            domain={["dataMin", "dataMax"]}
                            stroke="#00ff64"
                            tick={{ fill: "#00ff64", fontSize: 12 }}
                            label={{ value: "Frequency (MHz)", position: "insideBottomRight", offset: -5, fill: "#00ff64" }}
                        />
                        <YAxis
                            stroke="#00ff64"
                            tick={{ fill: "#00ff64", fontSize: 12 }}
                            label={{ value: "Power (dBm)", angle: -90, position: "insideLeft", fill: "#00ff64" }}
                        />

                        {/* RMS Reference Line */}
                        <ReferenceLine
                            y={rms}
                            stroke="#ffff00"
                            strokeDasharray="5 5"
                            label={{ value: `RMS: ${rms.toFixed(1)} dBm`, fill: "#ffff00", fontSize: 11 }}
                        />

                        {/* Peak Line */}
                        {peak && <ReferenceLine x={peak.frequency} stroke="#ff0055" strokeDasharray="5 5" label={{ value: `Peak: ${peak.frequency.toFixed(1)} MHz`, fill: "#ff0055", fontSize: 11 }} />}

                        {/* Tooltip */}
                        <Tooltip
                            contentStyle={{
                                background: "#1a1f2e",
                                border: "1px solid #00ff64",
                                borderRadius: "4px",
                                color: "#00ff64",
                            }}
                            formatter={(value: number) => value.toFixed(1)}
                        />

                        {/* Main signal line (green) */}
                        <Line
                            type="monotone"
                            dataKey="power"
                            stroke="#00ff64"
                            dot={false}
                            strokeWidth={2}
                            isAnimationActive
                            animationDuration={300}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Stats Footer */}
            {peak && (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "12px",
                        marginTop: "12px",
                        fontSize: "12px",
                        color: "#00ff64",
                        borderTop: "1px solid #00ff64",
                        paddingTop: "12px",
                    }}
                >
                    <div>
                        <div style={{ color: "#ffff00" }}>Peak Freq</div>
                        <div>{peak.frequency.toFixed(2)} MHz</div>
                    </div>
                    <div>
                        <div style={{ color: "#ffff00" }}>Peak Power</div>
                        <div>{peak.power.toFixed(1)} dBm</div>
                    </div>
                    <div>
                        <div style={{ color: "#ffff00" }}>RMS Power</div>
                        <div>{rms.toFixed(1)} dBm</div>
                    </div>
                </div>
            )}
        </div>
    );
}
