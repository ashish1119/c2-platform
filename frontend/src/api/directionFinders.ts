import api from "./axios";

export type DirectionFinderProfileBase = {
  asset_id: string;

  manufacturer: string;
  model_number: string;
  variant_block?: string | null;
  serial_number: string;
  platform_class: string;
  mobility_class: string;
  mission_domain: string;
  lifecycle_state: string;

  antenna_array_type: string;
  antenna_element_count?: number | null;
  antenna_polarization_support: string[];
  receiver_channel_count?: number | null;
  sample_rate_max_sps?: number | null;
  frequency_reference_type?: string | null;
  frequency_reference_accuracy_ppb?: number | null;
  timing_holdover_seconds?: number | null;

  rf_min_mhz: number;
  rf_max_mhz: number;
  instantaneous_bandwidth_hz?: number | null;
  df_methods_supported: string[];
  bearing_accuracy_deg_rms?: number | null;
  bearing_output_reference?: string | null;
  sensitivity_dbm?: number | null;
  dynamic_range_db?: number | null;
  calibration_profile_id?: string | null;

  deployment_mode?: string | null;
  site_id?: string | null;
  mount_height_agl_m?: number | null;
  sensor_boresight_offset_deg?: number | null;
  heading_alignment_offset_deg?: number | null;
  lever_arm_offset_m: Record<string, number>;
  geodetic_datum: string;
  altitude_reference: string;
  survey_position_accuracy_m?: number | null;

  network_node_id?: string | null;
  primary_ipv4?: string | null;
  transport_protocols: string[];
  message_protocols: string[];
  data_format_profiles: string[];
  time_sync_protocol?: string | null;
  ptp_profile?: string | null;
  api_version?: string | null;
  interoperability_profile?: string | null;

  security_classification: string;
  releasability_marking?: string | null;
  authz_policy_id?: string | null;
  data_in_transit_encryption?: string | null;
  secure_boot_enabled: boolean;
  audit_policy_id?: string | null;

  firmware_version?: string | null;
  software_stack_version?: string | null;
  configuration_baseline_id?: string | null;
  calibration_due_date?: string | null;
  mtbf_hours?: number | null;
  maintenance_echelon?: string | null;
};

export type DirectionFinderProfileRecord = DirectionFinderProfileBase & {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type DirectionFinderProfileCreate = DirectionFinderProfileBase;
export type DirectionFinderProfileUpdate = Partial<Omit<DirectionFinderProfileBase, "asset_id">>;

export const getDirectionFinderProfiles = () =>
  api.get<DirectionFinderProfileRecord[]>("/direction-finders");

export const createDirectionFinderProfile = (payload: DirectionFinderProfileCreate) =>
  api.post<DirectionFinderProfileRecord>("/direction-finders", payload);

export const updateDirectionFinderProfile = (
  profileId: string,
  payload: DirectionFinderProfileUpdate
) => api.patch<DirectionFinderProfileRecord>(`/direction-finders/${profileId}`, payload);

export const deleteDirectionFinderProfile = (profileId: string) =>
  api.delete<{ deleted: boolean }>(`/direction-finders/${profileId}`);

export const exportDirectionFindersCsv = () =>
  api.get("/direction-finders/export/csv");

export const exportDirectionFindersXml = () =>
  api.get("/direction-finders/export/xml");

export const importDirectionFindersCsv = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/direction-finders/import/csv", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const importDirectionFindersXml = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/direction-finders/import/xml", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
