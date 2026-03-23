import type { AssetTypeSettings, DrawShapeType } from "./mapViewConfig";
import MapLegendPanel from "./MapLegendPanel";
import MapOverlayControls from "./MapOverlayControls";

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
  assetTypeLegend: Array<[string, AssetTypeSettings]>;
  triangulationLegendEntries: Array<{ sourceId: string; color: string }>;
  showAssetLegend: boolean;
  onToggleAssetLegend: () => void;
};

export default function MapOverlaysPanel({
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
  assetTypeLegend,
  triangulationLegendEntries,
  showAssetLegend,
  onToggleAssetLegend,
}: Props) {
  return (
    <>
      <MapOverlayControls
        dfRangeColor={dfRangeColor}
        showTransparencySlider={showTransparencySlider}
        onToggleTransparencySlider={onToggleTransparencySlider}
        jammerPopupAlpha={jammerPopupAlpha}
        onJammerPopupAlphaChange={onJammerPopupAlphaChange}
        showJammerColorPicker={showJammerColorPicker}
        onToggleJammerColorPicker={onToggleJammerColorPicker}
        jammerRangeColor={jammerRangeColor}
        onJammerRangeColorChange={onJammerRangeColorChange}
        showDfColorPicker={showDfColorPicker}
        onToggleDfColorPicker={onToggleDfColorPicker}
        onDfRangeColorChange={onDfRangeColorChange}
        showBaseMapSelector={showBaseMapSelector}
        onToggleBaseMapSelector={onToggleBaseMapSelector}
        baseMapId={baseMapId}
        onBaseMapSelectionChange={onBaseMapSelectionChange}
        isOfflineBaseMap={isOfflineBaseMap}
        baseMapTileErrors={baseMapTileErrors}
        autoOfflineFallbackActive={autoOfflineFallbackActive}
        navigatorOnline={navigatorOnline}
        currentViewAvailable={currentViewAvailable}
        onSaveCurrentView={onSaveCurrentView}
        hasSavedView={hasSavedView}
        onResetView={onResetView}
        showAssets={showAssets}
        onToggleAssets={onToggleAssets}
        showSignals={showSignals}
        onToggleSignals={onToggleSignals}
        showHeatOverlay={showHeatOverlay}
        onToggleHeatOverlay={onToggleHeatOverlay}
        showTriangulationOverlay={showTriangulationOverlay}
        onToggleTriangulationOverlay={onToggleTriangulationOverlay}
        showNodeLabels={showNodeLabels}
        onToggleNodeLabels={onToggleNodeLabels}
        showAlerts={showAlerts}
        onToggleAlerts={onToggleAlerts}
        activeDrawShape={activeDrawShape}
        activeShapeMenuTop={activeShapeMenuTop}
        activeShapeColor={activeShapeColor}
        activeShapeLabel={activeShapeLabel}
        onActiveShapeColorChange={onActiveShapeColorChange}
        mousePosition={mousePosition}
      />

      <MapLegendPanel
        assetTypeLegend={assetTypeLegend}
        triangulationLegendEntries={triangulationLegendEntries}
        showAssetLegend={showAssetLegend}
        onToggleAssetLegend={onToggleAssetLegend}
      />
    </>
  );
}
