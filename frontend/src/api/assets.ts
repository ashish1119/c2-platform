import api from "./axios";

export type AssetRecord = {
  id: string;
  name: string;
  type?: string | null;
  status: string;
  latitude: number;
  longitude: number;
  height_m?: number | null;
  range_m?: number | null;
  bearing_deg?: number | null;
  fov_deg?: number | null;
  df_radius_m?: number | null;
  created_at?: string | null;
};

export type AssetUpsertRequest = {
  name: string;
  type: string;
  status: string;
  latitude: number;
  longitude: number;
  height_m?: number;
  range_m?: number;
  bearing_deg?: number;
  fov_deg?: number;
};

export type JammerProfileBase = {
  asset_id: string;
  manufacturer: string;
  model_number: string;
  serial_number: string;
  jammer_subtype: string;
  mission_domain: string;
  lifecycle_state?: string;
  platform_type: string;
  ip_address: string;
  port: number;
  rf_coverage_min_mhz: number;
  rf_coverage_max_mhz: number;
  security_classification: string;
};

export type JammerProfileRecord = JammerProfileBase & {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type JammerProfileCreate = JammerProfileBase;
export type JammerProfileUpdate = Partial<Omit<JammerProfileBase, "asset_id">>;

export const getAssets = () => api.get<AssetRecord[]>("/assets");
export const createAsset = (data: AssetUpsertRequest) => api.post<AssetRecord>("/assets", data);
export const updateAsset = (assetId: string, data: AssetUpsertRequest) => api.put<AssetRecord>(`/assets/${assetId}`, data);
export const deleteAsset = (assetId: string) => api.delete(`/assets/${assetId}`);

export const getJammerProfiles = () => api.get<JammerProfileRecord[]>("/jammers");

export const createJammerProfile = (payload: JammerProfileCreate) =>
  api.post<JammerProfileRecord>("/jammers", payload);

export const updateJammerProfile = (profileId: string, payload: JammerProfileUpdate) =>
  api.patch<JammerProfileRecord>(`/jammers/${profileId}`, payload);