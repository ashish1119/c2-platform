import { useEffect, useState } from "react";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import MapView from "../../components/MapView";
import { getAssets, type AssetRecord } from "../../api/assets";
import { getHeatMap, getRFSignals, getTriangulation, type HeatCell, type RFSignal, type TriangulationResult } from "../../api/rf";
import { useTheme } from "../../context/ThemeContext";

export default function OperatorMapPage() {
  const { theme } = useTheme();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [signals, setSignals] = useState<RFSignal[]>([]);
  const [heatCells, setHeatCells] = useState<HeatCell[]>([]);
  const [triangulation, setTriangulation] = useState<TriangulationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const [assetsRes, signalsRes, heatRes, triangulationRes] = await Promise.all([
          getAssets(),
          getRFSignals(),
          getHeatMap(),
          getTriangulation(),
        ]);
        setAssets(assetsRes.data);
        setSignals(signalsRes.data);
        setHeatCells(heatRes.data);
        setTriangulation(triangulationRes.data);
      } catch {
        setError("Failed to load map data.");
      } finally {
        setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppLayout>
      <PageContainer title="Operator Map">
        {loading && <div style={{ marginBottom: theme.spacing.md, color: theme.colors.textSecondary }}>Loading map feeds...</div>}
        {error && <div style={{ marginBottom: theme.spacing.md, color: theme.colors.danger }}>{error}</div>}
        {triangulation?.warning && <div style={{ marginBottom: theme.spacing.md, color: theme.colors.warning }}>{triangulation.warning}</div>}
        <MapView assets={assets} signals={signals} heatCells={heatCells} triangulation={triangulation} />
      </PageContainer>
    </AppLayout>
  );
}
