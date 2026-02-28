import { useEffect, useMemo, useState } from "react";
import type { AssetRecord } from "../../api/assets";
import {
  createDirectionFinderProfile,
  deleteDirectionFinderProfile,
  exportDirectionFindersCsv,
  exportDirectionFindersXml,
  getDirectionFinderProfiles,
  importDirectionFindersCsv,
  importDirectionFindersXml,
  updateDirectionFinderProfile,
  type DirectionFinderProfileCreate,
  type DirectionFinderProfileRecord,
} from "../../api/directionFinders";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

type Props = {
  assets: AssetRecord[];
};

export default function DirectionFinderProfilesSection({ assets }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [profiles, setProfiles] = useState<DirectionFinderProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<DirectionFinderProfileCreate | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const permissions = user?.permissions ?? [];
  const isAdmin = user?.role === "ADMIN";
  const canRead =
    isAdmin ||
    permissions.includes("direction_finder:read") ||
    permissions.includes("direction_finder:*") ||
    permissions.includes("*:read") ||
    permissions.includes("*:*");
  const canWrite =
    isAdmin ||
    permissions.includes("direction_finder:write") ||
    permissions.includes("direction_finder:*") ||
    permissions.includes("*:write") ||
    permissions.includes("*:*");

  const dfAssets = useMemo(
    () => assets.filter((asset) => (asset.type ?? "").toUpperCase() === "DIRECTION_FINDER"),
    [assets]
  );

  const defaultPayload = (assetId = ""): DirectionFinderProfileCreate => ({
    asset_id: assetId,
    manufacturer: "",
    model_number: "",
    variant_block: "",
    serial_number: "",
    platform_class: "FIXED_SITE",
    mobility_class: "FIXED",
    mission_domain: "LAND",
    lifecycle_state: "ACTIVE_SERVICE",
    antenna_array_type: "CIRCULAR_ARRAY",
    antenna_element_count: 8,
    antenna_polarization_support: [],
    receiver_channel_count: 4,
    sample_rate_max_sps: null,
    frequency_reference_type: "",
    frequency_reference_accuracy_ppb: null,
    timing_holdover_seconds: null,
    rf_min_mhz: 20,
    rf_max_mhz: 6000,
    instantaneous_bandwidth_hz: null,
    df_methods_supported: [],
    bearing_accuracy_deg_rms: null,
    bearing_output_reference: "TRUE_NORTH_CLOCKWISE",
    sensitivity_dbm: null,
    dynamic_range_db: null,
    calibration_profile_id: "",
    deployment_mode: "",
    site_id: "",
    mount_height_agl_m: null,
    sensor_boresight_offset_deg: null,
    heading_alignment_offset_deg: null,
    lever_arm_offset_m: {},
    geodetic_datum: "WGS84",
    altitude_reference: "MSL",
    survey_position_accuracy_m: null,
    network_node_id: "",
    primary_ipv4: "",
    transport_protocols: [],
    message_protocols: [],
    data_format_profiles: [],
    time_sync_protocol: "",
    ptp_profile: "",
    api_version: "",
    interoperability_profile: "",
    security_classification: "SECRET",
    releasability_marking: "",
    authz_policy_id: "",
    data_in_transit_encryption: "",
    secure_boot_enabled: true,
    audit_policy_id: "",
    firmware_version: "",
    software_stack_version: "",
    configuration_baseline_id: "",
    calibration_due_date: "",
    mtbf_hours: null,
    maintenance_echelon: "",
  });

  const listToText = (items: string[]) => items.join(", ");
  const textToList = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const parseNullableNumber = (value: string) => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const getBackendErrorMessage = (errorValue: unknown, fallback: string) => {
    const responseData = (errorValue as { response?: { data?: any } })?.response?.data;
    const detail = responseData?.detail ?? responseData;

    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item?.msg) return item.msg;
          return JSON.stringify(item);
        })
        .join("; ");
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    return fallback;
  };

  const clearFieldError = (field: string) => {
    setValidationErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const validateForm = (candidate: DirectionFinderProfileCreate | null) => {
    const next: Record<string, string> = {};
    if (!candidate) {
      next.form = "Direction finder form is not ready.";
      return next;
    }

    if (!candidate.asset_id) next.asset_id = "Direction finder asset is required.";
    if (!candidate.manufacturer.trim()) next.manufacturer = "Manufacturer is required.";
    if (!candidate.model_number.trim()) next.model_number = "Model number is required.";
    if (!candidate.serial_number.trim()) next.serial_number = "Serial number is required.";
    if (!candidate.platform_class.trim()) next.platform_class = "Platform class is required.";
    if (!candidate.mobility_class.trim()) next.mobility_class = "Mobility class is required.";
    if (!candidate.antenna_array_type.trim()) next.antenna_array_type = "Antenna array type is required.";
    if (!candidate.security_classification.trim()) next.security_classification = "Security classification is required.";
    if (!(candidate.rf_min_mhz > 0)) next.rf_min_mhz = "RF min must be greater than 0.";
    if (!(candidate.rf_max_mhz > 0)) next.rf_max_mhz = "RF max must be greater than 0.";
    if (candidate.rf_max_mhz <= candidate.rf_min_mhz) {
      next.rf_max_mhz = "RF max must be greater than RF min.";
    }

    return next;
  };

  const loadProfiles = async () => {
    if (!canRead) {
      setLoading(false);
      setError("Forbidden: missing direction_finder:read permission");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      const response = await getDirectionFinderProfiles();
      setProfiles(response.data);
      if (response.data.length > 0 && !selectedId) {
        const first = response.data[0];
        setSelectedId(first.id);
        const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...payload } = first;
        setForm(payload);
      }
    } catch (errorValue) {
      setError(getBackendErrorMessage(errorValue, "Failed to load direction finder profiles."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, [canRead]);

  useEffect(() => {
    if (dfAssets.length === 0) return;
    if (!form) {
      setForm(defaultPayload(dfAssets[0].id));
      return;
    }
    if (!form.asset_id || !dfAssets.some((asset) => asset.id === form.asset_id)) {
      setForm({ ...form, asset_id: dfAssets[0].id });
    }
  }, [dfAssets, form]);

  const handleCreate = async () => {
    if (!canWrite) {
      setError("Forbidden: missing direction_finder:write permission");
      return;
    }
    const next = validateForm(form);
    setValidationErrors(next);
    if (Object.keys(next).length > 0) {
      setError("Please correct required fields.");
      return;
    }

    try {
      setBusyAction("create");
      setError(null);
      setSuccessMessage(null);
      if (!form) return;
      const result = await createDirectionFinderProfile(form);
      setSelectedId(result.data.id);
      const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...payload } = result.data;
      setForm(payload);
      setValidationErrors({});
      await loadProfiles();
      setSuccessMessage("Direction finder profile created successfully.");
    } catch (errorValue) {
      setError(getBackendErrorMessage(errorValue, "Create direction finder profile failed."));
    } finally {
      setBusyAction(null);
    }
  };

  const handleUpdate = async () => {
    if (!canWrite) {
      setError("Forbidden: missing direction_finder:write permission");
      return;
    }
    if (!selectedId || !form) {
      setError("Select a direction finder profile first.");
      return;
    }

    const next = validateForm(form);
    setValidationErrors(next);
    if (Object.keys(next).length > 0) {
      setError("Please correct required fields.");
      return;
    }

    try {
      setBusyAction("update");
      setError(null);
      setSuccessMessage(null);
      const { asset_id: _assetId, ...payload } = form;
      await updateDirectionFinderProfile(selectedId, payload);
      setValidationErrors({});
      await loadProfiles();
      setSuccessMessage("Direction finder profile updated successfully.");
    } catch (errorValue) {
      setError(getBackendErrorMessage(errorValue, "Update direction finder profile failed."));
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async () => {
    if (!canWrite) {
      setError("Forbidden: missing direction_finder:write permission");
      return;
    }
    if (!selectedId) {
      setError("Select a direction finder profile first.");
      return;
    }

    try {
      setBusyAction("delete");
      setError(null);
      setSuccessMessage(null);
      await deleteDirectionFinderProfile(selectedId);
      const remaining = profiles.filter((item) => item.id !== selectedId);
      setSelectedId(remaining[0]?.id ?? null);
      if (remaining.length > 0) {
        const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...payload } = remaining[0];
        setForm(payload);
      } else if (dfAssets.length > 0) {
        setForm(defaultPayload(dfAssets[0].id));
      }
      await loadProfiles();
      setSuccessMessage("Direction finder profile deleted successfully.");
    } catch (errorValue) {
      setError(getBackendErrorMessage(errorValue, "Delete direction finder profile failed."));
    } finally {
      setBusyAction(null);
    }
  };

  const handleReset = () => {
    const defaultAssetId = dfAssets[0]?.id ?? "";
    setSelectedId(null);
    setError(null);
    setSuccessMessage(null);
    setValidationErrors({});
    setForm(defaultPayload(defaultAssetId));
  };

  const handleExportCsv = async () => {
    if (!canRead) {
      setError("Forbidden: missing direction_finder:read permission");
      return;
    }

    try {
      setBusyAction("export-csv");
      setError(null);
      setSuccessMessage(null);
      const response = await exportDirectionFindersCsv();
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "direction_finders.csv";
      anchor.click();
      URL.revokeObjectURL(url);
      setSuccessMessage("Direction finder profiles exported as CSV.");
    } catch (errorValue) {
      setError(getBackendErrorMessage(errorValue, "Direction finder CSV export failed."));
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportXml = async () => {
    if (!canRead) {
      setError("Forbidden: missing direction_finder:read permission");
      return;
    }

    try {
      setBusyAction("export-xml");
      setError(null);
      setSuccessMessage(null);
      const response = await exportDirectionFindersXml();
      const blob = new Blob([response.data], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "direction_finders.xml";
      anchor.click();
      URL.revokeObjectURL(url);
      setSuccessMessage("Direction finder profiles exported as XML.");
    } catch (errorValue) {
      setError(getBackendErrorMessage(errorValue, "Direction finder XML export failed."));
    } finally {
      setBusyAction(null);
    }
  };

  const handleImportCsv = async (file?: File) => {
    if (!file) return;
    if (!canWrite) {
      setError("Forbidden: missing direction_finder:write permission");
      return;
    }

    try {
      setBusyAction("import-csv");
      setError(null);
      setSuccessMessage(null);
      const response = await importDirectionFindersCsv(file);
      await loadProfiles();
      const imported = response?.data?.imported;
      setSuccessMessage(
        typeof imported === "number"
          ? `Imported ${imported} direction finder profiles from CSV.`
          : "Direction finder CSV import completed."
      );
    } catch (errorValue) {
      setError(getBackendErrorMessage(errorValue, "Direction finder CSV import failed."));
    } finally {
      setBusyAction(null);
    }
  };

  const handleImportXml = async (file?: File) => {
    if (!file) return;
    if (!canWrite) {
      setError("Forbidden: missing direction_finder:write permission");
      return;
    }

    try {
      setBusyAction("import-xml");
      setError(null);
      setSuccessMessage(null);
      const response = await importDirectionFindersXml(file);
      await loadProfiles();
      const imported = response?.data?.imported;
      setSuccessMessage(
        typeof imported === "number"
          ? `Imported ${imported} direction finder profiles from XML.`
          : "Direction finder XML import completed."
      );
    } catch (errorValue) {
      setError(getBackendErrorMessage(errorValue, "Direction finder XML import failed."));
    } finally {
      setBusyAction(null);
    }
  };

  const handleSelect = (profile: DirectionFinderProfileRecord) => {
    setSelectedId(profile.id);
    const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...payload } = profile;
    setForm(payload);
    setValidationErrors({});
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <>
      <h3 style={{ marginTop: 0, marginBottom: theme.spacing.md }}>Direction Finder Profiles</h3>

      {!canRead && (
        <div style={{ color: theme.colors.danger }}>
          Forbidden: missing direction_finder:read permission.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }}
          disabled={busyAction !== null || !canWrite || !form}
          onClick={handleCreate}
        >
          {busyAction === "create" ? "Creating..." : "Create DF Profile"}
        </button>
        <button
          style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }}
          disabled={busyAction !== null || !selectedId || !canWrite || !form}
          onClick={handleUpdate}
        >
          {busyAction === "update" ? "Saving..." : "Update Selected"}
        </button>
        <button
          style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.danger, color: "#fff", cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }}
          disabled={busyAction !== null || !selectedId || !canWrite}
          onClick={handleDelete}
        >
          {busyAction === "delete" ? "Deleting..." : "Delete Selected"}
        </button>
        <button
          style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary, cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }}
          disabled={busyAction !== null || !canWrite || dfAssets.length === 0}
          onClick={handleReset}
        >
          Reset Form
        </button>
        <button
          style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }}
          disabled={busyAction !== null || !canRead}
          onClick={handleExportCsv}
        >
          {busyAction === "export-csv" ? "Exporting..." : "Export CSV"}
        </button>
        <button
          style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }}
          disabled={busyAction !== null || !canRead}
          onClick={handleExportXml}
        >
          {busyAction === "export-xml" ? "Exporting..." : "Export XML"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label>
          Import CSV
          <input
            style={{ marginLeft: theme.spacing.sm }}
            type="file"
            accept=".csv"
            disabled={busyAction !== null || !canWrite}
            onChange={(event) => {
              handleImportCsv(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <label>
          Import XML
          <input
            style={{ marginLeft: theme.spacing.sm }}
            type="file"
            accept=".xml"
            disabled={busyAction !== null || !canWrite}
            onChange={(event) => {
              handleImportXml(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      {loading && <div>Loading direction finder profiles...</div>}
      {error && <div style={{ color: theme.colors.danger }}>{error}</div>}
      {successMessage && <div style={{ color: theme.colors.success }}>{successMessage}</div>}

      <label style={{ display: "grid", gap: 6, maxWidth: 520 }}>
        <span>Select DF Profile</span>
        <select
          value={selectedId ?? ""}
          disabled={loading || profiles.length === 0}
          onChange={(event) => {
            const nextId = event.target.value;
            if (!nextId) {
              handleReset();
              return;
            }
            const profile = profiles.find((item) => item.id === nextId);
            if (profile) {
              handleSelect(profile);
            }
          }}
          style={{
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.sm,
            background: theme.colors.surfaceAlt,
            color: theme.colors.textPrimary,
          }}
        >
          <option value="">New profile</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.manufacturer} · {profile.model_number} · {profile.serial_number}
            </option>
          ))}
        </select>
      </label>

      {form && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Direction Finder Asset</span>
            <select
              value={form.asset_id}
              disabled={!canWrite}
              onChange={(event) => {
                setForm({ ...form, asset_id: event.target.value });
                clearFieldError("asset_id");
              }}
              style={{ border: `1px solid ${validationErrors.asset_id ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
            >
              {dfAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.name}</option>
              ))}
            </select>
            {validationErrors.asset_id && <small style={{ color: theme.colors.danger }}>{validationErrors.asset_id}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Manufacturer</span>
            <input value={form.manufacturer} disabled={!canWrite} onChange={(event) => { setForm({ ...form, manufacturer: event.target.value }); clearFieldError("manufacturer"); }} style={{ border: `1px solid ${validationErrors.manufacturer ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {validationErrors.manufacturer && <small style={{ color: theme.colors.danger }}>{validationErrors.manufacturer}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Model Number</span>
            <input value={form.model_number} disabled={!canWrite} onChange={(event) => { setForm({ ...form, model_number: event.target.value }); clearFieldError("model_number"); }} style={{ border: `1px solid ${validationErrors.model_number ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {validationErrors.model_number && <small style={{ color: theme.colors.danger }}>{validationErrors.model_number}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Serial Number</span>
            <input value={form.serial_number} disabled={!canWrite} onChange={(event) => { setForm({ ...form, serial_number: event.target.value }); clearFieldError("serial_number"); }} style={{ border: `1px solid ${validationErrors.serial_number ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {validationErrors.serial_number && <small style={{ color: theme.colors.danger }}>{validationErrors.serial_number}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Platform Class</span>
            <input value={form.platform_class} disabled={!canWrite} onChange={(event) => { setForm({ ...form, platform_class: event.target.value }); clearFieldError("platform_class"); }} style={{ border: `1px solid ${validationErrors.platform_class ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {validationErrors.platform_class && <small style={{ color: theme.colors.danger }}>{validationErrors.platform_class}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Mobility Class</span>
            <input value={form.mobility_class} disabled={!canWrite} onChange={(event) => { setForm({ ...form, mobility_class: event.target.value }); clearFieldError("mobility_class"); }} style={{ border: `1px solid ${validationErrors.mobility_class ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {validationErrors.mobility_class && <small style={{ color: theme.colors.danger }}>{validationErrors.mobility_class}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Antenna Array Type</span>
            <input value={form.antenna_array_type} disabled={!canWrite} onChange={(event) => { setForm({ ...form, antenna_array_type: event.target.value }); clearFieldError("antenna_array_type"); }} style={{ border: `1px solid ${validationErrors.antenna_array_type ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {validationErrors.antenna_array_type && <small style={{ color: theme.colors.danger }}>{validationErrors.antenna_array_type}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>RF Min (MHz)</span>
            <input type="number" value={form.rf_min_mhz} disabled={!canWrite} onChange={(event) => { setForm({ ...form, rf_min_mhz: Number(event.target.value) || 0 }); clearFieldError("rf_min_mhz"); clearFieldError("rf_max_mhz"); }} style={{ border: `1px solid ${validationErrors.rf_min_mhz ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {validationErrors.rf_min_mhz && <small style={{ color: theme.colors.danger }}>{validationErrors.rf_min_mhz}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>RF Max (MHz)</span>
            <input type="number" value={form.rf_max_mhz} disabled={!canWrite} onChange={(event) => { setForm({ ...form, rf_max_mhz: Number(event.target.value) || 0 }); clearFieldError("rf_max_mhz"); }} style={{ border: `1px solid ${validationErrors.rf_max_mhz ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {validationErrors.rf_max_mhz && <small style={{ color: theme.colors.danger }}>{validationErrors.rf_max_mhz}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Bearing RMS (deg)</span>
            <input type="number" value={form.bearing_accuracy_deg_rms ?? ""} disabled={!canWrite} onChange={(event) => setForm({ ...form, bearing_accuracy_deg_rms: parseNullableNumber(event.target.value) })} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Mission Domain</span>
            <input value={form.mission_domain} disabled={!canWrite} onChange={(event) => setForm({ ...form, mission_domain: event.target.value })} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Security Classification</span>
            <input value={form.security_classification} disabled={!canWrite} onChange={(event) => { setForm({ ...form, security_classification: event.target.value }); clearFieldError("security_classification"); }} style={{ border: `1px solid ${validationErrors.security_classification ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {validationErrors.security_classification && <small style={{ color: theme.colors.danger }}>{validationErrors.security_classification}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Time Sync Protocol</span>
            <input value={form.time_sync_protocol ?? ""} disabled={!canWrite} onChange={(event) => setForm({ ...form, time_sync_protocol: event.target.value })} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>DF Methods (comma separated)</span>
            <input value={listToText(form.df_methods_supported)} disabled={!canWrite} onChange={(event) => setForm({ ...form, df_methods_supported: textToList(event.target.value) })} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Message Protocols (comma separated)</span>
            <input value={listToText(form.message_protocols)} disabled={!canWrite} onChange={(event) => setForm({ ...form, message_protocols: textToList(event.target.value) })} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
          </label>

          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={form.secure_boot_enabled} disabled={!canWrite} onChange={(event) => setForm({ ...form, secure_boot_enabled: event.target.checked })} />
            Secure Boot Enabled
          </label>
        </div>
      )}

      {canRead && dfAssets.length === 0 && (
        <div style={{ color: theme.colors.warning }}>
          No assets with type DIRECTION_FINDER found. Create or import one first.
        </div>
      )}
    </>
  );
}
