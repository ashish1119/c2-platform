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


const thStyle = (theme: any): React.CSSProperties => ({
  padding: theme.spacing.sm,
  textAlign: "left" as const,
  fontWeight: 600,
  fontSize: 13,
  borderBottom: `1px solid ${theme.colors.border}`,
});

const tdStyle = (theme: any): React.CSSProperties => ({
  padding: theme.spacing.sm,
  fontSize: 13,
});

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))",
  gap: 12,
};

const card = (theme: any): React.CSSProperties => ({
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.lg,
  padding: theme.spacing.md,
  background: theme.colors.surfaceAlt,
  display: "grid",
  gap: theme.spacing.md,
});

const inputStyle = (theme: any): React.CSSProperties => ({
  padding: theme.spacing.sm,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.sm,
  background: theme.colors.surface,
});

const iconBtn = (theme: any, color: string): React.CSSProperties => ({
  border: "none",
  borderRadius: 6,
  background: color,
  color: "#fff",
  cursor: "pointer",
  padding: "6px 10px",
});

const primaryBtn = (theme: any): React.CSSProperties => ({
  border: "none",
  borderRadius: theme.radius.md,
  background: theme.colors.primary,
  color: "#fff",
  padding: "10px 16px",
  cursor: "pointer",
});

const secondaryBtn = (theme: any): React.CSSProperties => ({
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.md,
  background: theme.colors.surface,
  padding: "10px 16px",
  cursor: "pointer",
});
  


  return (
  <AppLayout>
    <PageContainer title="Asset Management">
      <div style={{ display: "grid", gap: theme.spacing.lg }}>

        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={assetType}
            onChange={(e) => {
              setAssetType(e.target.value as AssetTypeOption);
              cancelEdit();
            }}
            style={{
              padding: theme.spacing.sm,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              background: theme.colors.surface,
              minWidth: 240
            }}
          >
            {ASSET_TYPE_OPTIONS.map((typeOption) => (
              <option key={typeOption.value} value={typeOption.value}>
                {typeOption.label}
              </option>
            ))}
          </select>
        </div>

        {/* STATUS */}
        {loading && <div>Loading assets...</div>}
        {error && <div style={{ color: theme.colors.danger }}>{error}</div>}
        {success && <div style={{ color: theme.colors.success }}>{success}</div>}



   {/* ================= ADD FORM ================= */}
      {/* ================= ADD FORM ================= */}
<div
  style={{
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    background: theme.colors.surfaceAlt,
    padding: theme.spacing.lg,
    display: "grid",
    gap: theme.spacing.md,
  }}
>
  <div style={{ fontSize: 18, fontWeight: 600 }}>Add New Asset</div>

  {/* 2 COLUMN GRID */}
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: theme.spacing.md,
    }}
  >
    {/* COMMON FIELDS */}
    <input placeholder="Name*" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle(theme)} />
    <input type="number" placeholder="Latitude*" value={latitude} onChange={(e) => setLatitude(e.target.value)} style={inputStyle(theme)} />
    <input type="number" placeholder="Longitude*" value={longitude} onChange={(e) => setLongitude(e.target.value)} style={inputStyle(theme)} />
    <input type="number" placeholder="Circle Range (km)*" value={rangeM} onChange={(e) => setRangeM(e.target.value)} style={inputStyle(theme)} />

    {/* ===================== DIRECTION FINDER ===================== */}
    {isDirectionFinderSelected && (
      <>
        <input placeholder="Manufacturer*" value={dfManufacturer} onChange={(e) => setDfManufacturer(e.target.value)} style={inputStyle(theme)} />
        <input placeholder="Model Number*" value={dfModelNumber} onChange={(e) => setDfModelNumber(e.target.value)} style={inputStyle(theme)} />
        <input placeholder="Serial Number*" value={dfSerialNumber} onChange={(e) => setDfSerialNumber(e.target.value)} style={inputStyle(theme)} />
        <input placeholder="Platform Class*" value={dfPlatformClass} onChange={(e) => setDfPlatformClass(e.target.value)} style={inputStyle(theme)} />
        <input placeholder="Mobility Class*" value={dfMobilityClass} onChange={(e) => setDfMobilityClass(e.target.value)} style={inputStyle(theme)} />
        <input placeholder="Mission Domain*" value={dfMissionDomain} onChange={(e) => setDfMissionDomain(e.target.value)} style={inputStyle(theme)} />
        <input placeholder="Antenna Array Type*" value={dfAntennaArrayType} onChange={(e) => setDfAntennaArrayType(e.target.value)} style={inputStyle(theme)} />
        <input type="number" placeholder="RF Min MHz*" value={dfRfMinMhz} onChange={(e) => setDfRfMinMhz(e.target.value)} style={inputStyle(theme)} />
        <input type="number" placeholder="RF Max MHz*" value={dfRfMaxMhz} onChange={(e) => setDfRfMaxMhz(e.target.value)} style={inputStyle(theme)} />
        <input placeholder="Security Classification*" value={dfSecurityClassification} onChange={(e) => setDfSecurityClassification(e.target.value)} style={inputStyle(theme)} />
      </>
    )}

    {/* ===================== JAMMER ===================== */}
    {isJammerSelected && (
      <>
        <input placeholder="Manufacturer*" value={jammerManufacturer} onChange={(e) => setJammerManufacturer(e.target.value)} style={inputStyle(theme)} />
        <input placeholder="Model Number*" value={jammerModelNumber} onChange={(e) => setJammerModelNumber(e.target.value)} style={inputStyle(theme)} />
        <input placeholder="Serial Number*" value={jammerSerialNumber} onChange={(e) => setJammerSerialNumber(e.target.value)} style={inputStyle(theme)} />
        <input placeholder="Jammer Subtype*" value={jammerSubtype} onChange={(e) => setJammerSubtype(e.target.value)} style={inputStyle(theme)} />
        <input placeholder="Mission Domain*" value={jammerMissionDomain} onChange={(e) => setJammerMissionDomain(e.target.value)} style={inputStyle(theme)} />
        <input placeholder="Platform Type*" value={jammerPlatformType} onChange={(e) => setJammerPlatformType(e.target.value)} style={inputStyle(theme)} />
        <input placeholder="IP Address*" value={jammerIpAddress} onChange={(e) => setJammerIpAddress(e.target.value)} style={inputStyle(theme)} />
        <input type="number" placeholder="Port*" value={jammerPort} onChange={(e) => setJammerPort(e.target.value)} style={inputStyle(theme)} />
        <input type="number" placeholder="RF Min MHz*" value={jammerRfMinMhz} onChange={(e) => setJammerRfMinMhz(e.target.value)} style={inputStyle(theme)} />
        <input type="number" placeholder="RF Max MHz*" value={jammerRfMaxMhz} onChange={(e) => setJammerRfMaxMhz(e.target.value)} style={inputStyle(theme)} />
        <input placeholder="Security Classification*" value={jammerSecurityClassification} onChange={(e) => setJammerSecurityClassification(e.target.value)} style={inputStyle(theme)} />
      </>
    )}

    {/* ===================== C2 NODE ===================== */}
    {!isDirectionFinderSelected && !isJammerSelected && (
      <>
        <select value={c2Status} onChange={(e) => setC2Status(e.target.value)} style={inputStyle(theme)}>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
        <input type="number" placeholder="Height*" value={heightM} onChange={(e) => setHeightM(e.target.value)} style={inputStyle(theme)} />
        <input type="number" placeholder="Bearing*" value={bearingDeg} onChange={(e) => setBearingDeg(e.target.value)} style={inputStyle(theme)} />
        <input type="number" placeholder="FOV*" value={fovDeg} onChange={(e) => setFovDeg(e.target.value)} style={inputStyle(theme)} />
      </>
    )}
  </div>

  <button
    onClick={handleCreateAsset}
    disabled={creating}
    style={{
      width: "fit-content",
      border: "none",
      borderRadius: theme.radius.md,
      background: theme.colors.primary,
      color: "#fff",
      cursor: "pointer",
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    }}
  >
    {creating ? "Adding..." : "Add Asset"}
  </button>
</div>



        {/* ================= TABLE ================= */}
        <div style={{
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.lg,
          overflow: "hidden",
          background: theme.colors.surfaceAlt
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>

              <thead style={{ background: theme.colors.surface }}>
                <tr>
                  <th style={thStyle(theme)}>Name</th>
                  <th style={thStyle(theme)}>Lat</th>
                  <th style={thStyle(theme)}>Long</th>
                  <th style={thStyle(theme)}>Circle Range (km)</th>

                  {isDirectionFinderSelected ? (
                    <>
                      <th style={thStyle(theme)}>Manufacturer</th>
                      <th style={thStyle(theme)}>Model</th>
                      <th style={thStyle(theme)}>Serial</th>
                      <th style={thStyle(theme)}>RF Min MHz</th>
                      <th style={thStyle(theme)}>RF Max MHz</th>
                      <th style={thStyle(theme)}>Security</th>
                    </>
                  ) : isJammerSelected ? (
                    <>
                      <th style={thStyle(theme)}>Manufacturer</th>
                      <th style={thStyle(theme)}>Model</th>
                      <th style={thStyle(theme)}>Serial</th>
                      <th style={thStyle(theme)}>Subtype</th>
                      <th style={thStyle(theme)}>IP Address</th>
                      <th style={thStyle(theme)}>Port</th>
                      <th style={thStyle(theme)}>RF Min MHz</th>
                      <th style={thStyle(theme)}>RF Max MHz</th>
                      <th style={thStyle(theme)}>Security</th>
                    </>
                  ) : (
                    <>
                      <th style={thStyle(theme)}>Status</th>
                      <th style={thStyle(theme)}>Height</th>
                      <th style={thStyle(theme)}>Bearing</th>
                      <th style={thStyle(theme)}>FOV</th>
                    </>
                  )}

                  <th style={thStyle(theme)}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} style={{ borderTop: `1px solid ${theme.colors.border}` }}>

                    <td style={tdStyle(theme)}>{asset.name}</td>
                    <td style={tdStyle(theme)}>{asset.latitude}</td>
                    <td style={tdStyle(theme)}>{asset.longitude}</td>
                    <td style={tdStyle(theme)}>
                      {asset.range_m && asset.range_m > 0 ? (asset.range_m / 1000).toFixed(2) : "-"}
                    </td>

                    {/* TYPE DATA */}
                    {isDirectionFinderSelected && (
                      <>
                        <td style={tdStyle(theme)}>{directionFinderProfileByAssetId[asset.id]?.manufacturer ?? "-"}</td>
                        <td style={tdStyle(theme)}>{directionFinderProfileByAssetId[asset.id]?.model_number ?? "-"}</td>
                        <td style={tdStyle(theme)}>{directionFinderProfileByAssetId[asset.id]?.serial_number ?? "-"}</td>
                        <td style={tdStyle(theme)}>{directionFinderProfileByAssetId[asset.id]?.rf_min_mhz ?? "-"}</td>
                        <td style={tdStyle(theme)}>{directionFinderProfileByAssetId[asset.id]?.rf_max_mhz ?? "-"}</td>
                        <td style={tdStyle(theme)}>{directionFinderProfileByAssetId[asset.id]?.security_classification ?? "-"}</td>
                      </>
                    )}

                    {isJammerSelected && (
                      <>
                        <td style={tdStyle(theme)}>{jammerProfileByAssetId[asset.id]?.manufacturer ?? "-"}</td>
                        <td style={tdStyle(theme)}>{jammerProfileByAssetId[asset.id]?.model_number ?? "-"}</td>
                        <td style={tdStyle(theme)}>{jammerProfileByAssetId[asset.id]?.serial_number ?? "-"}</td>
                        <td style={tdStyle(theme)}>{jammerProfileByAssetId[asset.id]?.jammer_subtype ?? "-"}</td>
                        <td style={tdStyle(theme)}>{jammerProfileByAssetId[asset.id]?.ip_address ?? "-"}</td>
                        <td style={tdStyle(theme)}>{jammerProfileByAssetId[asset.id]?.port ?? "-"}</td>
                        <td style={tdStyle(theme)}>{jammerProfileByAssetId[asset.id]?.rf_coverage_min_mhz ?? "-"}</td>
                        <td style={tdStyle(theme)}>{jammerProfileByAssetId[asset.id]?.rf_coverage_max_mhz ?? "-"}</td>
                        <td style={tdStyle(theme)}>{jammerProfileByAssetId[asset.id]?.security_classification ?? "-"}</td>
                      </>
                    )}

                    {isC2Selected && (
                      <>
                        <td style={tdStyle(theme)}>{asset.status}</td>
                        <td style={tdStyle(theme)}>{asset.height_m ?? "-"}</td>
                        <td style={tdStyle(theme)}>{asset.bearing_deg ?? "-"}</td>
                        <td style={tdStyle(theme)}>{asset.fov_deg ?? "-"}</td>
                      </>
                    )}

                    {/* ACTIONS */}
                    <td style={tdStyle(theme)}>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          onClick={() => startEdit(asset)}
                          style={iconBtn(theme, theme.colors.primary)}
                        >
                          ✏️
                        </button>

                        <button
                          onClick={() => handleDeleteAsset(asset.id, asset.name)}
                          style={iconBtn(theme, theme.colors.danger)}
                        >
                          {deletingAssetId === asset.id ? "..." : "🗑️"}
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}

                {filteredAssets.length === 0 && !loading && (
                  <tr>
                    <td colSpan={20} style={{ padding: 20, textAlign: "center" }}>
                      No assets found
                    </td>
                  </tr>
                )}
              </tbody>

            </table>
          </div>
        </div>

        {/* ================= EDIT FORM ================= */}
        {editingAssetId && (
          <div style={card(theme)}>
            <h3>Edit Asset</h3>

            <div style={formGrid}>
              <input value={editingName} onChange={(e)=>setEditingName(e.target.value)} placeholder="Name*" style={inputStyle(theme)} />
              <input value={editingLatitude} onChange={(e)=>setEditingLatitude(e.target.value)} placeholder="Lat*" style={inputStyle(theme)} />
              <input value={editingLongitude} onChange={(e)=>setEditingLongitude(e.target.value)} placeholder="Long*" style={inputStyle(theme)} />
              <input value={editingRangeM} onChange={(e)=>setEditingRangeM(e.target.value)} placeholder="Range*" style={inputStyle(theme)} />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={()=>handleSaveAsset(editingAssetId)} style={primaryBtn(theme)}>
                {savingAssetId === editingAssetId ? "Saving..." : "Save"}
              </button>
              <button onClick={cancelEdit} style={secondaryBtn(theme)}>Cancel</button>
            </div>
          </div>
        )}

     

      </div>
    </PageContainer>
  </AppLayout>
);
}


// import { useEffect, useMemo, useState } from "react";
// import AppLayout from "../../components/layout/AppLayout";
// import PageContainer from "../../components/layout/PageContainer";
// import { useTheme } from "../../context/ThemeContext";
// import {
//   createAsset,
//   createJammerProfile,
//   deleteAsset,
//   getAssets,
//   getJammerProfiles,
//   updateAsset,
//   updateJammerProfile,
//   type AssetRecord,
//   type JammerProfileRecord,
// } from "../../api/assets";
// import {
//   createDirectionFinderProfile,
//   getDirectionFinderProfiles,
//   updateDirectionFinderProfile,
//   type DirectionFinderProfileRecord,
// } from "../../api/directionFinders";

// import { FaEdit, FaTrash } from "react-icons/fa";

// /* ---------------- CONFIG ---------------- */
// const ASSET_TYPE_OPTIONS = [
//   { label: "C2 Node", value: "C2_NODE" },
//   { label: "Direction Finder", value: "DIRECTION_FINDER" },
//   { label: "Jammer", value: "JAMMER" },
// ] as const;

// type AssetTypeOption = (typeof ASSET_TYPE_OPTIONS)[number]["value"];

// /* ---------------- PAGE ---------------- */
// export default function AssetsManagementPage() {
//   const { theme } = useTheme();

//   const [assetType, setAssetType] = useState<AssetTypeOption>("C2_NODE");
//   const [assets, setAssets] = useState<AssetRecord[]>([]);
//   const [directionFinderProfiles, setDirectionFinderProfiles] = useState<DirectionFinderProfileRecord[]>([]);
//   const [jammerProfiles, setJammerProfiles] = useState<JammerProfileRecord[]>([]);

//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   const isDirectionFinderSelected = assetType === "DIRECTION_FINDER";
//   const isJammerSelected = assetType === "JAMMER";

//   /* ---------------- LOAD ---------------- */
//   const loadAssets = async () => {
//     try {
//       setLoading(true);
//       const [a, df, j] = await Promise.all([
//         getAssets(),
//         getDirectionFinderProfiles(),
//         getJammerProfiles(),
//       ]);
//       setAssets(a.data);
//       setDirectionFinderProfiles(df.data);
//       setJammerProfiles(j.data);
//     } catch {
//       setError("Failed to load assets.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     loadAssets();
//   }, []);

//   /* ---------------- MAPS ---------------- */
//   const dfMap = useMemo(
//     () =>
//       directionFinderProfiles.reduce((acc, p) => {
//         acc[p.asset_id] = p;
//         return acc;
//       }, {} as Record<string, DirectionFinderProfileRecord>),
//     [directionFinderProfiles]
//   );

//   const jammerMap = useMemo(
//     () =>
//       jammerProfiles.reduce((acc, p) => {
//         acc[p.asset_id] = p;
//         return acc;
//       }, {} as Record<string, JammerProfileRecord>),
//     [jammerProfiles]
//   );

//   const filteredAssets = useMemo(
//     () => assets.filter((a) => a.type === assetType),
//     [assets, assetType]
//   );

//   /* ---------------- STYLES ---------------- */
//   const card = {
//     border: `1px solid ${theme.colors.border}`,
//     borderRadius: 12,
//     padding: 16,
//     background: theme.colors.surfaceAlt,
//   };

//   const input = {
//     padding: "10px",
//     borderRadius: 8,
//     border: `1px solid ${theme.colors.border}`,
//     background: theme.colors.surface,
//     color: theme.colors.textPrimary,
//     fontSize: 13,
//     width: "100%",
//   };

//   const iconBtn = {
//     height: 34,
//     width: 34,
//     borderRadius: 8,
//     border: "none",
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "center",
//     cursor: "pointer",
//   };

//   /* ---------------- UI ---------------- */
//   return (
//     <AppLayout>
//       <PageContainer title="Asset Management">

//         <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

//           {/* HEADER */}
//           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
//             <select
//               value={assetType}
//               onChange={(e) => setAssetType(e.target.value as AssetTypeOption)}
//               style={{ ...input, width: 220 }}
//             >
//               {ASSET_TYPE_OPTIONS.map((t) => (
//                 <option key={t.value} value={t.value}>{t.label}</option>
//               ))}
//             </select>
//           </div>

//           {error && <div style={{ color: theme.colors.danger }}>{error}</div>}
//           {loading && <div>Loading...</div>}

//           {/* TABLE */}
//           <div style={card}>
//             <table style={{ width: "100%", borderCollapse: "collapse" }}>
//               <thead>
//                 <tr>
//                   {["Name", "Lat", "Long", "Range (km)", "Details", "Actions"].map((h) => (
//                     <th
//                       key={h}
//                       style={{
//                         textAlign: "left",
//                         padding: 12,
//                         fontSize: 13,
//                         borderBottom: `1px solid ${theme.colors.border}`,
//                         color: theme.colors.textSecondary,
//                       }}
//                     >
//                       {h}
//                     </th>
//                   ))}
//                 </tr>
//               </thead>

//               <tbody>
//                 {filteredAssets.map((a) => (
//                   <tr key={a.id}>
//                     <td style={{ padding: 12 }}>{a.name}</td>
//                     <td style={{ padding: 12 }}>{a.latitude}</td>
//                     <td style={{ padding: 12 }}>{a.longitude}</td>
//                     <td style={{ padding: 12 }}>
//                       {a.range_m ? (a.range_m / 1000).toFixed(2) : "-"}
//                     </td>

//                     {/* DETAILS */}
//                     <td style={{ padding: 12 }}>
//                       {isDirectionFinderSelected
//                         ? dfMap[a.id]?.manufacturer || "-"
//                         : isJammerSelected
//                         ? jammerMap[a.id]?.manufacturer || "-"
//                         : a.status}
//                     </td>

//                     {/* ACTIONS */}
//                     <td style={{ padding: 12 }}>
//                       <div style={{ display: "flex", gap: 8 }}>
//                         <button
//                           style={{ ...iconBtn, background: theme.colors.primary, color: "#fff" }}
//                         >
//                           <FaEdit size={14} />
//                         </button>

//                         <button
//                           style={{ ...iconBtn, background: theme.colors.danger, color: "#fff" }}
//                           onClick={() => deleteAsset(a.id)}
//                         >
//                           <FaTrash size={14} />
//                         </button>
//                       </div>
//                     </td>
//                   </tr>
//                 ))}

//                 {filteredAssets.length === 0 && (
//                   <tr>
//                     <td colSpan={6} style={{ padding: 16, textAlign: "center" }}>
//                       No assets found
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>

//         </div>
//       </PageContainer>
//     </AppLayout>
//   );
// }









