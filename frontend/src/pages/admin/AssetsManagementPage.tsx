import { useEffect, useMemo, useState } from "react";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import { useTheme } from "../../context/ThemeContext";
import {
  createAsset,
  createJammerProfile,
  deleteAsset,
  getAssets,
  getJammerProfiles,
  updateAsset,
  updateJammerProfile,
  type AssetRecord,
  type JammerProfileRecord,
} from "../../api/assets";
import {
  createDirectionFinderProfile,
  getDirectionFinderProfiles,
  updateDirectionFinderProfile,
  type DirectionFinderProfileRecord,
} from "../../api/directionFinders";

const ASSET_TYPE_OPTIONS = [
  { label: "C2 Node", value: "C2_NODE" },
  { label: "Direction Finder", value: "DIRECTION_FINDER" },
  { label: "Jammer", value: "JAMMER" },
] as const;
type AssetTypeOption = (typeof ASSET_TYPE_OPTIONS)[number]["value"];

const normalizeAssetType = (value: string | null | undefined) => {
  const normalized = (value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  const condensed = normalized.replace(/_/g, "");

  if (condensed === "DF" || condensed === "DIRECTIONFINDER") {
    return "DIRECTION_FINDER";
  }
  if (condensed === "C2" || condensed === "C2NODE") {
    return "C2_NODE";
  }
  if (condensed === "JAMMER") {
    return "JAMMER";
  }
  return normalized;
};

const metersToKmInput = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "";
  }
  const kmValue = value / 1000;
  return Number.isInteger(kmValue) ? String(kmValue) : String(Number(kmValue.toFixed(3)));
};

const kmInputToMeters = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed * 1000;
};

export default function AssetsManagementPage() {
  const { theme } = useTheme();
  const [assetType, setAssetType] = useState<AssetTypeOption>("C2_NODE");
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [directionFinderProfiles, setDirectionFinderProfiles] = useState<DirectionFinderProfileRecord[]>([]);
  const [jammerProfiles, setJammerProfiles] = useState<JammerProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isDirectionFinderSelected = assetType === "DIRECTION_FINDER";
  const isJammerSelected = assetType === "JAMMER";
  const isC2Selected = assetType === "C2_NODE";

  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [c2Status, setC2Status] = useState("ACTIVE");
  const [heightM, setHeightM] = useState("");
  const [rangeM, setRangeM] = useState("");
  const [bearingDeg, setBearingDeg] = useState("");
  const [fovDeg, setFovDeg] = useState("");
  const [dfManufacturer, setDfManufacturer] = useState("");
  const [dfModelNumber, setDfModelNumber] = useState("");
  const [dfSerialNumber, setDfSerialNumber] = useState("");
  const [dfPlatformClass, setDfPlatformClass] = useState("");
  const [dfMobilityClass, setDfMobilityClass] = useState("");
  const [dfMissionDomain, setDfMissionDomain] = useState("");
  const [dfAntennaArrayType, setDfAntennaArrayType] = useState("");
  const [dfRfMinMhz, setDfRfMinMhz] = useState("");
  const [dfRfMaxMhz, setDfRfMaxMhz] = useState("");
  const [dfSecurityClassification, setDfSecurityClassification] = useState("");

  const [jammerManufacturer, setJammerManufacturer] = useState("");
  const [jammerModelNumber, setJammerModelNumber] = useState("");
  const [jammerSerialNumber, setJammerSerialNumber] = useState("");
  const [jammerSubtype, setJammerSubtype] = useState("");
  const [jammerMissionDomain, setJammerMissionDomain] = useState("");
  const [jammerPlatformType, setJammerPlatformType] = useState("");
  const [jammerIpAddress, setJammerIpAddress] = useState("");
  const [jammerPort, setJammerPort] = useState("");
  const [jammerRfMinMhz, setJammerRfMinMhz] = useState("");
  const [jammerRfMaxMhz, setJammerRfMaxMhz] = useState("");
  const [jammerSecurityClassification, setJammerSecurityClassification] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingLatitude, setEditingLatitude] = useState("");
  const [editingLongitude, setEditingLongitude] = useState("");
  const [editingC2Status, setEditingC2Status] = useState("ACTIVE");
  const [editingHeightM, setEditingHeightM] = useState("");
  const [editingRangeM, setEditingRangeM] = useState("");
  const [editingBearingDeg, setEditingBearingDeg] = useState("");
  const [editingFovDeg, setEditingFovDeg] = useState("");
  const [editingDfManufacturer, setEditingDfManufacturer] = useState("");
  const [editingDfModelNumber, setEditingDfModelNumber] = useState("");
  const [editingDfSerialNumber, setEditingDfSerialNumber] = useState("");
  const [editingDfPlatformClass, setEditingDfPlatformClass] = useState("");
  const [editingDfMobilityClass, setEditingDfMobilityClass] = useState("");
  const [editingDfMissionDomain, setEditingDfMissionDomain] = useState("");
  const [editingDfAntennaArrayType, setEditingDfAntennaArrayType] = useState("");
  const [editingDfRfMinMhz, setEditingDfRfMinMhz] = useState("");
  const [editingDfRfMaxMhz, setEditingDfRfMaxMhz] = useState("");
  const [editingDfSecurityClassification, setEditingDfSecurityClassification] = useState("");

  const [editingJammerManufacturer, setEditingJammerManufacturer] = useState("");
  const [editingJammerModelNumber, setEditingJammerModelNumber] = useState("");
  const [editingJammerSerialNumber, setEditingJammerSerialNumber] = useState("");
  const [editingJammerSubtype, setEditingJammerSubtype] = useState("");
  const [editingJammerMissionDomain, setEditingJammerMissionDomain] = useState("");
  const [editingJammerPlatformType, setEditingJammerPlatformType] = useState("");
  const [editingJammerIpAddress, setEditingJammerIpAddress] = useState("");
  const [editingJammerPort, setEditingJammerPort] = useState("");
  const [editingJammerRfMinMhz, setEditingJammerRfMinMhz] = useState("");
  const [editingJammerRfMaxMhz, setEditingJammerRfMaxMhz] = useState("");
  const [editingJammerSecurityClassification, setEditingJammerSecurityClassification] = useState("");
  const [savingAssetId, setSavingAssetId] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

  const directionFinderProfileByAssetId = useMemo(
    () =>
      directionFinderProfiles.reduce((acc, profile) => {
        acc[profile.asset_id] = profile;
        return acc;
      }, {} as Record<string, DirectionFinderProfileRecord>),
    [directionFinderProfiles]
  );

  const jammerProfileByAssetId = useMemo(
    () =>
      jammerProfiles.reduce((acc, profile) => {
        acc[profile.asset_id] = profile;
        return acc;
      }, {} as Record<string, JammerProfileRecord>),
    [jammerProfiles]
  );

  const loadAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      const [assetsResponse, directionFinderProfilesResponse, jammerProfilesResponse] = await Promise.all([
        getAssets(),
        getDirectionFinderProfiles(),
        getJammerProfiles(),
      ]);
      setAssets(assetsResponse.data);
      setDirectionFinderProfiles(directionFinderProfilesResponse.data);
      setJammerProfiles(jammerProfilesResponse.data);
    } catch {
      setError("Failed to load assets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const filteredAssets = useMemo(
    () =>
      assets.filter(
        (asset) => normalizeAssetType(asset.type) === assetType
      ),
    [assets, assetType]
  );

  const editingAsset = useMemo(
    () => filteredAssets.find((asset) => asset.id === editingAssetId) ?? null,
    [filteredAssets, editingAssetId]
  );

  const clearCreateForm = () => {
    setName("");
    setLatitude("");
    setLongitude("");
    setC2Status("ACTIVE");
    setHeightM("");
    setRangeM("");
    setBearingDeg("");
    setFovDeg("");
    setDfManufacturer("");
    setDfModelNumber("");
    setDfSerialNumber("");
    setDfPlatformClass("");
    setDfMobilityClass("");
    setDfMissionDomain("");
    setDfAntennaArrayType("");
    setDfRfMinMhz("");
    setDfRfMaxMhz("");
    setDfSecurityClassification("");

    setJammerManufacturer("");
    setJammerModelNumber("");
    setJammerSerialNumber("");
    setJammerSubtype("");
    setJammerMissionDomain("");
    setJammerPlatformType("");
    setJammerIpAddress("");
    setJammerPort("");
    setJammerRfMinMhz("");
    setJammerRfMaxMhz("");
    setJammerSecurityClassification("");
  };

  const validateRequired = (values: string[]) => values.every((value) => value.trim() !== "");

  const handleCreateAsset = async () => {
    if (!validateRequired([name, latitude, longitude])) {
      setError("Name, Lat, and Long are mandatory.");
      return;
    }

    if (isDirectionFinderSelected) {
      if (
        !validateRequired([
          dfManufacturer,
          dfModelNumber,
          dfSerialNumber,
          dfPlatformClass,
          dfMobilityClass,
          dfMissionDomain,
          dfAntennaArrayType,
          dfRfMinMhz,
          dfRfMaxMhz,
          dfSecurityClassification,
        ])
      ) {
        setError("Direction Finder fields are mandatory.");
        return;
      }
    } else if (isJammerSelected) {
      if (
        !validateRequired([
          jammerManufacturer,
          jammerModelNumber,
          jammerSerialNumber,
          jammerSubtype,
          jammerMissionDomain,
          jammerPlatformType,
          jammerIpAddress,
          jammerPort,
          jammerRfMinMhz,
          jammerRfMaxMhz,
          jammerSecurityClassification,
        ])
      ) {
        setError("Jammer fields are mandatory.");
        return;
      }
    } else if (!validateRequired([heightM, bearingDeg, fovDeg])) {
      setError("Height, Bearing, and FOV are mandatory for C2 Node.");
      return;
    }

    if (!validateRequired([rangeM])) {
      setError("Circle Range (km) is mandatory.");
      return;
    }

    try {
      setCreating(true);
      setError(null);
      setSuccess(null);
      const createdAsset = await createAsset({
        name: name.trim(),
        type: assetType,
        status: isC2Selected ? c2Status : "ACTIVE",
        latitude: Number(latitude),
        longitude: Number(longitude),
        height_m: isC2Selected ? Number(heightM) : undefined,
        range_m: kmInputToMeters(rangeM),
        bearing_deg: isC2Selected ? Number(bearingDeg) : undefined,
        fov_deg: isC2Selected ? Number(fovDeg) : undefined,
      });

      if (isDirectionFinderSelected) {
        try {
          await createDirectionFinderProfile({
            asset_id: createdAsset.data.id,
            manufacturer: dfManufacturer.trim(),
            model_number: dfModelNumber.trim(),
            serial_number: dfSerialNumber.trim(),
            platform_class: dfPlatformClass.trim(),
            mobility_class: dfMobilityClass.trim(),
            mission_domain: dfMissionDomain.trim(),
            lifecycle_state: "ACTIVE_SERVICE",
            antenna_array_type: dfAntennaArrayType.trim(),
            rf_min_mhz: Number(dfRfMinMhz),
            rf_max_mhz: Number(dfRfMaxMhz),
            security_classification: dfSecurityClassification.trim(),
            antenna_polarization_support: [],
            df_methods_supported: [],
            lever_arm_offset_m: {},
            transport_protocols: [],
            message_protocols: [],
            data_format_profiles: [],
            geodetic_datum: "WGS84",
            altitude_reference: "MSL",
            secure_boot_enabled: true,
          });
        } catch {
          await deleteAsset(createdAsset.data.id);
          throw new Error("Failed to add direction finder configuration.");
        }
      } else if (isJammerSelected) {
        try {
          await createJammerProfile({
            asset_id: createdAsset.data.id,
            manufacturer: jammerManufacturer.trim(),
            model_number: jammerModelNumber.trim(),
            serial_number: jammerSerialNumber.trim(),
            jammer_subtype: jammerSubtype.trim(),
            mission_domain: jammerMissionDomain.trim(),
            platform_type: jammerPlatformType.trim(),
            ip_address: jammerIpAddress.trim(),
            port: Number(jammerPort),
            rf_coverage_min_mhz: Number(jammerRfMinMhz),
            rf_coverage_max_mhz: Number(jammerRfMaxMhz),
            security_classification: jammerSecurityClassification.trim(),
          });
        } catch {
          await deleteAsset(createdAsset.data.id);
          throw new Error("Failed to add jammer configuration.");
        }
      }

      setSuccess("Asset added successfully.");
      clearCreateForm();
      await loadAssets();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : err?.message || "Failed to add asset.");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (asset: AssetRecord) => {
    const directionFinderProfile = directionFinderProfileByAssetId[asset.id];
    const jammerProfile = jammerProfileByAssetId[asset.id];

    setEditingAssetId(asset.id);
    setEditingName(asset.name);
    setEditingLatitude(String(asset.latitude ?? ""));
    setEditingLongitude(String(asset.longitude ?? ""));
    setEditingC2Status(asset.status ?? "ACTIVE");
    setEditingHeightM(String(asset.height_m ?? ""));
    setEditingRangeM(metersToKmInput(asset.range_m));
    setEditingBearingDeg(String(asset.bearing_deg ?? ""));
    setEditingFovDeg(String(asset.fov_deg ?? ""));
    setEditingDfManufacturer(directionFinderProfile?.manufacturer ?? "");
    setEditingDfModelNumber(directionFinderProfile?.model_number ?? "");
    setEditingDfSerialNumber(directionFinderProfile?.serial_number ?? "");
    setEditingDfPlatformClass(directionFinderProfile?.platform_class ?? "");
    setEditingDfMobilityClass(directionFinderProfile?.mobility_class ?? "");
    setEditingDfMissionDomain(directionFinderProfile?.mission_domain ?? "");
    setEditingDfAntennaArrayType(directionFinderProfile?.antenna_array_type ?? "");
    setEditingDfRfMinMhz(
      directionFinderProfile?.rf_min_mhz !== undefined && directionFinderProfile?.rf_min_mhz !== null
        ? String(directionFinderProfile.rf_min_mhz)
        : ""
    );
    setEditingDfRfMaxMhz(
      directionFinderProfile?.rf_max_mhz !== undefined && directionFinderProfile?.rf_max_mhz !== null
        ? String(directionFinderProfile.rf_max_mhz)
        : ""
    );
    setEditingDfSecurityClassification(directionFinderProfile?.security_classification ?? "");

    setEditingJammerManufacturer(jammerProfile?.manufacturer ?? "");
    setEditingJammerModelNumber(jammerProfile?.model_number ?? "");
    setEditingJammerSerialNumber(jammerProfile?.serial_number ?? "");
    setEditingJammerSubtype(jammerProfile?.jammer_subtype ?? "");
    setEditingJammerMissionDomain(jammerProfile?.mission_domain ?? "");
    setEditingJammerPlatformType(jammerProfile?.platform_type ?? "");
    setEditingJammerIpAddress(jammerProfile?.ip_address ?? "");
    setEditingJammerPort(
      jammerProfile?.port !== undefined && jammerProfile?.port !== null
        ? String(jammerProfile.port)
        : ""
    );
    setEditingJammerRfMinMhz(
      jammerProfile?.rf_coverage_min_mhz !== undefined && jammerProfile?.rf_coverage_min_mhz !== null
        ? String(jammerProfile.rf_coverage_min_mhz)
        : ""
    );
    setEditingJammerRfMaxMhz(
      jammerProfile?.rf_coverage_max_mhz !== undefined && jammerProfile?.rf_coverage_max_mhz !== null
        ? String(jammerProfile.rf_coverage_max_mhz)
        : ""
    );
    setEditingJammerSecurityClassification(jammerProfile?.security_classification ?? "");
    setError(null);
    setSuccess(null);
  };

  const cancelEdit = () => {
    setEditingAssetId(null);
    setEditingName("");
    setEditingLatitude("");
    setEditingLongitude("");
    setEditingC2Status("ACTIVE");
    setEditingHeightM("");
    setEditingRangeM("");
    setEditingBearingDeg("");
    setEditingFovDeg("");
    setEditingDfManufacturer("");
    setEditingDfModelNumber("");
    setEditingDfSerialNumber("");
    setEditingDfPlatformClass("");
    setEditingDfMobilityClass("");
    setEditingDfMissionDomain("");
    setEditingDfAntennaArrayType("");
    setEditingDfRfMinMhz("");
    setEditingDfRfMaxMhz("");
    setEditingDfSecurityClassification("");

    setEditingJammerManufacturer("");
    setEditingJammerModelNumber("");
    setEditingJammerSerialNumber("");
    setEditingJammerSubtype("");
    setEditingJammerMissionDomain("");
    setEditingJammerPlatformType("");
    setEditingJammerIpAddress("");
    setEditingJammerPort("");
    setEditingJammerRfMinMhz("");
    setEditingJammerRfMaxMhz("");
    setEditingJammerSecurityClassification("");
  };

  const handleSaveAsset = async (assetId: string) => {
    if (!validateRequired([editingName, editingLatitude, editingLongitude])) {
      setError("Name, Lat, and Long are mandatory.");
      return;
    }

    if (isDirectionFinderSelected) {
      if (
        !validateRequired([
          editingDfManufacturer,
          editingDfModelNumber,
          editingDfSerialNumber,
          editingDfPlatformClass,
          editingDfMobilityClass,
          editingDfMissionDomain,
          editingDfAntennaArrayType,
          editingDfRfMinMhz,
          editingDfRfMaxMhz,
          editingDfSecurityClassification,
        ])
      ) {
        setError("Direction Finder fields are mandatory.");
        return;
      }
    } else if (isJammerSelected) {
      if (
        !validateRequired([
          editingJammerManufacturer,
          editingJammerModelNumber,
          editingJammerSerialNumber,
          editingJammerSubtype,
          editingJammerMissionDomain,
          editingJammerPlatformType,
          editingJammerIpAddress,
          editingJammerPort,
          editingJammerRfMinMhz,
          editingJammerRfMaxMhz,
          editingJammerSecurityClassification,
        ])
      ) {
        setError("Jammer fields are mandatory.");
        return;
      }
    } else if (
      !validateRequired([
        editingHeightM,
        editingBearingDeg,
        editingFovDeg,
      ])
    ) {
      setError("Height, Bearing, and FOV are mandatory for C2 Node.");
      return;
    }

    if (!validateRequired([editingRangeM])) {
      setError("Circle Range (km) is mandatory.");
      return;
    }

    try {
      setSavingAssetId(assetId);
      setError(null);
      setSuccess(null);
      await updateAsset(assetId, {
        name: editingName.trim(),
        type: assetType,
        status: isC2Selected ? editingC2Status : "ACTIVE",
        latitude: Number(editingLatitude),
        longitude: Number(editingLongitude),
        height_m: isC2Selected ? Number(editingHeightM) : undefined,
        range_m: kmInputToMeters(editingRangeM),
        bearing_deg: isC2Selected ? Number(editingBearingDeg) : undefined,
        fov_deg: isC2Selected ? Number(editingFovDeg) : undefined,
      });

      if (isDirectionFinderSelected) {
        const existingProfile = directionFinderProfileByAssetId[assetId];
        if (existingProfile) {
          await updateDirectionFinderProfile(existingProfile.id, {
            manufacturer: editingDfManufacturer.trim(),
            model_number: editingDfModelNumber.trim(),
            serial_number: editingDfSerialNumber.trim(),
            platform_class: editingDfPlatformClass.trim(),
            mobility_class: editingDfMobilityClass.trim(),
            mission_domain: editingDfMissionDomain.trim(),
            antenna_array_type: editingDfAntennaArrayType.trim(),
            rf_min_mhz: Number(editingDfRfMinMhz),
            rf_max_mhz: Number(editingDfRfMaxMhz),
            security_classification: editingDfSecurityClassification.trim(),
          });
        } else {
          await createDirectionFinderProfile({
            asset_id: assetId,
            manufacturer: editingDfManufacturer.trim(),
            model_number: editingDfModelNumber.trim(),
            serial_number: editingDfSerialNumber.trim(),
            platform_class: editingDfPlatformClass.trim(),
            mobility_class: editingDfMobilityClass.trim(),
            mission_domain: editingDfMissionDomain.trim(),
            lifecycle_state: "ACTIVE_SERVICE",
            antenna_array_type: editingDfAntennaArrayType.trim(),
            rf_min_mhz: Number(editingDfRfMinMhz),
            rf_max_mhz: Number(editingDfRfMaxMhz),
            security_classification: editingDfSecurityClassification.trim(),
            antenna_polarization_support: [],
            df_methods_supported: [],
            lever_arm_offset_m: {},
            transport_protocols: [],
            message_protocols: [],
            data_format_profiles: [],
            geodetic_datum: "WGS84",
            altitude_reference: "MSL",
            secure_boot_enabled: true,
          });
        }
      } else if (isJammerSelected) {
        const existingProfile = jammerProfileByAssetId[assetId];
        if (existingProfile) {
          await updateJammerProfile(existingProfile.id, {
            manufacturer: editingJammerManufacturer.trim(),
            model_number: editingJammerModelNumber.trim(),
            serial_number: editingJammerSerialNumber.trim(),
            jammer_subtype: editingJammerSubtype.trim(),
            mission_domain: editingJammerMissionDomain.trim(),
            platform_type: editingJammerPlatformType.trim(),
            ip_address: editingJammerIpAddress.trim(),
            port: Number(editingJammerPort),
            rf_coverage_min_mhz: Number(editingJammerRfMinMhz),
            rf_coverage_max_mhz: Number(editingJammerRfMaxMhz),
            security_classification: editingJammerSecurityClassification.trim(),
          });
        } else {
          await createJammerProfile({
            asset_id: assetId,
            manufacturer: editingJammerManufacturer.trim(),
            model_number: editingJammerModelNumber.trim(),
            serial_number: editingJammerSerialNumber.trim(),
            jammer_subtype: editingJammerSubtype.trim(),
            mission_domain: editingJammerMissionDomain.trim(),
            platform_type: editingJammerPlatformType.trim(),
            ip_address: editingJammerIpAddress.trim(),
            port: Number(editingJammerPort),
            rf_coverage_min_mhz: Number(editingJammerRfMinMhz),
            rf_coverage_max_mhz: Number(editingJammerRfMaxMhz),
            security_classification: editingJammerSecurityClassification.trim(),
          });
        }
      }

      setSuccess("Asset updated successfully.");
      cancelEdit();
      await loadAssets();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to update asset.");
    } finally {
      setSavingAssetId(null);
    }
  };

  const handleDeleteAsset = async (assetId: string, assetName: string) => {
    const confirmed = window.confirm(`Delete asset ${assetName}?`);
    if (!confirmed) {
      return;
    }

    try {
      setDeletingAssetId(assetId);
      setError(null);
      setSuccess(null);
      await deleteAsset(assetId);
      if (editingAssetId === assetId) {
        cancelEdit();
      }
      setSuccess("Asset deleted successfully.");
      await loadAssets();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to delete asset.");
    } finally {
      setDeletingAssetId(null);
    }
  };

  return (
    <AppLayout>
      <PageContainer title="Asset Management">
        <div style={{ display: "grid", gap: theme.spacing.md }}>
          <select
            value={assetType}
            onChange={(e) => {
              setAssetType(e.target.value as AssetTypeOption);
              cancelEdit();
            }}
            style={{
              padding: theme.spacing.sm,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.sm,
              background: theme.colors.surfaceAlt,
              color: theme.colors.textPrimary,
              minWidth: 240,
              width: "fit-content",
            }}
          >
            {ASSET_TYPE_OPTIONS.map((typeOption) => (
              <option key={typeOption.value} value={typeOption.value}>{typeOption.label}</option>
            ))}
          </select>

          {loading && <div>Loading assets...</div>}
          {error && <div style={{ color: theme.colors.danger }}>{error}</div>}
          {success && <div style={{ color: theme.colors.success }}>{success}</div>}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, overflow: "hidden" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Name</th>
                  <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Lat</th>
                  <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Long</th>
                  <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Circle Range (km)</th>
                  {isDirectionFinderSelected ? (
                    <>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Manufacturer</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Model</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Serial</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>RF Min MHz</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>RF Max MHz</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Security</th>
                    </>
                  ) : isJammerSelected ? (
                    <>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Manufacturer</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Model</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Serial</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Subtype</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>IP Address</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Port</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>RF Min MHz</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>RF Max MHz</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Security</th>
                    </>
                  ) : (
                    <>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Status</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Height</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Bearing</th>
                      <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>FOV</th>
                    </>
                  )}
                  <th style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => (
                  <tr key={asset.id}>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                      {false ? (
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          style={{ width: "100%", padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                        />
                      ) : (
                        asset.name
                      )}
                    </td>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                      {false ? (
                        <input
                          type="number"
                          value={editingLatitude}
                          onChange={(e) => setEditingLatitude(e.target.value)}
                          style={{ width: 120, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                        />
                      ) : (
                        asset.latitude
                      )}
                    </td>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                      {false ? (
                        <input
                          type="number"
                          value={editingLongitude}
                          onChange={(e) => setEditingLongitude(e.target.value)}
                          style={{ width: 120, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                        />
                      ) : (
                        asset.longitude
                      )}
                    </td>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                      {asset.range_m && asset.range_m > 0 ? (asset.range_m / 1000).toFixed(2) : "-"}
                    </td>
                    {isDirectionFinderSelected ? (
                      <>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <input
                              value={editingDfManufacturer}
                              onChange={(e) => setEditingDfManufacturer(e.target.value)}
                              style={{ width: 150, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            />
                          ) : (
                            directionFinderProfileByAssetId[asset.id]?.manufacturer ?? "-"
                          )}
                        </td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <input
                              value={editingDfModelNumber}
                              onChange={(e) => setEditingDfModelNumber(e.target.value)}
                              style={{ width: 140, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            />
                          ) : (
                            directionFinderProfileByAssetId[asset.id]?.model_number ?? "-"
                          )}
                        </td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <input
                              value={editingDfSerialNumber}
                              onChange={(e) => setEditingDfSerialNumber(e.target.value)}
                              style={{ width: 140, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            />
                          ) : (
                            directionFinderProfileByAssetId[asset.id]?.serial_number ?? "-"
                          )}
                        </td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <input
                              type="number"
                              value={editingDfRfMinMhz}
                              onChange={(e) => setEditingDfRfMinMhz(e.target.value)}
                              style={{ width: 110, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            />
                          ) : (
                            directionFinderProfileByAssetId[asset.id]?.rf_min_mhz ?? "-"
                          )}
                        </td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <input
                              type="number"
                              value={editingDfRfMaxMhz}
                              onChange={(e) => setEditingDfRfMaxMhz(e.target.value)}
                              style={{ width: 110, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            />
                          ) : (
                            directionFinderProfileByAssetId[asset.id]?.rf_max_mhz ?? "-"
                          )}
                        </td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <input
                              value={editingDfSecurityClassification}
                              onChange={(e) => setEditingDfSecurityClassification(e.target.value)}
                              style={{ width: 130, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            />
                          ) : (
                            directionFinderProfileByAssetId[asset.id]?.security_classification ?? "-"
                          )}
                        </td>
                      </>
                    ) : isJammerSelected ? (
                      <>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <input
                              value={editingJammerManufacturer}
                              onChange={(e) => setEditingJammerManufacturer(e.target.value)}
                              style={{ width: 150, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            />
                          ) : (
                            jammerProfileByAssetId[asset.id]?.manufacturer ?? "-"
                          )}
                        </td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <input
                              value={editingJammerModelNumber}
                              onChange={(e) => setEditingJammerModelNumber(e.target.value)}
                              style={{ width: 140, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            />
                          ) : (
                            jammerProfileByAssetId[asset.id]?.model_number ?? "-"
                          )}
                        </td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <input
                              value={editingJammerSerialNumber}
                              onChange={(e) => setEditingJammerSerialNumber(e.target.value)}
                              style={{ width: 140, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            />
                          ) : (
                            jammerProfileByAssetId[asset.id]?.serial_number ?? "-"
                          )}
                        </td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <input
                              value={editingJammerSubtype}
                              onChange={(e) => setEditingJammerSubtype(e.target.value)}
                              style={{ width: 130, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            />
                          ) : (
                            jammerProfileByAssetId[asset.id]?.jammer_subtype ?? "-"
                          )}
                        </td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <input
                              value={editingJammerIpAddress}
                              onChange={(e) => setEditingJammerIpAddress(e.target.value)}
                              style={{ width: 150, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            />
                          ) : (
                            jammerProfileByAssetId[asset.id]?.ip_address ?? "-"
                          )}
                        </td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <input
                              type="number"
                              value={editingJammerPort}
                              onChange={(e) => setEditingJammerPort(e.target.value)}
                              style={{ width: 90, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            />
                          ) : (
                            jammerProfileByAssetId[asset.id]?.port ?? "-"
                          )}
                        </td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <input
                              type="number"
                              value={editingJammerRfMinMhz}
                              onChange={(e) => setEditingJammerRfMinMhz(e.target.value)}
                              style={{ width: 110, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            />
                          ) : (
                            jammerProfileByAssetId[asset.id]?.rf_coverage_min_mhz ?? "-"
                          )}
                        </td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <input
                              type="number"
                              value={editingJammerRfMaxMhz}
                              onChange={(e) => setEditingJammerRfMaxMhz(e.target.value)}
                              style={{ width: 110, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            />
                          ) : (
                            jammerProfileByAssetId[asset.id]?.rf_coverage_max_mhz ?? "-"
                          )}
                        </td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <input
                              value={editingJammerSecurityClassification}
                              onChange={(e) => setEditingJammerSecurityClassification(e.target.value)}
                              style={{ width: 130, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            />
                          ) : (
                            jammerProfileByAssetId[asset.id]?.security_classification ?? "-"
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <select
                              value={editingC2Status}
                              onChange={(e) => setEditingC2Status(e.target.value)}
                              style={{ width: 110, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            >
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="INACTIVE">INACTIVE</option>
                            </select>
                          ) : (
                            asset.status
                          )}
                        </td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <input
                              type="number"
                              value={editingHeightM}
                              onChange={(e) => setEditingHeightM(e.target.value)}
                              style={{ width: 100, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            />
                          ) : (
                            asset.height_m ?? "-"
                          )}
                        </td>
<td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <input
                              type="number"
                              value={editingBearingDeg}
                              onChange={(e) => setEditingBearingDeg(e.target.value)}
                              style={{ width: 100, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            />
                          ) : (
                            asset.bearing_deg ?? "-"
                          )}
                        </td>
                        <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                          {false ? (
                            <input
                              type="number"
                              value={editingFovDeg}
                              onChange={(e) => setEditingFovDeg(e.target.value)}
                              style={{ width: 100, padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                            />
                          ) : (
                            asset.fov_deg ?? "-"
                          )}
                        </td>
                      </>
                    )}
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                      <div style={{ display: "flex", gap: theme.spacing.sm }}>
                        {false ? (
                          <>
                            <button
                              style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
                              onClick={() => handleSaveAsset(asset.id)}
                              disabled={savingAssetId === asset.id}
                            >
                              {savingAssetId === asset.id ? "Saving..." : "Save"}
                            </button>
                            <button
                              style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, background: theme.colors.surface, color: theme.colors.textPrimary, cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
                              onClick={cancelEdit}
                              disabled={savingAssetId === asset.id}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
                              onClick={() => startEdit(asset)}
                              disabled={deletingAssetId === asset.id}
                            >
                              Edit
                            </button>
                            <button
                              style={{ border: "none", borderRadius: theme.radius.md, background: theme.colors.danger, color: "#fff", cursor: "pointer", padding: `${theme.spacing.xs} ${theme.spacing.sm}` }}
                              onClick={() => handleDeleteAsset(asset.id, asset.name)}
                              disabled={deletingAssetId === asset.id}
                            >
                              {deletingAssetId === asset.id ? "Deleting..." : "Delete"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAssets.length === 0 && !loading && (
                  <tr>
                    <td style={{ padding: theme.spacing.sm }} colSpan={isDirectionFinderSelected ? 11 : isJammerSelected ? 14 : 10}>No assets found for selected type.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {editingAssetId && editingAsset && (
            <div style={{ display: "grid", gap: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.md, background: theme.colors.surfaceAlt }}>
              <div style={{ fontWeight: 600 }}>Edit Asset</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: theme.spacing.sm }}>
                <input
                  placeholder="Name*"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                />
                <input
                  type="number"
                  placeholder="Lat*"
                  value={editingLatitude}
                  onChange={(e) => setEditingLatitude(e.target.value)}
                  style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                />
                <input
                  type="number"
                  placeholder="Long*"
                  value={editingLongitude}
                  onChange={(e) => setEditingLongitude(e.target.value)}
                  style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="Circle Range (km)*"
                  value={editingRangeM}
                  onChange={(e) => setEditingRangeM(e.target.value)}
                  style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                />
                {isDirectionFinderSelected ? (
                  <>
                    <input
                      placeholder="Manufacturer*"
                      value={editingDfManufacturer}
                      onChange={(e) => setEditingDfManufacturer(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      placeholder="Model Number*"
                      value={editingDfModelNumber}
                      onChange={(e) => setEditingDfModelNumber(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      placeholder="Serial Number*"
                      value={editingDfSerialNumber}
                      onChange={(e) => setEditingDfSerialNumber(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      placeholder="Platform Class*"
                      value={editingDfPlatformClass}
                      onChange={(e) => setEditingDfPlatformClass(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      placeholder="Mobility Class*"
                      value={editingDfMobilityClass}
                      onChange={(e) => setEditingDfMobilityClass(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      placeholder="Mission Domain*"
                      value={editingDfMissionDomain}
                      onChange={(e) => setEditingDfMissionDomain(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      placeholder="Antenna Array Type*"
                      value={editingDfAntennaArrayType}
                      onChange={(e) => setEditingDfAntennaArrayType(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      type="number"
                      placeholder="RF Min MHz*"
                      value={editingDfRfMinMhz}
                      onChange={(e) => setEditingDfRfMinMhz(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      type="number"
                      placeholder="RF Max MHz*"
                      value={editingDfRfMaxMhz}
                      onChange={(e) => setEditingDfRfMaxMhz(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      placeholder="Security Classification*"
                      value={editingDfSecurityClassification}
                      onChange={(e) => setEditingDfSecurityClassification(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                  </>
                ) : isJammerSelected ? (
                  <>
                    <input
                      placeholder="Manufacturer*"
                      value={editingJammerManufacturer}
                      onChange={(e) => setEditingJammerManufacturer(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      placeholder="Model Number*"
                      value={editingJammerModelNumber}
                      onChange={(e) => setEditingJammerModelNumber(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      placeholder="Serial Number*"
                      value={editingJammerSerialNumber}
                      onChange={(e) => setEditingJammerSerialNumber(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      placeholder="Jammer Subtype*"
                      value={editingJammerSubtype}
                      onChange={(e) => setEditingJammerSubtype(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      placeholder="Mission Domain*"
                      value={editingJammerMissionDomain}
                      onChange={(e) => setEditingJammerMissionDomain(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      placeholder="Platform Type*"
                      value={editingJammerPlatformType}
                      onChange={(e) => setEditingJammerPlatformType(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      placeholder="IP Address*"
                      value={editingJammerIpAddress}
                      onChange={(e) => setEditingJammerIpAddress(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      type="number"
                      placeholder="Port*"
                      value={editingJammerPort}
                      onChange={(e) => setEditingJammerPort(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      type="number"
                      placeholder="RF Min MHz*"
                      value={editingJammerRfMinMhz}
                      onChange={(e) => setEditingJammerRfMinMhz(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      type="number"
                      placeholder="RF Max MHz*"
                      value={editingJammerRfMaxMhz}
                      onChange={(e) => setEditingJammerRfMaxMhz(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      placeholder="Security Classification*"
                      value={editingJammerSecurityClassification}
                      onChange={(e) => setEditingJammerSecurityClassification(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                  </>
                ) : (
                  <>
                    <select
                      value={editingC2Status}
                      onChange={(e) => setEditingC2Status(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Height*"
                      value={editingHeightM}
                      onChange={(e) => setEditingHeightM(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />

                    <input
                      type="number"
                      placeholder="Bearing*"
                      value={editingBearingDeg}
                      onChange={(e) => setEditingBearingDeg(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                    <input
                      type="number"
                      placeholder="FOV*"
                      value={editingFovDeg}
                      onChange={(e) => setEditingFovDeg(e.target.value)}
                      style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                    />
                  </>
                )}
              </div>
              <div style={{ display: "flex", gap: theme.spacing.sm }}>
                <button
                  onClick={() => handleSaveAsset(editingAsset.id)}
                  disabled={savingAssetId === editingAsset.id}
                  style={{ width: "fit-content", border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }}
                >
                  {savingAssetId === editingAsset.id ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={savingAssetId === editingAsset.id}
                  style={{ width: "fit-content", border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, background: theme.colors.surface, color: theme.colors.textPrimary, cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <div style={{ display: "grid", gap: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.md, background: theme.colors.surfaceAlt }}>
            <div style={{ fontWeight: 600 }}>Add New Asset</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: theme.spacing.sm }}>
              <input
                placeholder="Name*"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
              />
              <input
                type="number"
                placeholder="Lat*"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
              />
              <input
                type="number"
                placeholder="Long*"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
              />
              <input
                type="number"
                step="0.1"
                placeholder="Circle Range (km)*"
                value={rangeM}
                onChange={(e) => setRangeM(e.target.value)}
                style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
              />
              {isDirectionFinderSelected ? (
                <>
                  <input
                    placeholder="Manufacturer*"
                    value={dfManufacturer}
                    onChange={(e) => setDfManufacturer(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    placeholder="Model Number*"
                    value={dfModelNumber}
                    onChange={(e) => setDfModelNumber(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    placeholder="Serial Number*"
                    value={dfSerialNumber}
                    onChange={(e) => setDfSerialNumber(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    placeholder="Platform Class*"
                    value={dfPlatformClass}
                    onChange={(e) => setDfPlatformClass(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    placeholder="Mobility Class*"
                    value={dfMobilityClass}
                    onChange={(e) => setDfMobilityClass(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    placeholder="Mission Domain*"
                    value={dfMissionDomain}
                    onChange={(e) => setDfMissionDomain(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    placeholder="Antenna Array Type*"
                    value={dfAntennaArrayType}
                    onChange={(e) => setDfAntennaArrayType(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    type="number"
                    placeholder="RF Min MHz*"
                    value={dfRfMinMhz}
                    onChange={(e) => setDfRfMinMhz(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    type="number"
                    placeholder="RF Max MHz*"
                    value={dfRfMaxMhz}
                    onChange={(e) => setDfRfMaxMhz(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    placeholder="Security Classification*"
                    value={dfSecurityClassification}
                    onChange={(e) => setDfSecurityClassification(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                </>
              ) : isJammerSelected ? (
                <>
                  <input
                    placeholder="Manufacturer*"
                    value={jammerManufacturer}
                    onChange={(e) => setJammerManufacturer(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    placeholder="Model Number*"
                    value={jammerModelNumber}
                    onChange={(e) => setJammerModelNumber(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    placeholder="Serial Number*"
                    value={jammerSerialNumber}
                    onChange={(e) => setJammerSerialNumber(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    placeholder="Jammer Subtype*"
                    value={jammerSubtype}
                    onChange={(e) => setJammerSubtype(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    placeholder="Mission Domain*"
                    value={jammerMissionDomain}
                    onChange={(e) => setJammerMissionDomain(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    placeholder="Platform Type*"
                    value={jammerPlatformType}
                    onChange={(e) => setJammerPlatformType(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    placeholder="IP Address*"
                    value={jammerIpAddress}
                    onChange={(e) => setJammerIpAddress(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    type="number"
                    placeholder="Port*"
                    value={jammerPort}
                    onChange={(e) => setJammerPort(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    type="number"
                    placeholder="RF Min MHz*"
                    value={jammerRfMinMhz}
                    onChange={(e) => setJammerRfMinMhz(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    type="number"
                    placeholder="RF Max MHz*"
                    value={jammerRfMaxMhz}
                    onChange={(e) => setJammerRfMaxMhz(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    placeholder="Security Classification*"
                    value={jammerSecurityClassification}
                    onChange={(e) => setJammerSecurityClassification(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                </>
              ) : (
                <>
                  <select
                    value={c2Status}
                    onChange={(e) => setC2Status(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Height*"
                    value={heightM}
                    onChange={(e) => setHeightM(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
<input
                    type="number"
                    placeholder="Bearing*"
                    value={bearingDeg}
                    onChange={(e) => setBearingDeg(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                  <input
                    type="number"
                    placeholder="FOV*"
                    value={fovDeg}
                    onChange={(e) => setFovDeg(e.target.value)}
                    style={{ padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, background: theme.colors.surface, color: theme.colors.textPrimary }}
                  />
                </>
              )}
            </div>
            <button
              onClick={handleCreateAsset}
              disabled={creating}
              style={{ width: "fit-content", border: "none", borderRadius: theme.radius.md, background: theme.colors.primary, color: "#fff", cursor: "pointer", padding: `${theme.spacing.sm} ${theme.spacing.md}` }}
            >
              {creating ? "Adding..." : "Add Asset"}
            </button>
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  );
}













