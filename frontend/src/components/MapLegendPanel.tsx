import { BookMarked } from "lucide-react";
import type { AssetTypeSettings } from "./mapViewConfig";

type Props = {
  assetTypeLegend: Array<[string, AssetTypeSettings]>;
  triangulationLegendEntries: Array<{ sourceId: string; color: string }>;
  showAssetLegend: boolean;
  onToggleAssetLegend: () => void;
};

function renderLegendShape(shape: AssetTypeSettings["shape"], size: number, color: string) {
  const stroke = "#ffffff";
  const strokeWidth = 2;
  const mid = size / 2;
  const pad = 2;
  const max = size - pad;

  if (shape === "hex") {
    return <polygon points={`${mid},${pad} ${max - 6},${size * 0.28} ${max - 6},${size * 0.72} ${mid},${max} ${pad + 6},${size * 0.72} ${pad + 6},${size * 0.28}`} fill={color} stroke={stroke} strokeWidth={strokeWidth} />;
  }

  if (shape === "diamond") {
    return <polygon points={`${mid},${pad} ${max},${mid} ${mid},${max} ${pad},${mid}`} fill={color} stroke={stroke} strokeWidth={strokeWidth} />;
  }

  if (shape === "square") {
    return <rect x={pad} y={pad} width={size - pad * 2} height={size - pad * 2} rx={7} ry={7} fill={color} stroke={stroke} strokeWidth={strokeWidth} />;
  }

  if (shape === "triangle") {
    return <polygon points={`${mid},${pad} ${max},${max - 2} ${pad},${max - 2}`} fill={color} stroke={stroke} strokeWidth={strokeWidth} />;
  }

  if (shape === "shield") {
    return <path d={`M ${mid} ${pad} L ${max - 3} ${size * 0.24} L ${max - 5} ${size * 0.65} L ${mid} ${max} L ${pad + 5} ${size * 0.65} L ${pad + 3} ${size * 0.24} Z`} fill={color} stroke={stroke} strokeWidth={strokeWidth} />;
  }

  return <circle cx={mid} cy={mid} r={size * 0.44} fill={color} stroke={stroke} strokeWidth={strokeWidth} />;
}

export default function MapLegendPanel({
  assetTypeLegend,
  triangulationLegendEntries,
  showAssetLegend,
  onToggleAssetLegend,
}: Props) {
  if (assetTypeLegend.length === 0 && triangulationLegendEntries.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        title="Layer legend"
        aria-label="Toggle layer legend"
        onClick={onToggleAssetLegend}
        style={{
          position: "absolute",
          right: 76,
          top: 16,
          zIndex: 901,
          width: 36,
          height: 36,
          border: `1px solid ${showAssetLegend ? "rgba(56, 189, 248, 0.7)" : "rgba(148, 163, 184, 0.35)"}`,
          borderRadius: 9,
          background: showAssetLegend ? "rgba(30, 41, 59, 0.95)" : "rgba(15, 23, 42, 0.58)",
          color: showAssetLegend ? "#38bdf8" : "#cbd5e1",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          boxShadow: showAssetLegend ? "0 0 0 2px rgba(56, 189, 248, 0.2)" : "inset 0 1px 0 rgba(255,255,255,0.05)",
          transition: "all 0.2s ease",
        }}
      >
        <BookMarked size={15} strokeWidth={2} />
      </button>

      {showAssetLegend && (
        <div
          style={{
            position: "absolute",
            right: 76,
            top: 60,
            zIndex: 900,
            background: "rgba(15, 23, 42, 0.92)",
            border: "1px solid rgba(56, 189, 248, 0.25)",
            borderRadius: 16,
            padding: "14px 14px",
            minWidth: 210,
            maxHeight: "calc(100% - 180px)",
            overflowY: "auto",
            fontSize: 14,
            lineHeight: 1.4,
            backdropFilter: "blur(12px)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
        >
          {assetTypeLegend.length > 0 && (
            <>
              <div style={{ fontWeight: 700, marginBottom: 10, color: "#38bdf8", fontSize: 12, letterSpacing: "0.08em" }}>ASSET TYPE LEGEND</div>
              {assetTypeLegend.map(([typeKey, settings]) => (
                <div key={typeKey} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, color: "#e2e8f0" }}>
                  <span style={{ width: 22, height: 22, display: "inline-flex" }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
                      {renderLegendShape(settings.shape, 22, settings.markerColor)}
                      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontFamily="Inter, sans-serif" fontSize="8" fontWeight="700">
                        {settings.symbol}
                      </text>
                    </svg>
                  </span>
                  <span>{settings.label}</span>
                </div>
              ))}
            </>
          )}

          {triangulationLegendEntries.length > 0 && (
            <>
              {assetTypeLegend.length > 0 && (
                <div style={{ borderTop: "1px solid rgba(56, 189, 248, 0.15)", margin: "10px 0" }} />
              )}
              <div style={{ fontWeight: 700, marginBottom: 10, color: "#38bdf8", fontSize: 12, letterSpacing: "0.08em" }}>TRIANGULATION SOURCES</div>
              {triangulationLegendEntries.map((entry) => (
                <div key={entry.sourceId} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, color: "#e2e8f0" }}>
                  <span
                    style={{
                      width: 20,
                      height: 4,
                      borderRadius: 6,
                      background: entry.color,
                      display: "inline-flex",
                    }}
                  />
                  <span>{entry.sourceId}</span>
                </div>
              ))}
              <div style={{ marginTop: 6, color: "#64748b", fontSize: 11 }}>Use H and T controls for heat and triangulation overlays.</div>
            </>
          )}
        </div>
      )}
    </>
  );
}
