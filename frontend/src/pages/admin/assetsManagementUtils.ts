export const ASSET_TYPE_OPTIONS = [
  { label: "C2 Node", value: "C2_NODE" },
  { label: "Direction Finder", value: "DIRECTION_FINDER" },
  { label: "Jammer", value: "JAMMER" },
] as const;

export type AssetTypeOption = (typeof ASSET_TYPE_OPTIONS)[number]["value"];

export const normalizeAssetType = (value: string | null | undefined) => {
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

export const metersToKmInput = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "";
  }
  const kmValue = value / 1000;
  return Number.isInteger(kmValue) ? String(kmValue) : String(Number(kmValue.toFixed(3)));
};

export const kmInputToMeters = (value: string) => {
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

export const validateRequired = (values: string[]) => values.every((value) => value.trim() !== "");

export const mapProfilesByAssetId = <T extends { asset_id: string }>(
  profiles: T[]
): Record<string, T> => {
  return profiles.reduce((acc, profile) => {
    acc[profile.asset_id] = profile;
    return acc;
  }, {} as Record<string, T>);
};
