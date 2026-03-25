import type { AssetTypeSettings } from "./mapViewConfig";
import { getShapeSvg } from "./mapViewUtils";

type Props = {
  assetTypeLegend: Array<[string, AssetTypeSettings]>;
  triangulationLegendEntries: Array<{ sourceId: string; color: string }>;
  showAssetLegend: boolean;
  onToggleAssetLegend: () => void;
};

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
          right: 10,
          bottom: 118,
          zIndex: 901,
          width: 30,
          height: 30,
          border: "1px solid #d1d5db",
          borderRadius: 6,
          background: showAssetLegend ? "#e2e8f0" : "#ffffff",
          color: "#0f172a",
          cursor: "pointer",
          fontWeight: 700,
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          fontSize: 15,
        }}
      >
        {String.fromCodePoint(0x1F4DA)}
      </button>

      {showAssetLegend && (
        <div
          style={{
            position: "absolute",
            right: 10,
            bottom: 154,
            zIndex: 900,
            background: "rgba(255, 255, 255, 0.92)",
            border: "1px solid #d1d5db",
            borderRadius: 16,
            padding: "14px 14px",
            minWidth: 210,
            maxHeight: "calc(100% - 180px)",
            overflowY: "auto",
            fontSize: 14,
            lineHeight: 1.4,
            backdropFilter: "blur(2px)",
          }}
        >
          {assetTypeLegend.length > 0 && (
            <>
              <div style={{ fontWeight: 700, marginBottom: 10, color: "#0f172a" }}>Asset Type Legend</div>
              {assetTypeLegend.map(([typeKey, settings]) => (
                <div key={typeKey} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, color: "#1e293b" }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      display: "inline-flex",
                    }}
                    dangerouslySetInnerHTML={{
                      __html: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">${getShapeSvg(settings.shape, 22, settings.markerColor)}<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="Inter, sans-serif" font-size="8" font-weight="700">${settings.symbol}</text></svg>`,
                    }}
                  >
                  </span>
                  <span>{settings.label}</span>
                </div>
              ))}
            </>
          )}

          {triangulationLegendEntries.length > 0 && (
            <>
              {assetTypeLegend.length > 0 && (
                <div style={{ borderTop: "1px solid #cbd5e1", margin: "10px 0" }} />
              )}
              <div style={{ fontWeight: 700, marginBottom: 10, color: "#0f172a" }}>Triangulation Sources</div>
              {triangulationLegendEntries.map((entry) => (
                <div key={entry.sourceId} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, color: "#1e293b" }}>
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
              <div style={{ marginTop: 6, color: "#475569", fontSize: 12 }}>Use H and T controls for heat and triangulation overlays.</div>
            </>
          )}
        </div>
      )}
    </>
  );
}
