import { useEffect, useMemo, useState } from "react";
import {
  getAssets,
  type AssetRecord,
} from "../../api/assets";
import {
  createJammerProfile,
  deleteJammerProfile,
  getJammerProfiles,
  updateJammerProfile,
  type JammerProfileCreate,
  type JammerProfileRecord,
} from "../../api/jammers";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import MapView from "../../components/MapView";
import DirectionFinderProfilesSection from "../../components/df/DirectionFinderProfilesSection";
import Card from "../../components/ui/Card";

export default function AssetsPage() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jammerProfiles, setJammerProfiles] = useState<JammerProfileRecord[]>([]);
  const [jammerLoading, setJammerLoading] = useState(true);
  const [jammerError, setJammerError] = useState<string | null>(null);
  const [jammerBusyAction, setJammerBusyAction] = useState<string | null>(null);
  const [selectedJammerId, setSelectedJammerId] = useState<string | null>(null);
  const [jammerForm, setJammerForm] = useState<JammerProfileCreate | null>(null);
  const [jammerValidationErrors, setJammerValidationErrors] = useState<Record<string, string>>({});

  const permissions = user?.permissions ?? [];
  const isAdmin = user?.role === "ADMIN";
  const canJammerRead =
    isAdmin ||
    permissions.includes("jammer:read") ||
    permissions.includes("jammer:*") ||
    permissions.includes("*:read") ||
    permissions.includes("*:*");
  const canJammerWrite =
    isAdmin ||
    permissions.includes("jammer:write") ||
    permissions.includes("jammer:*") ||
    permissions.includes("*:write") ||
    permissions.includes("*:*");

  const createDefaultJammerPayload = (assetId?: string): JammerProfileCreate => ({
    asset_id: assetId ?? "",
    manufacturer: "",
    model_number: "",
    variant_block: "",
    serial_number: "",
    asset_class: "JAMMER",
    jammer_subtype: "COMMUNICATIONS_JAMMER",
    mission_domain: "LAND",
    lifecycle_state: "ACTIVE_SERVICE",
    dimensions_l_m: null,
    dimensions_w_m: null,
    dimensions_h_m: null,
    weight_kg: null,
    environmental_rating: "",
    operating_temp_min_c: null,
    operating_temp_max_c: null,
    ingress_protection_rating: "",
    platform_type: "GROUND_VEHICLE",
    mounting_configuration: "",
    antenna_configuration: "",
    vehicle_power_bus_type: "",
    cooling_integration_type: "",
    time_source_interface: "",
    rf_coverage_min_mhz: 20,
    rf_coverage_max_mhz: 6000,
    max_effective_radiated_power_dbm: null,
    simultaneous_channels_max: null,
    waveform_family_support: [],
    modulation_support: [],
    geolocation_method_support: [],
    preset_technique_library_id: "",
    input_voltage_min_v: null,
    input_voltage_max_v: null,
    nominal_power_draw_w: null,
    peak_power_draw_w: null,
    battery_backup_present: false,
    battery_backup_duration_min: null,
    mtbf_hours: null,
    built_in_test_level: "",
    secure_boot_supported: false,
    tamper_detection_supported: false,
    c2_interface_profiles: [],
    ip_stack_support: [],
    message_bus_protocols: [],
    api_spec_version: "",
    data_model_standard_refs: [],
    interoperability_cert_level: "",
    spectrum_authorization_profile: "",
    emissions_control_policy_id: "",
    rules_of_employment_profile_id: "",
    geofencing_policy_id: "",
    legal_jurisdiction_tags: [],
    doctrinal_role_tags: [],
    security_classification: "SECRET",
    crypto_module_type: "",
    authn_methods_supported: [],
    authz_role_profile_id: "",
    command_authorization_level: "",
    data_at_rest_encryption: "",
    data_in_transit_encryption: "",
    audit_policy_id: "",
    secure_logging_enabled: true,
    patch_baseline_version: "",
  });

  const jammerAssets = useMemo(
    () => assets.filter((asset) => (asset.type ?? "").toUpperCase() === "JAMMER"),
    [assets]
  );

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

  const clearFieldError = (field: string) => {
    setJammerValidationErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const validateJammerForm = (form: JammerProfileCreate | null) => {
    const nextErrors: Record<string, string> = {};
    if (!form) {
      nextErrors.form = "Jammer form is not ready.";
      return nextErrors;
    }

    if (!form.asset_id) nextErrors.asset_id = "Jammer asset is required.";
    if (!form.manufacturer.trim()) nextErrors.manufacturer = "Manufacturer is required.";
    if (!form.model_number.trim()) nextErrors.model_number = "Model number is required.";
    if (!form.serial_number.trim()) nextErrors.serial_number = "Serial number is required.";
    if (!form.jammer_subtype.trim()) nextErrors.jammer_subtype = "Subtype is required.";
    if (!form.platform_type.trim()) nextErrors.platform_type = "Platform type is required.";
    if (!form.security_classification.trim()) nextErrors.security_classification = "Security classification is required.";
    if (!form.lifecycle_state.trim()) nextErrors.lifecycle_state = "Lifecycle state is required.";
    if (!form.mission_domain.trim()) nextErrors.mission_domain = "Mission domain is required.";
    if (!(form.rf_coverage_min_mhz > 0)) nextErrors.rf_coverage_min_mhz = "RF min must be greater than 0.";
    if (!(form.rf_coverage_max_mhz > 0)) nextErrors.rf_coverage_max_mhz = "RF max must be greater than 0.";
    if (form.rf_coverage_max_mhz <= form.rf_coverage_min_mhz) {
      nextErrors.rf_coverage_max_mhz = "RF max must be greater than RF min.";
    }

    return nextErrors;
  };

  const getBackendErrorMessage = (error: unknown, fallback: string) => {
    const responseData = (error as { response?: { data?: any } })?.response?.data;
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

  const loadJammerProfiles = async () => {
    if (!canJammerRead) {
      setJammerLoading(false);
      setJammerError("Forbidden: missing jammer:read permission");
      return;
    }

    try {
      setJammerLoading(true);
      setJammerError(null);
      const response = await getJammerProfiles();
      setJammerProfiles(response.data);
      if (response.data.length > 0 && !selectedJammerId) {
        const first = response.data[0];
        setSelectedJammerId(first.id);
        const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...payload } = first;
        setJammerForm(payload);
      }
    } catch (error) {
      setJammerError(getBackendErrorMessage(error, "Failed to load jammer profiles."));
    } finally {
      setJammerLoading(false);
    }
  };

  useEffect(() => {
    loadJammerProfiles();
  }, [canJammerRead]);

  useEffect(() => {
    if (jammerAssets.length === 0) {
      return;
    }

    if (!jammerForm) {
      setJammerForm(createDefaultJammerPayload(jammerAssets[0].id));
      return;
    }

    if (!jammerForm.asset_id || !jammerAssets.some((asset) => asset.id === jammerForm.asset_id)) {
      setJammerForm({ ...jammerForm, asset_id: jammerAssets[0].id });
    }
  }, [jammerAssets, jammerForm]);

  const handleJammerCreate = async () => {
    if (!canJammerWrite) {
      setJammerError("Forbidden: missing jammer:write permission");
      return;
    }
    if (!jammerForm) {
      setJammerError("Jammer form is not ready.");
      return;
    }

    const nextErrors = validateJammerForm(jammerForm);
    setJammerValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setJammerError("Please correct required fields.");
      return;
    }

    try {
      setJammerBusyAction("create");
      setJammerError(null);
      const result = await createJammerProfile(jammerForm);
      setSelectedJammerId(result.data.id);
      const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...payload } = result.data;
      setJammerForm(payload);
      setJammerValidationErrors({});
      await loadJammerProfiles();
    } catch (error) {
      setJammerError(getBackendErrorMessage(error, "Create jammer profile failed."));
    } finally {
      setJammerBusyAction(null);
    }
  };

  const handleJammerUpdate = async () => {
    if (!canJammerWrite) {
      setJammerError("Forbidden: missing jammer:write permission");
      return;
    }
    if (!selectedJammerId) {
      setJammerError("Select a jammer profile first.");
      return;
    }
    if (!jammerForm) {
      setJammerError("Jammer form is not ready.");
      return;
    }

    const nextErrors = validateJammerForm(jammerForm);
    setJammerValidationErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setJammerError("Please correct required fields.");
      return;
    }

    try {
      setJammerBusyAction("update");
      setJammerError(null);
      const { asset_id: _assetId, ...updatePayload } = jammerForm;
      await updateJammerProfile(selectedJammerId, updatePayload);
      setJammerValidationErrors({});
      await loadJammerProfiles();
    } catch (error) {
      setJammerError(getBackendErrorMessage(error, "Update jammer profile failed."));
    } finally {
      setJammerBusyAction(null);
    }
  };

  const handleJammerDelete = async () => {
    if (!canJammerWrite) {
      setJammerError("Forbidden: missing jammer:write permission");
      return;
    }
    if (!selectedJammerId) {
      setJammerError("Select a jammer profile first.");
      return;
    }

    try {
      setJammerBusyAction("delete");
      setJammerError(null);
      await deleteJammerProfile(selectedJammerId);
      const remaining = jammerProfiles.filter((item) => item.id !== selectedJammerId);
      setSelectedJammerId(remaining[0]?.id ?? null);
      if (remaining.length > 0) {
        const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...payload } = remaining[0];
        setJammerForm(payload);
      } else if (jammerAssets.length > 0) {
        setJammerForm(createDefaultJammerPayload(jammerAssets[0].id));
      }
      await loadJammerProfiles();
    } catch (error) {
      setJammerError(getBackendErrorMessage(error, "Delete jammer profile failed."));
    } finally {
      setJammerBusyAction(null);
    }
  };

  const handleJammerResetForm = () => {
    const defaultAssetId = jammerAssets[0]?.id ?? "";
    setSelectedJammerId(null);
    setJammerError(null);
    setJammerValidationErrors({});
    setJammerForm(createDefaultJammerPayload(defaultAssetId));
  };

  const handleJammerRowSelect = (profile: JammerProfileRecord) => {
    setSelectedJammerId(profile.id);
    const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...payload } = profile;
    setJammerForm(payload);
    setJammerValidationErrors({});
    setJammerError(null);
  };

  return (
    <div style={{ display: "grid", gap: theme.spacing.lg }}>
      <div>
        <h3 style={{ marginTop: 0, marginBottom: theme.spacing.xs }}>Asset Operations Center</h3>
        <div style={{ color: theme.colors.textSecondary }}>
          Manage platform assets, EW jammer profiles, and direction-finder baselines.
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

      <Card>
        <h3 style={{ marginTop: 0, marginBottom: theme.spacing.md }}>Jammer Profiles</h3>

      {!canJammerRead && (
        <div style={{ color: theme.colors.danger }}>
          Forbidden: missing jammer:read permission.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }}
          disabled={jammerBusyAction !== null || !canJammerWrite || !jammerForm}
          onClick={handleJammerCreate}
        >
          {jammerBusyAction === "create" ? "Creating..." : "Create Jammer Profile"}
        </button>
        <button
          style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }}
          disabled={jammerBusyAction !== null || !selectedJammerId || !canJammerWrite || !jammerForm}
          onClick={handleJammerUpdate}
        >
          {jammerBusyAction === "update" ? "Saving..." : "Update Selected"}
        </button>
        <button
          style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.danger, color: "#fff", cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }}
          disabled={jammerBusyAction !== null || !selectedJammerId || !canJammerWrite}
          onClick={handleJammerDelete}
        >
          {jammerBusyAction === "delete" ? "Deleting..." : "Delete Selected"}
        </button>
        <button
          style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary, cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }}
          disabled={jammerBusyAction !== null || !canJammerWrite || jammerAssets.length === 0}
          onClick={handleJammerResetForm}
        >
          Reset Form
        </button>
      </div>

      {jammerLoading && <div>Loading jammer profiles...</div>}
      {jammerError && <div style={{ color: theme.colors.danger }}>{jammerError}</div>}

      <label style={{ display: "grid", gap: 6, maxWidth: 520 }}>
        <span>Select Jammer Profile</span>
        <select
          value={selectedJammerId ?? ""}
          disabled={jammerLoading || jammerProfiles.length === 0}
          onChange={(event) => {
            const nextId = event.target.value;
            if (!nextId) {
              handleJammerResetForm();
              return;
            }
            const profile = jammerProfiles.find((item) => item.id === nextId);
            if (profile) {
              handleJammerRowSelect(profile);
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
          {jammerProfiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.manufacturer} · {profile.model_number} · {profile.serial_number}
            </option>
          ))}
        </select>
      </label>

      {jammerForm && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Jammer Asset</span>
            <select
              value={jammerForm.asset_id}
              disabled={!canJammerWrite}
              onChange={(event) => {
                setJammerForm({ ...jammerForm, asset_id: event.target.value });
                clearFieldError("asset_id");
              }}
              style={{ border: `1px solid ${jammerValidationErrors.asset_id ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
            >
              {jammerAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.name}</option>
              ))}
            </select>
            {jammerValidationErrors.asset_id && <small style={{ color: theme.colors.danger }}>{jammerValidationErrors.asset_id}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Manufacturer</span>
            <input value={jammerForm.manufacturer} disabled={!canJammerWrite} onChange={(event) => { setJammerForm({ ...jammerForm, manufacturer: event.target.value }); clearFieldError("manufacturer"); }} style={{ border: `1px solid ${jammerValidationErrors.manufacturer ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {jammerValidationErrors.manufacturer && <small style={{ color: theme.colors.danger }}>{jammerValidationErrors.manufacturer}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Model Number</span>
            <input value={jammerForm.model_number} disabled={!canJammerWrite} onChange={(event) => { setJammerForm({ ...jammerForm, model_number: event.target.value }); clearFieldError("model_number"); }} style={{ border: `1px solid ${jammerValidationErrors.model_number ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {jammerValidationErrors.model_number && <small style={{ color: theme.colors.danger }}>{jammerValidationErrors.model_number}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Serial Number</span>
            <input value={jammerForm.serial_number} disabled={!canJammerWrite} onChange={(event) => { setJammerForm({ ...jammerForm, serial_number: event.target.value }); clearFieldError("serial_number"); }} style={{ border: `1px solid ${jammerValidationErrors.serial_number ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {jammerValidationErrors.serial_number && <small style={{ color: theme.colors.danger }}>{jammerValidationErrors.serial_number}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Subtype</span>
            <input value={jammerForm.jammer_subtype} disabled={!canJammerWrite} onChange={(event) => { setJammerForm({ ...jammerForm, jammer_subtype: event.target.value }); clearFieldError("jammer_subtype"); }} style={{ border: `1px solid ${jammerValidationErrors.jammer_subtype ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {jammerValidationErrors.jammer_subtype && <small style={{ color: theme.colors.danger }}>{jammerValidationErrors.jammer_subtype}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Platform Type</span>
            <input value={jammerForm.platform_type} disabled={!canJammerWrite} onChange={(event) => { setJammerForm({ ...jammerForm, platform_type: event.target.value }); clearFieldError("platform_type"); }} style={{ border: `1px solid ${jammerValidationErrors.platform_type ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {jammerValidationErrors.platform_type && <small style={{ color: theme.colors.danger }}>{jammerValidationErrors.platform_type}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>RF Min (MHz)</span>
            <input type="number" value={jammerForm.rf_coverage_min_mhz} disabled={!canJammerWrite} onChange={(event) => { setJammerForm({ ...jammerForm, rf_coverage_min_mhz: Number(event.target.value) || 0 }); clearFieldError("rf_coverage_min_mhz"); clearFieldError("rf_coverage_max_mhz"); }} style={{ border: `1px solid ${jammerValidationErrors.rf_coverage_min_mhz ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {jammerValidationErrors.rf_coverage_min_mhz && <small style={{ color: theme.colors.danger }}>{jammerValidationErrors.rf_coverage_min_mhz}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>RF Max (MHz)</span>
            <input type="number" value={jammerForm.rf_coverage_max_mhz} disabled={!canJammerWrite} onChange={(event) => { setJammerForm({ ...jammerForm, rf_coverage_max_mhz: Number(event.target.value) || 0 }); clearFieldError("rf_coverage_max_mhz"); }} style={{ border: `1px solid ${jammerValidationErrors.rf_coverage_max_mhz ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {jammerValidationErrors.rf_coverage_max_mhz && <small style={{ color: theme.colors.danger }}>{jammerValidationErrors.rf_coverage_max_mhz}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>ERP (dBm)</span>
            <input type="number" value={jammerForm.max_effective_radiated_power_dbm ?? ""} disabled={!canJammerWrite} onChange={(event) => setJammerForm({ ...jammerForm, max_effective_radiated_power_dbm: parseNullableNumber(event.target.value) })} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Security Classification</span>
            <input value={jammerForm.security_classification} disabled={!canJammerWrite} onChange={(event) => { setJammerForm({ ...jammerForm, security_classification: event.target.value }); clearFieldError("security_classification"); }} style={{ border: `1px solid ${jammerValidationErrors.security_classification ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {jammerValidationErrors.security_classification && <small style={{ color: theme.colors.danger }}>{jammerValidationErrors.security_classification}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Lifecycle State</span>
            <input value={jammerForm.lifecycle_state} disabled={!canJammerWrite} onChange={(event) => { setJammerForm({ ...jammerForm, lifecycle_state: event.target.value }); clearFieldError("lifecycle_state"); }} style={{ border: `1px solid ${jammerValidationErrors.lifecycle_state ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {jammerValidationErrors.lifecycle_state && <small style={{ color: theme.colors.danger }}>{jammerValidationErrors.lifecycle_state}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Mission Domain</span>
            <input value={jammerForm.mission_domain} disabled={!canJammerWrite} onChange={(event) => { setJammerForm({ ...jammerForm, mission_domain: event.target.value }); clearFieldError("mission_domain"); }} style={{ border: `1px solid ${jammerValidationErrors.mission_domain ? theme.colors.danger : theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
            {jammerValidationErrors.mission_domain && <small style={{ color: theme.colors.danger }}>{jammerValidationErrors.mission_domain}</small>}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Waveform Families (comma separated)</span>
            <input value={listToText(jammerForm.waveform_family_support)} disabled={!canJammerWrite} onChange={(event) => setJammerForm({ ...jammerForm, waveform_family_support: textToList(event.target.value) })} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Modulations (comma separated)</span>
            <input value={listToText(jammerForm.modulation_support)} disabled={!canJammerWrite} onChange={(event) => setJammerForm({ ...jammerForm, modulation_support: textToList(event.target.value) })} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>C2 Profiles (comma separated)</span>
            <input value={listToText(jammerForm.c2_interface_profiles)} disabled={!canJammerWrite} onChange={(event) => setJammerForm({ ...jammerForm, c2_interface_profiles: textToList(event.target.value) })} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Patch Baseline</span>
            <input value={jammerForm.patch_baseline_version ?? ""} disabled={!canJammerWrite} onChange={(event) => setJammerForm({ ...jammerForm, patch_baseline_version: event.target.value })} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.sm, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }} />
          </label>

          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={jammerForm.battery_backup_present} disabled={!canJammerWrite} onChange={(event) => setJammerForm({ ...jammerForm, battery_backup_present: event.target.checked })} />
            Battery Backup Present
          </label>

          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={jammerForm.secure_logging_enabled} disabled={!canJammerWrite} onChange={(event) => setJammerForm({ ...jammerForm, secure_logging_enabled: event.target.checked })} />
            Secure Logging Enabled
          </label>
        </div>
      )}

      {canJammerRead && jammerAssets.length === 0 && (
        <div style={{ color: theme.colors.warning }}>
          No assets with type JAMMER found. Create or import a JAMMER asset first.
        </div>
      )}

      </Card>

      <Card>
        <DirectionFinderProfilesSection assets={assets} />
      </Card>
    </div>
  );
}
