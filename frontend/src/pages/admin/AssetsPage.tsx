import { useEffect, useState } from "react";
import {
  exportAssetsCsv,
  exportAssetsXml,
  getAssets,
  importAssetsCsv,
  importAssetsXml,
  type AssetRecord,
} from "../../api/assets";
import { useTheme } from "../../context/ThemeContext";
import MapView from "../../components/MapView";

export default function AssetsPage() {
  const { theme } = useTheme();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

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

  const handleCsvImport = async (file?: File) => {
    if (!file) return;
    try {
      setBusyAction("import-csv");
      await importAssetsCsv(file);
      await loadAssets();
    } catch {
      setError("CSV import failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleXmlImport = async (file?: File) => {
    if (!file) return;
    try {
      setBusyAction("import-xml");
      await importAssetsXml(file);
      await loadAssets();
    } catch {
      setError("XML import failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleCsvExport = async () => {
    try {
      setBusyAction("export-csv");
      const response = await exportAssetsCsv();
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "assets.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("CSV export failed.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleXmlExport = async () => {
    try {
      setBusyAction("export-xml");
      const response = await exportAssetsXml();
      const blob = new Blob([response.data], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "assets.xml";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("XML export failed.");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h3 style={{ marginTop: 0, marginBottom: theme.spacing.md }}>Assets</h3>

      <div style={{ display: "flex", gap: 8 }}>
        <label>
          Import CSV
          <input style={{ marginLeft: theme.spacing.sm }} type="file" accept=".csv" onChange={(e) => handleCsvImport(e.target.files?.[0])} />
        </label>
        <label>
          Import XML
          <input style={{ marginLeft: theme.spacing.sm }} type="file" accept=".xml" onChange={(e) => handleXmlImport(e.target.files?.[0])} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }} disabled={busyAction !== null} onClick={handleCsvExport}>
          {busyAction === "export-csv" ? "Exporting..." : "Export CSV"}
        </button>
        <button style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }} disabled={busyAction !== null} onClick={handleXmlExport}>
          {busyAction === "export-xml" ? "Exporting..." : "Export XML"}
        </button>
      </div>

      {loading && <div>Loading assets...</div>}
      {error && <div style={{ color: theme.colors.danger }}>{error}</div>}

      <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
        <MapView assets={assets} assetConnectionMode="mesh" />
      </div>

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
  );
}
