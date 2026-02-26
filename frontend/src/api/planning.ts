import api from "./axios";

export type CoveragePoint = {
  latitude: number;
  longitude: number;
  coverage_db: number;
};

export type CoverageResponse = {
  scenario_name: string;
  model_name: string;
  points: CoveragePoint[];
};

export type CoverageRequest = {
  scenario_name: string;
  model_name: string;
  center_latitude: number;
  center_longitude: number;
  radius_km: number;
  transmit_power_dbm: number;
  frequency_mhz: number;
};

export const simulateCoverage = (payload: CoverageRequest) =>
  api.post<CoverageResponse>("/reports/planning/coverage", payload);