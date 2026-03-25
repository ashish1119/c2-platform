import type { DrawShapeType } from "./mapViewConfig";
import {
  BASE_MAP_OPTIONS,
  MAX_JAMMER_POPUP_ALPHA,
  MIN_JAMMER_POPUP_ALPHA,
} from "./mapViewConfig";

type Props = {
  dfRangeColor: string;
  showTransparencySlider: boolean;
  onToggleTransparencySlider: () => void;
  jammerPopupAlpha: number;
  onJammerPopupAlphaChange: (nextValue: number) => void;
  showJammerColorPicker: boolean;
  onToggleJammerColorPicker: () => void;
  jammerRangeColor: string;
  onJammerRangeColorChange: (nextColor: string) => void;
  showDfColorPicker: boolean;
  onToggleDfColorPicker: () => void;
  onDfRangeColorChange: (nextColor: string) => void;
  showBaseMapSelector: boolean;
  onToggleBaseMapSelector: () => void;
  baseMapId: string;
  onBaseMapSelectionChange: (nextBaseMapId: string) => void;
  isOfflineBaseMap: boolean;
  baseMapTileErrors: number;
  autoOfflineFallbackActive: boolean;
  navigatorOnline: boolean;
  currentViewAvailable: boolean;
  onSaveCurrentView: () => void;
  hasSavedView: boolean;
  onResetView: () => void;
  showAssets: boolean;
  onToggleAssets: () => void;
  showSignals: boolean;
  onToggleSignals: () => void;
  showHeatOverlay: boolean;
  onToggleHeatOverlay: () => void;
  showTriangulationOverlay: boolean;
  onToggleTriangulationOverlay: () => void;
  showNodeLabels: boolean;
  onToggleNodeLabels: () => void;
  showAlerts: boolean;
  onToggleAlerts: () => void;
  activeDrawShape: DrawShapeType | null;
  activeShapeMenuTop: number;
  activeShapeColor: string;
  activeShapeLabel: string;
  onActiveShapeColorChange: (nextColor: string) => void;
  mousePosition: [number, number] | null;
};

export default function MapOverlayControls({
  dfRangeColor,
  showTransparencySlider,
  onToggleTransparencySlider,
  jammerPopupAlpha,
  onJammerPopupAlphaChange,
  showJammerColorPicker,
  onToggleJammerColorPicker,
  jammerRangeColor,
  onJammerRangeColorChange,
  showDfColorPicker,
  onToggleDfColorPicker,
  onDfRangeColorChange,
  showBaseMapSelector,
  onToggleBaseMapSelector,
  baseMapId,
  onBaseMapSelectionChange,
  isOfflineBaseMap,
  baseMapTileErrors,
  autoOfflineFallbackActive,
  navigatorOnline,
  currentViewAvailable,
  onSaveCurrentView,
  hasSavedView,
  onResetView,
  showAssets,
  onToggleAssets,
  showSignals,
  onToggleSignals,
  showHeatOverlay,
  onToggleHeatOverlay,
  showTriangulationOverlay,
  onToggleTriangulationOverlay,
  showNodeLabels,
  onToggleNodeLabels,
  showAlerts,
  onToggleAlerts,
  activeDrawShape,
  activeShapeMenuTop,
  activeShapeColor,
  activeShapeLabel,
  onActiveShapeColorChange,
  mousePosition,
}: Props) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 16,
          top: 16,
          zIndex: 1000,
          display: "grid",
          gap: 6,
        }}
      >
        <button
          type="button"
          title="Controls: SV Save view | R Reset to saved/default view | A Assets toggle | ! Alerts toggle | S Signals toggle | H Heat overlay toggle | T Triangulation overlay toggle | N Node labels toggle | Draw tools on top-right (press Enter to finish)"
          aria-label="Map controls legend"
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: "#ffffff",
            color: dfRangeColor,
            cursor: "help",
            fontWeight: 700,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            fontSize: 15,
          }}
        >
          ⌖
        </button>

        <button
          type="button"
          title="Popup transparency"
          aria-label="Toggle popup transparency slider"
          onClick={onToggleTransparencySlider}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showTransparencySlider ? "#e2e8f0" : "#ffffff",
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
          {"\u25D0"}
        </button>

        {showTransparencySlider && (
          <div
            title="Jammer popup transparency"
            style={{
              width: 120,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "rgba(255, 255, 255, 0.96)",
              color: "#0f172a",
              padding: "6px 8px",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.1 }}>Popup Transparency</div>
            <input
              type="range"
              min={MIN_JAMMER_POPUP_ALPHA}
              max={MAX_JAMMER_POPUP_ALPHA}
              step={0.05}
              value={jammerPopupAlpha}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                if (!Number.isFinite(nextValue)) {
                  return;
                }
                onJammerPopupAlphaChange(
                  Math.max(MIN_JAMMER_POPUP_ALPHA, Math.min(MAX_JAMMER_POPUP_ALPHA, nextValue))
                );
              }}
              style={{ width: "100%", margin: 0 }}
            />
            <div style={{ fontSize: 11, color: "#334155" }}>{Math.round((1 - jammerPopupAlpha) * 100)}%</div>
          </div>
        )}

        <button
          type="button"
          title="Jammer ring color"
          aria-label="Toggle jammer ring color picker"
          onClick={onToggleJammerColorPicker}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showJammerColorPicker ? "#e2e8f0" : "#ffffff",
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
          {String.fromCodePoint(0x1F3A8)}
        </button>

        {showJammerColorPicker && (
          <div
            title="Jammer range color"
            style={{
              width: 120,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "rgba(255, 255, 255, 0.96)",
              color: "#0f172a",
              padding: "6px 8px",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.1 }}>Jammer Ring Color</div>
            <input
              type="color"
              value={jammerRangeColor}
              onChange={(event) => onJammerRangeColorChange(event.target.value)}
              style={{ width: "100%", height: 24, border: "none", padding: 0, background: "transparent", cursor: "pointer" }}
            />
          </div>
        )}

        <button
          type="button"
          title="DF ring color"
          aria-label="Toggle DF ring color picker"
          onClick={onToggleDfColorPicker}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showDfColorPicker ? "#e2e8f0" : "#ffffff",
            color: dfRangeColor,
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
          {String.fromCodePoint(0x1F4E1)}
        </button>

        {showDfColorPicker && (
          <div
            title="Direction finder range color"
            style={{
              width: 120,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "rgba(255, 255, 255, 0.96)",
              color: "#0f172a",
              padding: "6px 8px",
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.1 }}>DF Ring Color</div>
            <input
              type="color"
              value={dfRangeColor}
              onChange={(event) => onDfRangeColorChange(event.target.value)}
              style={{ width: "100%", height: 24, border: "none", padding: 0, background: "transparent", cursor: "pointer" }}
            />
          </div>
        )}

        <button
          type="button"
          title="Base map selection"
          aria-label="Toggle base map selector"
          onClick={onToggleBaseMapSelector}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showBaseMapSelector ? "#e2e8f0" : "#ffffff",
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
          {String.fromCodePoint(0x1F5FA)}
        </button>

        {showBaseMapSelector && (
          <select
            title="Base map"
            value={baseMapId}
            onChange={(event) => {
              onBaseMapSelectionChange(event.target.value);
            }}
            style={{
              height: 30,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "#ffffff",
              color: "#0f172a",
              padding: "0 6px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {BASE_MAP_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        )}

        {!isOfflineBaseMap && baseMapTileErrors >= 1 && (
          <div
            style={{
              background: "rgba(255, 255, 255, 0.96)",
              border: "1px solid #f59e0b",
              borderRadius: 6,
              color: "#92400e",
              fontSize: 11,
              fontWeight: 600,
              maxWidth: 180,
              padding: "4px 6px",
            }}
          >
            Base map failed to load. Switching to offline tiles.
          </div>
        )}

        {baseMapId === "offline-local" && baseMapTileErrors >= 1 && (
          <div
            style={{
              background: "rgba(255, 255, 255, 0.96)",
              border: "1px solid #f59e0b",
              borderRadius: 6,
              color: "#92400e",
              fontSize: 11,
              fontWeight: 600,
              maxWidth: 180,
              padding: "4px 6px",
            }}
          >
            Offline local tiles unavailable. Switching to offline grid.
          </div>
        )}

        {isOfflineBaseMap && (
          <div
            style={{
              background: "rgba(255, 255, 255, 0.96)",
              border: "1px solid #16a34a",
              borderRadius: 6,
              color: "#166534",
              fontSize: 11,
              fontWeight: 600,
              maxWidth: 180,
              padding: "4px 6px",
            }}
          >
            Offline map mode active. Add XYZ tiles in /public/tiles for full map detail.
            {autoOfflineFallbackActive && navigatorOnline ? " Retrying online map automatically..." : ""}
          </div>
        )}

        <button
          type="button"
          title="Save current view"
          onClick={onSaveCurrentView}
          disabled={!currentViewAvailable}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: hasSavedView ? "#ffffff" : "#f8fafc",
            color: "#0f172a",
            cursor: "pointer",
            fontWeight: 700,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            fontSize: 15,
            opacity: currentViewAvailable ? 1 : 0.55,
          }}
        >
          {String.fromCodePoint(0x1F4BE)}
        </button>

        <button
          type="button"
          title="Reset view"
          onClick={onResetView}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: "#ffffff",
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
          {"\u21BA"}
        </button>

        <button
          type="button"
          title={showAssets ? "Hide assets" : "Show assets"}
          onClick={onToggleAssets}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showAssets ? "#ffffff" : "#f1f5f9",
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
          {String.fromCodePoint(0x1F4CD)}
        </button>

        <button
          type="button"
          title={showSignals ? "Hide signals" : "Show signals"}
          onClick={onToggleSignals}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showSignals ? "#ffffff" : "#f1f5f9",
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
          {String.fromCodePoint(0x1F4F6)}
        </button>

        <button
          type="button"
          title={showHeatOverlay ? "Hide heat overlay" : "Show heat overlay"}
          onClick={onToggleHeatOverlay}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showHeatOverlay ? "#ffffff" : "#f1f5f9",
            color: "#0f172a",
            cursor: "pointer",
            fontWeight: 700,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            fontSize: 12,
          }}
        >
          H
        </button>

        <button
          type="button"
          title={showTriangulationOverlay ? "Hide triangulation overlay" : "Show triangulation overlay"}
          onClick={onToggleTriangulationOverlay}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showTriangulationOverlay ? "#ffffff" : "#f1f5f9",
            color: "#0f172a",
            cursor: "pointer",
            fontWeight: 700,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            fontSize: 12,
          }}
        >
          T
        </button>

        <button
          type="button"
          title={showNodeLabels ? "Hide node labels" : "Show node labels"}
          onClick={onToggleNodeLabels}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showNodeLabels ? "#ffffff" : "#f1f5f9",
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
          {String.fromCodePoint(0x1F3F7)}
        </button>

        <button
          type="button"
          title={showAlerts ? "Hide alerts" : "Show alerts"}
          onClick={onToggleAlerts}
          style={{
            width: 30,
            height: 30,
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: showAlerts ? "#ffffff" : "#f1f5f9",
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
          {String.fromCodePoint(0x1F6A8)}
        </button>
      </div>

      {activeDrawShape && (
        <div
          style={{
            position: "absolute",
            right: 58,
            top: activeShapeMenuTop,
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.94)",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: "3px",
          }}
        >
          <input
            title={`${activeShapeLabel} color`}
            type="color"
            value={activeShapeColor}
            onChange={(event) => onActiveShapeColorChange(event.target.value)}
            style={{ width: 14, height: 14, border: "none", padding: 0, background: "transparent", cursor: "pointer" }}
          />
        </div>
      )}

      <div
        title="Compass (North Up)"
        style={{
          position: "absolute",
          right: 58,
          top: 16,
          zIndex: 1000,
          width: 56,
          height: 56,
          borderRadius: 999,
          border: "1px solid #d1d5db",
          background: "rgba(255, 255, 255, 0.94)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.25)",
          backdropFilter: "blur(2px)",
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r="30" fill="#0f172a" opacity="0.9" />
          <circle cx="32" cy="32" r="26" fill="#f8fafc" />
          <circle cx="32" cy="32" r="24" fill="none" stroke="#475569" strokeWidth="1" />

          <g stroke="#64748b" strokeWidth="1">
            <line x1="32" y1="8" x2="32" y2="12" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(30 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(60 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(90 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(120 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(150 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(180 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(210 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(240 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(270 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(300 32 32)" />
            <line x1="32" y1="8" x2="32" y2="12" transform="rotate(330 32 32)" />
          </g>

          <g stroke="#334155" strokeWidth="1.6">
            <line x1="32" y1="6" x2="32" y2="13" />
            <line x1="32" y1="6" x2="32" y2="13" transform="rotate(90 32 32)" />
            <line x1="32" y1="6" x2="32" y2="13" transform="rotate(180 32 32)" />
            <line x1="32" y1="6" x2="32" y2="13" transform="rotate(270 32 32)" />
          </g>

          <line x1="32" y1="15" x2="32" y2="49" stroke="#94a3b8" strokeWidth="0.8" opacity="0.75" />
          <line x1="15" y1="32" x2="49" y2="32" stroke="#94a3b8" strokeWidth="0.8" opacity="0.75" />

          <polygon points="32,10 38,31 32,27 26,31" fill="#dc2626" />
          <polygon points="32,54 38,33 32,37 26,33" fill="#64748b" />
          <circle cx="32" cy="32" r="2.8" fill="#0f172a" />

          <text x="32" y="9" textAnchor="middle" fontSize="7" fontWeight="700" fill="#b91c1c">N</text>
          <text x="55" y="34" textAnchor="middle" fontSize="6" fontWeight="700" fill="#334155">E</text>
          <text x="32" y="60" textAnchor="middle" fontSize="6" fontWeight="700" fill="#334155">S</text>
          <text x="9" y="34" textAnchor="middle" fontSize="6" fontWeight="700" fill="#334155">W</text>
          <text x="32" y="42" textAnchor="middle" fontSize="5" fontWeight="700" fill="#475569">6400</text>
        </svg>
      </div>

      {mousePosition && (
        <div
          style={{
            position: "absolute",
            left: 16,
            bottom: 46,
            zIndex: 1000,
            background: "rgba(255, 255, 255, 0.92)",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: "3px 8px",
            fontSize: 12,
            color: "#0f172a",
          }}
        >
          {`Lat ${mousePosition[0].toFixed(6)}, Lon ${mousePosition[1].toFixed(6)}`}
        </div>
      )}
    </>
  );
}
