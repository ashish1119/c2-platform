import api from "./axios";

export type AssetRecord = {
  id: string;
  name: string;
  type?: string | null;
  status: string;
  latitude: number;
  longitude: number;
  created_at?: string | null;
};

export const getAssets = () => api.get<AssetRecord[]>("/assets");

export const exportAssetsCsv = () => api.get("/assets/export/csv");

export const exportAssetsXml = () => api.get("/assets/export/xml");

export const importAssetsCsv = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/assets/import/csv", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const importAssetsXml = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/assets/import/xml", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};