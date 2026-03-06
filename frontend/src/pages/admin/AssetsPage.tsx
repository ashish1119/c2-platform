import { useEffect, useState } from "react";
import { getAssets, type AssetRecord } from "../../api/assets";
import { useTheme } from "../../context/ThemeContext";
import MapView from "../../components/MapView";
import Card from "../../components/ui/Card";

export default function AssetsPage() {
  const { theme } = useTheme();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAssets();
      setAssets(response.data);
    } catch {
      setError("Failed to load assets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  return (
    <div style={{ display: "grid", gap: theme.spacing.lg }}>
      <div>
        <h3 style={{ marginTop: 0, marginBottom: theme.spacing.xs }}>Asset Operations Center</h3>
        <div style={{ color: theme.colors.textSecondary }}>
          Manage platform assets.
        </div>
        {loading && <div style={{ marginTop: theme.spacing.xs }}>Loading assets...</div>}
        {error && <div style={{ marginTop: theme.spacing.xs, color: theme.colors.danger }}>{error}</div>}
      </div>

      <Card>
        <div style={{ display: "grid", gap: theme.spacing.sm }}>
          <div style={{ fontWeight: 600 }}>Common Operating Map</div>
          <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
            <MapView assets={assets} assetConnectionMode="mesh" />
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ display: "grid", gap: theme.spacing.sm }}>
          <div style={{ fontWeight: 600 }}>Asset Registry</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Name</th>
                  <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Type</th>
                  <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Status</th>
                  <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Latitude</th>
                  <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Longitude</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{asset.name}</td>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{asset.type ?? "-"}</td>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{asset.status}</td>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{asset.latitude}</td>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{asset.longitude}</td>
                  </tr>
                ))}
                {assets.length === 0 && (
                  <tr>
                    <td style={{ padding: theme.spacing.sm }} colSpan={5}>No assets available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
