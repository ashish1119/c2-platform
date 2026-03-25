import { useCallback, useEffect, useState } from "react";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import { useTheme } from "../../context/ThemeContext";
import {
  activateGeospatialSource,
  deactivateGeospatialSource,
  listGeospatialSources,
  registerGeospatialSource,
  SUPPORTED_SOURCE_TYPES,
  type GeospatialSourceRecord,
} from "../../api/geospatial";
import { AxiosError } from "axios";

const DEFAULT_TRANSPORT = "API";
const DEFAULT_CLASSIFICATION = "UNCLASSIFIED";
const DEFAULT_LANGUAGE = "eng";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function GeospatialSourcesPage() {
  const { theme } = useTheme();

  // List state
  const [sources, setSources] = useState<GeospatialSourceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [activeOnly, setActiveOnly] = useState(false);

  // Register form state
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState<string>(SUPPORTED_SOURCE_TYPES[0]);
  const [transport, setTransport] = useState(DEFAULT_TRANSPORT);
  const [classification, setClassification] = useState(DEFAULT_CLASSIFICATION);
  const [fileIdentifier, setFileIdentifier] = useState("");
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [dateStamp, setDateStamp] = useState(todayIso());
  const [mdTitle, setMdTitle] = useState("");
  const [mdAbstract, setMdAbstract] = useState("");

  const [registering, setRegistering] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Per-row action state
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const loadSources = useCallback(async () => {
    try {
      setLoading(true);
      setListError(null);
      const res = await listGeospatialSources(activeOnly);
      setSources(res.data);
    } catch {
      setListError("Failed to load geospatial ingestion sources.");
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const resetForm = () => {
    setSourceName("");
    setSourceType(SUPPORTED_SOURCE_TYPES[0]);
    setTransport(DEFAULT_TRANSPORT);
    setClassification(DEFAULT_CLASSIFICATION);
    setFileIdentifier("");
    setLanguage(DEFAULT_LANGUAGE);
    setDateStamp(todayIso());
    setMdTitle("");
    setMdAbstract("");
    setFormError(null);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const trimmedName = sourceName.trim();
    if (!trimmedName) {
      setFormError("Source name is required.");
      return;
    }
    if (!mdTitle.trim()) {
      setFormError("Metadata title is required (ISO 19115).");
      return;
    }
    if (!mdAbstract.trim()) {
      setFormError("Metadata abstract is required (ISO 19115).");
      return;
    }
    if (!fileIdentifier.trim()) {
      setFormError("File identifier is required (ISO 19115).");
      return;
    }

    try {
      setRegistering(true);
      await registerGeospatialSource({
        source_name: trimmedName,
        source_type: sourceType,
        transport: transport.trim() || DEFAULT_TRANSPORT,
        classification: classification.trim() || DEFAULT_CLASSIFICATION,
        metadata: {
          fileIdentifier: fileIdentifier.trim(),
          language: language.trim() || DEFAULT_LANGUAGE,
          dateStamp: dateStamp,
          identificationInfo: {
            title: mdTitle.trim(),
            abstract: mdAbstract.trim(),
          },
        },
      });
      setFormSuccess(`Source "${trimmedName}" registered successfully.`);
      resetForm();
      await loadSources();
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      const detail = axiosError.response?.data?.detail;
      setFormError(detail ?? "Failed to register source.");
    } finally {
      setRegistering(false);
    }
  };

  const handleDeactivate = async (source: GeospatialSourceRecord) => {
    setRowError(null);
    setPendingActionId(source.source_id);
    try {
      await deactivateGeospatialSource(source.source_id);
      await loadSources();
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      const detail = axiosError.response?.data?.detail;
      setRowError(detail ?? `Failed to deactivate "${source.source_name}".`);
    } finally {
      setPendingActionId(null);
    }
  };

  const handleActivate = async (source: GeospatialSourceRecord) => {
    setRowError(null);
    setPendingActionId(source.source_id);
    try {
      await activateGeospatialSource(source.source_id);
      await loadSources();
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      const detail = axiosError.response?.data?.detail;
      setRowError(detail ?? `Failed to reactivate "${source.source_name}".`);
    } finally {
      setPendingActionId(null);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    color: theme.colors.textPrimary,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    width: "100%",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: theme.spacing.xs,
    color: theme.colors.textSecondary,
    fontSize: "0.85rem",
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: theme.spacing.md,
  };

  const sectionHeadingStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  };

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    color: theme.colors.textSecondary,
    fontWeight: 600,
    fontSize: "0.8rem",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    fontSize: "0.875rem",
    verticalAlign: "middle",
  };

  return (
    <AppLayout>
      <PageContainer title="Geospatial Ingestion Sources">
        {/* Register form */}
        <div
          style={{
            background: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.lg,
            marginBottom: theme.spacing.xl,
          }}
        >
          <div
            style={{
              fontSize: theme.typography.h3.fontSize,
              fontWeight: theme.typography.h3.fontWeight,
              marginBottom: theme.spacing.md,
            }}
          >
            Register New Source
          </div>

          <form onSubmit={handleRegister}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: `0 ${theme.spacing.lg}`,
              }}
            >
              {/* Left column */}
              <div>
                <div style={sectionHeadingStyle}>Source</div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Source Name *</label>
                  <input
                    style={inputStyle}
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="e.g. UAV-Swarm-Feed-Alpha"
                    required
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Source Type *</label>
                  <select
                    style={inputStyle}
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                  >
                    {SUPPORTED_SOURCE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Transport</label>
                  <input
                    style={inputStyle}
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    placeholder="API"
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Classification</label>
                  <input
                    style={inputStyle}
                    value={classification}
                    onChange={(e) => setClassification(e.target.value)}
                    placeholder="UNCLASSIFIED"
                  />
                </div>
              </div>

              {/* Right column — ISO 19115 metadata */}
              <div>
                <div style={sectionHeadingStyle}>ISO 19115 Metadata</div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>File Identifier *</label>
                  <input
                    style={inputStyle}
                    value={fileIdentifier}
                    onChange={(e) => setFileIdentifier(e.target.value)}
                    placeholder="Unique identifier for this metadata record"
                    required
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: `0 ${theme.spacing.md}` }}>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Language</label>
                    <input
                      style={inputStyle}
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      placeholder="eng"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Date Stamp</label>
                    <input
                      type="date"
                      style={inputStyle}
                      value={dateStamp}
                      onChange={(e) => setDateStamp(e.target.value)}
                    />
                  </div>
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Title *</label>
                  <input
                    style={inputStyle}
                    value={mdTitle}
                    onChange={(e) => setMdTitle(e.target.value)}
                    placeholder="Human-readable title for this dataset"
                    required
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>Abstract *</label>
                  <textarea
                    style={{ ...inputStyle, resize: "vertical", minHeight: "64px" }}
                    value={mdAbstract}
                    onChange={(e) => setMdAbstract(e.target.value)}
                    placeholder="Brief description of this geospatial data source"
                    required
                  />
                </div>
              </div>
            </div>

            {formError && (
              <div
                style={{
                  color: theme.colors.danger,
                  marginBottom: theme.spacing.sm,
                  fontSize: "0.875rem",
                }}
              >
                {formError}
              </div>
            )}
            {formSuccess && (
              <div
                style={{
                  color: theme.colors.success,
                  marginBottom: theme.spacing.sm,
                  fontSize: "0.875rem",
                }}
              >
                {formSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={registering}
              style={{
                background: theme.colors.primary,
                color: "#fff",
                border: "none",
                borderRadius: theme.radius.md,
                padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                cursor: registering ? "not-allowed" : "pointer",
                opacity: registering ? 0.7 : 1,
                fontWeight: 600,
              }}
            >
              {registering ? "Registering..." : "Register Source"}
            </button>
          </form>
        </div>

        {/* Sources table */}
        <div
          style={{
            background: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: `${theme.spacing.md} ${theme.spacing.lg}`,
              borderBottom: `1px solid ${theme.colors.border}`,
            }}
          >
            <div
              style={{
                fontSize: theme.typography.h3.fontSize,
                fontWeight: theme.typography.h3.fontWeight,
              }}
            >
              Registered Sources
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: theme.spacing.xs,
                color: theme.colors.textSecondary,
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
              />
              Active only
            </label>
          </div>

          {rowError && (
            <div
              style={{
                color: theme.colors.danger,
                padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                fontSize: "0.875rem",
              }}
            >
              {rowError}
            </div>
          )}

          {loading ? (
            <div
              style={{
                padding: theme.spacing.xl,
                textAlign: "center",
                color: theme.colors.textSecondary,
              }}
            >
              Loading...
            </div>
          ) : listError ? (
            <div
              style={{
                padding: theme.spacing.xl,
                textAlign: "center",
                color: theme.colors.danger,
              }}
            >
              {listError}
            </div>
          ) : sources.length === 0 ? (
            <div
              style={{
                padding: theme.spacing.xl,
                textAlign: "center",
                color: theme.colors.textSecondary,
              }}
            >
              No sources registered.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Transport</th>
                    <th style={thStyle}>Classification</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Registered</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((src) => (
                    <tr key={src.source_id}>
                      <td style={tdStyle}>{src.source_name}</td>
                      <td style={tdStyle}>{src.source_type}</td>
                      <td style={tdStyle}>{src.transport}</td>
                      <td style={tdStyle}>{src.classification}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background: src.is_active
                              ? "rgba(34,197,94,0.15)"
                              : "rgba(239,68,68,0.15)",
                            color: src.is_active
                              ? theme.colors.success
                              : theme.colors.danger,
                          }}
                        >
                          {src.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                        {new Date(src.created_at).toLocaleDateString()}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: theme.spacing.xs, alignItems: "center" }}>
                          <button
                            type="button"
                            disabled={src.is_active || pendingActionId === src.source_id}
                            onClick={() => handleActivate(src)}
                            style={{
                              background: "transparent",
                              border: `1px solid ${theme.colors.success}`,
                              borderRadius: theme.radius.sm,
                              color: theme.colors.success,
                              cursor:
                                src.is_active || pendingActionId === src.source_id
                                  ? "not-allowed"
                                  : "pointer",
                              opacity: src.is_active || pendingActionId === src.source_id ? 0.6 : 1,
                              padding: "3px 10px",
                              fontSize: "0.8rem",
                            }}
                          >
                            {pendingActionId === src.source_id && !src.is_active
                              ? "Activating..."
                              : "Activate"}
                          </button>

                          <button
                            type="button"
                            disabled={!src.is_active || pendingActionId === src.source_id}
                            onClick={() => handleDeactivate(src)}
                            style={{
                              background: "transparent",
                              border: `1px solid ${theme.colors.danger}`,
                              borderRadius: theme.radius.sm,
                              color: theme.colors.danger,
                              cursor:
                                !src.is_active || pendingActionId === src.source_id
                                  ? "not-allowed"
                                  : "pointer",
                              opacity: !src.is_active || pendingActionId === src.source_id ? 0.6 : 1,
                              padding: "3px 10px",
                              fontSize: "0.8rem",
                            }}
                          >
                            {pendingActionId === src.source_id && src.is_active
                              ? "Deactivating..."
                              : "Deactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageContainer>
    </AppLayout>
  );
}
