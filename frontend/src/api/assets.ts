import api from "./axios";

export type AssetRecord = {
  id: string;
  name: string;
  type?: string | null;
  status: string;
  latitude: number;
  longitude: number;
  df_radius_m?: number | null;
  created_at?: string | null;
};

export const getAssets = () => api.get<AssetRecord[]>("/assets");