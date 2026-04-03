import type { AssetTypeSettings, DrawShapeType } from "./mapViewConfig";
import MapLegendPanel from "./MapLegendPanel";

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
      <MapLegendPanel
        assetTypeLegend={assetTypeLegend}
        triangulationLegendEntries={triangulationLegendEntries}
        showAssetLegend={showAssetLegend}
        onToggleAssetLegend={onToggleAssetLegend}
      />
    </>
  );
}
