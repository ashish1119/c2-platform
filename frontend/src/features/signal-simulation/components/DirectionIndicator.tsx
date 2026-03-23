import { useMemo } from "react";
import { useTheme } from "../../../context/ThemeContext";
import type { DfVector } from "../model/types";

type DirectionIndicatorProps = {
  vectors: DfVector[];
};

function toCardinal(angleDeg: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round((angleDeg % 360) / 45) % directions.length;
  return directions[idx < 0 ? idx + directions.length : idx];
}

export default function DirectionIndicator({ vectors }: DirectionIndicatorProps) {
  const { theme } = useTheme();

  const strongestVector = useMemo(() => {
    return [...vectors].sort((left, right) => right.strengthDbm - left.strengthDbm)[0] ?? null;
  }, [vectors]);

  if (!strongestVector) {
    return (
      <div style={{ height: 280, display: "grid", placeItems: "center", color: theme.colors.textSecondary }}>
        No DF vectors available.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", placeItems: "center", gap: theme.spacing.sm }}>
      <svg viewBox="0 0 220 220" style={{ width: 240, height: 240 }}>
        <circle cx="110" cy="110" r="92" fill="none" stroke={theme.colors.border} strokeWidth="2" />
        <circle cx="110" cy="110" r="4" fill={theme.colors.textPrimary} />

        <text x="110" y="16" textAnchor="middle" fill={theme.colors.textSecondary} fontSize="12">
          N
        </text>
        <text x="110" y="214" textAnchor="middle" fill={theme.colors.textSecondary} fontSize="12">
          S
        </text>
        <text x="10" y="114" textAnchor="middle" fill={theme.colors.textSecondary} fontSize="12">
          W
        </text>
        <text x="210" y="114" textAnchor="middle" fill={theme.colors.textSecondary} fontSize="12">
          E
        </text>

        <g transform={`rotate(${strongestVector.angleDeg} 110 110)`}>
          <line x1="110" y1="110" x2="110" y2="32" stroke={theme.colors.danger} strokeWidth="3" />
          <polygon points="110,24 104,36 116,36" fill={theme.colors.danger} />
        </g>
      </svg>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: 600 }}>{strongestVector.label}</div>
        <div style={{ color: theme.colors.textSecondary }}>
          {strongestVector.angleDeg.toFixed(1)} deg ({toCardinal(strongestVector.angleDeg)}) | {strongestVector.strengthDbm.toFixed(1)} dBm
        </div>
      </div>
    </div>
  );
}
