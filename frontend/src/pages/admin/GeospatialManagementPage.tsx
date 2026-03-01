import { useEffect, useMemo, useState } from "react";

import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";
import { useTheme } from "../../context/ThemeContext";
import {
  createGeospatialSource,
  deactivateGeospatialSource,
  getGeospatialCapabilities,
  getGeospatialSources,
  type GeospatialSourceRecord,
  updateGeospatialSource,
} from "../../api/geospatial";

const defaultMetadataText = JSON.stringify(
  {
    fileIdentifier: "source-001",
    language: "eng",
    dateStamp: new Date().toISOString().slice(0, 10),
    identificationInfo: {
      title: "Operational feed",
      abstract: "ISO 19115 metadata profile for operational source",
    },
  },
  null,
  2
);

export default function GeospatialManagementPage() {
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [activeOnly, setActiveOnly] = useState(false);

  const [sourceTypes, setSourceTypes] = useState<string[]>([]);
  const [sources, setSources] = useState<GeospatialSourceRecord[]>([]);

  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState("VECTOR");
  const [transport, setTransport] = useState("API");
  const [classification, setClassification] = useState("UNCLASSIFIED");
  const [metadataText, setMetadataText] = useState(defaultMetadataText);

  const [selectedSourceId, setSelectedSourceId] = useState<string>("");

  const selectedSource = useMemo(
    () => sources.find((source) => source.source_id === selectedSourceId) ?? null,
    [selectedSourceId, sources]
  );

  const refresh = async (active = activeOnly) => {
    try {
      setLoading(true);
      setError(null);
      const [capabilitiesRes, sourcesRes] = await Promise.all([
        getGeospatialCapabilities(),
        getGeospatialSources(active),
      ]);

      const availableTypes = capabilitiesRes.data.source_types ?? [];
      setSourceTypes(availableTypes);
      setSources(sourcesRes.data);

      if (availableTypes.length > 0 && !availableTypes.includes(sourceType)) {
        setSourceType(availableTypes[0]);
      }

      if (selectedSourceId && !sourcesRes.data.find((item) => item.source_id === selectedSourceId)) {
        setSelectedSourceId("");
      }
    } catch {
      setError("Failed to load geospatial source data.");
    } finally {
      setLoading(false);
    }
  };

  const parseMetadata = (text: string) => {
    try {
      const value = JSON.parse(text);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
      throw new Error("metadata must be a JSON object");
    } catch {
      throw new Error("Invalid metadata JSON");
    }
  };

  const resetCreateForm = () => {
    setSourceName("");
    setTransport("API");
    setClassification("UNCLASSIFIED");
    setMetadataText(defaultMetadataText);
  };

  const submitCreate = async () => {
    try {
      setStatus("");
      const metadata = parseMetadata(metadataText);
      await createGeospatialSource({
        source_name: sourceName.trim(),
        source_type: sourceType,
        transport: transport.trim(),
        classification: classification.trim(),
        metadata,
      });
      setStatus("Source created");
      resetCreateForm();
      await refresh(activeOnly);
    } catch (err: any) {
      setStatus(err?.response?.data?.detail ?? "Failed to create source");
    }
  };

  const submitUpdate = async () => {
    if (!selectedSource) {
      setStatus("Select a source to update");
      return;
    }

    try {
      setStatus("");
      const metadata = parseMetadata(metadataText);
      await updateGeospatialSource(selectedSource.source_id, {
        source_name: sourceName.trim(),
        source_type: sourceType,
        transport: transport.trim(),
        classification: classification.trim(),
        metadata,
      });
      setStatus("Source updated");
      await refresh(activeOnly);
    } catch (err: any) {
      setStatus(err?.response?.data?.detail ?? "Failed to update source");
    }
  };

  const submitDeactivate = async (sourceId: string) => {
    try {
      setStatus("");
      await deactivateGeospatialSource(sourceId);
      setStatus("Source deactivated");
      if (selectedSourceId === sourceId) {
        setSelectedSourceId("");
      }
      await refresh(activeOnly);
    } catch (err: any) {
      setStatus(err?.response?.data?.detail ?? "Failed to deactivate source");
    }
  };

  const hydrateFormFromSelection = (source: GeospatialSourceRecord) => {
    setSelectedSourceId(source.source_id);
    setSourceName(source.source_name);
    setSourceType(source.source_type);
    setTransport(source.transport);
    setClassification(source.classification);
    setMetadataText(JSON.stringify(source.metadata ?? {}, null, 2));
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    refresh(activeOnly);
  }, [activeOnly]);

  const controlStyle: React.CSSProperties = {
    width: "100%",
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.background,
    color: theme.colors.textPrimary,
  };

  const buttonStyle: React.CSSProperties = {
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    background: theme.colors.primary,
    color: "#fff",
    cursor: "pointer",
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
  };

  return (
    <AppLayout>
      <PageContainer title="Geospatial Sources">
        <div style={{ display: "grid", gap: theme.spacing.lg }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0 }}>Geospatial Source Control</h3>
              <div style={{ color: theme.colors.textSecondary }}>
                Manage ingestion sources with ISO-19115 metadata.
              </div>
            </div>
            <button onClick={() => refresh(activeOnly)} style={buttonStyle}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: theme.spacing.md }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Source name</span>
                <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} style={controlStyle} />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Source type</span>
                <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} style={controlStyle}>
                  {sourceTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Transport</span>
                <input value={transport} onChange={(e) => setTransport(e.target.value)} style={controlStyle} />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Classification</span>
                <input value={classification} onChange={(e) => setClassification(e.target.value)} style={controlStyle} />
              </label>
            </div>

            <label style={{ display: "grid", gap: 6, marginTop: theme.spacing.md }}>
              <span>Metadata (JSON)</span>
              <textarea
                value={metadataText}
                onChange={(e) => setMetadataText(e.target.value)}
                rows={12}
                style={controlStyle}
              />
            </label>

            <div style={{ display: "flex", gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
              <button onClick={submitCreate} style={buttonStyle}>Create</button>
              <button
                onClick={submitUpdate}
                style={{ ...buttonStyle, background: theme.colors.warning }}
                disabled={!selectedSource}
              >
                Update Selected
              </button>
              <button
                onClick={() => {
                  setSelectedSourceId("");
                  resetCreateForm();
                }}
                style={{ ...buttonStyle, background: theme.colors.surface, color: theme.colors.textPrimary }}
              >
                Clear Form
              </button>
            </div>
          </Card>

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: theme.spacing.sm }}>
              <div style={{ fontWeight: 600 }}>Registered Sources</div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                />
                Active only
              </label>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Source</th>
                    <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Type</th>
                    <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Transport</th>
                    <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Classification</th>
                    <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Active</th>
                    <th style={{ textAlign: "left", padding: theme.spacing.sm }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((source) => (
                    <tr key={source.source_id}>
                      <td style={{ padding: theme.spacing.sm }}>{source.source_name}</td>
                      <td style={{ padding: theme.spacing.sm }}>{source.source_type}</td>
                      <td style={{ padding: theme.spacing.sm }}>{source.transport}</td>
                      <td style={{ padding: theme.spacing.sm }}>{source.classification}</td>
                      <td style={{ padding: theme.spacing.sm }}>{source.is_active ? "YES" : "NO"}</td>
                      <td style={{ padding: theme.spacing.sm, display: "flex", gap: theme.spacing.xs }}>
                        <button
                          onClick={() => hydrateFormFromSelection(source)}
                          style={{ ...buttonStyle, background: theme.colors.surface, color: theme.colors.textPrimary }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => submitDeactivate(source.source_id)}
                          style={{ ...buttonStyle, background: theme.colors.danger }}
                          disabled={!source.is_active}
                        >
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sources.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: theme.spacing.sm }}>
                        No sources found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {(error || status) && (
            <div style={{ color: error ? theme.colors.danger : theme.colors.textSecondary }}>
              {error ?? status}
            </div>
          )}
        </div>
      </PageContainer>
    </AppLayout>
  );
}
