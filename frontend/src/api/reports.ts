import api from "./axios";

export type StatisticalReport = {
  total_signals: number;
  unique_modulations: number;
  avg_power?: number | null;
  max_frequency?: number | null;
};

export type EOBEntry = {
  emitter_designation: string;
  assessed_capability: string;
  threat_level: string;
  confidence: number;
};

export const getStatisticalReport = (period_start: string, period_end: string) =>
  api.post<StatisticalReport>("/reports/statistical", { period_start, period_end });

export const getEOBReport = (period_start: string, period_end: string, eob_type: string) =>
  api.post<EOBEntry[]>("/reports/eob", { period_start, period_end, eob_type });