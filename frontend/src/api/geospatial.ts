import api from "./axios";

export type GeospatialCapabilities = {
  source_types: string[];
  coordinate_systems: string[];
  mgrs_enabled: boolean;
};

export type GeospatialSourceRecord = {
  source_id: string;
  source_name: string;
  source_type: string;
  transport: string;
  classification: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type GeospatialSourceCreatePayload = {
  source_name: string;
  source_type: string;
  transport: string;
  classification: string;
  metadata: Record<string, unknown>;
};

export type GeospatialSourceUpdatePayload = {
  source_name?: string;
  source_type?: string;
  transport?: string;
  classification?: string;
  metadata?: Record<string, unknown>;
};

export const getGeospatialCapabilities = () =>
  api.get<GeospatialCapabilities>("/geospatial/capabilities");

export const getGeospatialSources = (activeOnly = false) =>
  api.get<GeospatialSourceRecord[]>("/geospatial/ingestion/sources", {
    params: { active_only: activeOnly },
  });

export const createGeospatialSource = (payload: GeospatialSourceCreatePayload) =>
  api.post<GeospatialSourceRecord>("/geospatial/ingestion/sources", payload);

export const updateGeospatialSource = (sourceId: string, payload: GeospatialSourceUpdatePayload) =>
  api.patch<GeospatialSourceRecord>(`/geospatial/ingestion/sources/${sourceId}`, payload);

export const deactivateGeospatialSource = (sourceId: string) =>
  api.post<GeospatialSourceRecord>(`/geospatial/ingestion/sources/${sourceId}/deactivate`);
