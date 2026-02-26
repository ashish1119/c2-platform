import { useEffect, useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import PageContainer from "../components/layout/PageContainer";
import MapView from "../components/MapView";
import AlertTable from "../components/AlertTable";
import { getAssets, type AssetRecord } from "../api/assets";
import { getHeatMap, getRFSignals, getTriangulation, type HeatCell, type RFSignal, type TriangulationResult } from "../api/rf";
import { useTheme } from "../context/ThemeContext";

export default function OperatorDashboard() {
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
        setError("Failed to load operator data.");
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
      <PageContainer title="Operations Center">
        <div style={{ marginBottom: theme.spacing.xl }}>
          <MapView assets={assets} signals={signals} heatCells={heatCells} triangulation={triangulation} />
        </div>

        {loading && <div style={{ marginBottom: theme.spacing.md, color: theme.colors.textSecondary }}>Loading operational feeds...</div>}
        {error && <div style={{ marginBottom: theme.spacing.md, color: theme.colors.danger }}>{error}</div>}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: theme.spacing.lg,
            marginBottom: theme.spacing.xl,
          }}
        >
          <div>
            <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>RF Signals</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Frequency</th>
                  <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Modulation</th>
                  <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Power</th>
                  <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {signals.slice(0, 20).map((signal) => (
                  <tr key={signal.id}>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{signal.frequency}</td>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{signal.modulation}</td>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{signal.power_level}</td>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{new Date(signal.detected_at).toLocaleString()}</td>
                  </tr>
                ))}
                {signals.length === 0 && (
                  <tr>
                    <td style={{ padding: theme.spacing.sm }} colSpan={4}>No RF signals available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div>
            <h3 style={{ marginTop: 0, marginBottom: theme.spacing.sm }}>Heat Map Density Cells</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Latitude</th>
                  <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Longitude</th>
                  <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Density</th>
                </tr>
              </thead>
              <tbody>
                {heatCells.slice(0, 20).map((cell, index) => (
                  <tr key={`${cell.latitude_bucket}-${cell.longitude_bucket}-${index}`}>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{cell.latitude_bucket}</td>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{cell.longitude_bucket}</td>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{cell.density}</td>
                  </tr>
                ))}
                {heatCells.length === 0 && (
                  <tr>
                    <td style={{ padding: theme.spacing.sm }} colSpan={3}>No heat map cells available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <AlertTable />
      </PageContainer>
    </AppLayout>
  );
}