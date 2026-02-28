import api from "./axios";

export type JammerProfileBase = {
  asset_id: string;

  manufacturer: string;
  model_number: string;
  variant_block?: string | null;
  serial_number: string;
  asset_class: string;
  jammer_subtype: string;
  mission_domain: string;
  lifecycle_state: string;

  dimensions_l_m?: number | null;
  dimensions_w_m?: number | null;
  dimensions_h_m?: number | null;
  weight_kg?: number | null;
  environmental_rating?: string | null;
  operating_temp_min_c?: number | null;
  operating_temp_max_c?: number | null;
  ingress_protection_rating?: string | null;

  platform_type: string;
  mounting_configuration?: string | null;
  antenna_configuration?: string | null;
  vehicle_power_bus_type?: string | null;
  cooling_integration_type?: string | null;
  time_source_interface?: string | null;

  rf_coverage_min_mhz: number;
  rf_coverage_max_mhz: number;
  max_effective_radiated_power_dbm?: number | null;
  simultaneous_channels_max?: number | null;
  waveform_family_support: string[];
  modulation_support: string[];
  geolocation_method_support: string[];
  preset_technique_library_id?: string | null;

  input_voltage_min_v?: number | null;
  input_voltage_max_v?: number | null;
  nominal_power_draw_w?: number | null;
  peak_power_draw_w?: number | null;
  battery_backup_present: boolean;
  battery_backup_duration_min?: number | null;
  mtbf_hours?: number | null;
  built_in_test_level?: string | null;
  secure_boot_supported: boolean;
  tamper_detection_supported: boolean;

  c2_interface_profiles: string[];
  ip_stack_support: string[];
  message_bus_protocols: string[];
  api_spec_version?: string | null;
  data_model_standard_refs: string[];
  interoperability_cert_level?: string | null;

  spectrum_authorization_profile?: string | null;
  emissions_control_policy_id?: string | null;
  rules_of_employment_profile_id?: string | null;
  geofencing_policy_id?: string | null;
  legal_jurisdiction_tags: string[];
  doctrinal_role_tags: string[];

  security_classification: string;
  crypto_module_type?: string | null;
  authn_methods_supported: string[];
  authz_role_profile_id?: string | null;
  command_authorization_level?: string | null;
  data_at_rest_encryption?: string | null;
  data_in_transit_encryption?: string | null;
  audit_policy_id?: string | null;
  secure_logging_enabled: boolean;
  patch_baseline_version?: string | null;
};

export type JammerProfileRecord = JammerProfileBase & {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type JammerProfileCreate = JammerProfileBase;
export type JammerProfileUpdate = Partial<Omit<JammerProfileBase, "asset_id">>;

export const getJammerProfiles = () => api.get<JammerProfileRecord[]>("/jammers");

export const getJammerProfile = (profileId: string) => api.get<JammerProfileRecord>(`/jammers/${profileId}`);

export const createJammerProfile = (payload: JammerProfileCreate) =>
  api.post<JammerProfileRecord>("/jammers", payload);

export const updateJammerProfile = (profileId: string, payload: JammerProfileUpdate) =>
  api.patch<JammerProfileRecord>(`/jammers/${profileId}`, payload);

export const deleteJammerProfile = (profileId: string) => api.delete<{ deleted: boolean }>(`/jammers/${profileId}`);
