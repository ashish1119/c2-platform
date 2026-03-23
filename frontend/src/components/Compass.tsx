import React from "react";

type CompassProps = {
    bearing: number;
    size?: number;
};

/**
 * Professional circular compass for bearing visualization.
 * Shows 0°, 90°, 180°, 270° with rotating needle.
 */
export default function Compass({ bearing, size = 160 }: CompassProps) {
    const radius = size / 2;
    const center = radius;
    const needleLength = radius - 20;

    // Convert bearing to radians (0° = top, clockwise)
    const angleRad = (bearing * Math.PI) / 180;
    const needleX = center + needleLength * Math.sin(angleRad);
    const needleY = center - needleLength * Math.cos(angleRad);

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ filter: "drop-shadow(0 0 8px rgba(0, 255, 100, 0.3))" }}>
                {/* Outer circle */}
                <circle cx={center} cy={center} r={radius - 5} fill="#0a0e1a" stroke="#00ff64" strokeWidth="2" />

                {/* Cardinal directions */}
                <text x={center} y="15" textAnchor="middle" fill="#00ff64" fontSize="12" fontWeight="bold">
                    N
                </text>
                <text x={size - 15} y={center + 5} textAnchor="middle" fill="#00ff64" fontSize="12" fontWeight="bold">
                    E
                </text>
                <text x={center} y={size - 5} textAnchor="middle" fill="#00ff64" fontSize="12" fontWeight="bold">
                    S
                </text>
                <text x="15" y={center + 5} textAnchor="middle" fill="#00ff64" fontSize="12" fontWeight="bold">
                    W
                </text>

                {/* Degree marks (8 points) */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                    const rad = (deg * Math.PI) / 180;
                    const x1 = center + (radius - 15) * Math.sin(rad);
                    const y1 = center - (radius - 15) * Math.cos(rad);
                    const x2 = center + (radius - 8) * Math.sin(rad);
                    const y2 = center - (radius - 8) * Math.cos(rad);
                    return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#00ff64" strokeWidth="1" opacity="0.5" />;
                })}

                {/* Center dot */}
                <circle cx={center} cy={center} r="4" fill="#ff0055" />

                {/* Bearing needle */}
                <line x1={center} y1={center} x2={needleX} y2={needleY} stroke="#ff0055" strokeWidth="3" strokeLinecap="round" />
                <circle cx={needleX} cy={needleY} r="5" fill="#ff0055" />
            </svg>

            {/* Bearing value */}
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#00ff64", textAlign: "center" }}>
                {bearing.toFixed(1)}°
            </div>
        </div>
    );
}
