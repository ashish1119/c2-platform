import api from "./axios";

export const SUPPORTED_SOURCE_TYPES = [
  "ADS_B",
  "AIS",
  "BATHYMETRY",
  "LIDAR",
  "RASTER",
  "SAR",
  "SIGINT",
  "UAV_IMAGERY",
  "VECTOR",
] as const;

export type SourceType = (typeof SUPPORTED_SOURCE_TYPES)[number];

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

export type GeospatialSourceRegisterRequest = {
  source_name: string;
  source_type: string;
  transport: string;
  classification: string;
  metadata: {
    fileIdentifier: string;
    language: string;
    dateStamp: string;
    identificationInfo: {
      title: string;
      abstract: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
};

export type GeospatialSourceUpdateRequest = {
  source_name?: string;
  source_type?: string;
  transport?: string;
  classification?: string;
  metadata?: Record<string, unknown>;
};

export const listGeospatialSources = (activeOnly = false) =>
  api.get<GeospatialSourceRecord[]>("/geospatial/ingestion/sources", {
    params: activeOnly ? { active_only: true } : undefined,
  });

export const registerGeospatialSource = (payload: GeospatialSourceRegisterRequest) =>
  api.post<GeospatialSourceRecord>("/geospatial/ingestion/sources", payload);

export const updateGeospatialSource = (sourceId: string, payload: GeospatialSourceUpdateRequest) =>
  api.patch<GeospatialSourceRecord>(`/geospatial/ingestion/sources/${sourceId}`, payload);

export const deactivateGeospatialSource = (sourceId: string) =>
  api.post<GeospatialSourceRecord>(`/geospatial/ingestion/sources/${sourceId}/deactivate`);

export const activateGeospatialSource = (sourceId: string) =>
  api.post<GeospatialSourceRecord>(`/geospatial/ingestion/sources/${sourceId}/activate`);
