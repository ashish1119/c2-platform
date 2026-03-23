export type ScenarioTemplateId =
  | "baseline"
  | "voice_spike"
  | "sms_heavy"
  | "ott_burst"
  | "boundary_window"
  | "data_quality_edge";

export type ScenarioTemplate = {
  id: ScenarioTemplateId;
  label: string;
  description: string;
};

export type ScenarioVolumeConfig = {
  voice: number;
  sms: number;
  ott: number;
  cdr: number;
  audit: number;
  evidence: number;
};

export type ScenarioDistributionConfig = {
  completedPct: number;
  missedPct: number;
  noAnswerPct: number;
  smsDeliveredPct: number;
  smsSubmittedPct: number;
  ottSessionPct: number;
  ottCallSetupPct: number;
  ottAttachmentPct: number;
};

export type ScenarioErrorInjection = {
  nullTimestamps: boolean;
  unknownStatuses: boolean;
  missingEvidenceRefs: boolean;
  duplicateRecordIds: boolean;
  outOfWindowEvents: boolean;
};

export type ScenarioConfig = {
  templateId: ScenarioTemplateId;
  caseId: string;
  startUtc: string;
  endUtc: string;
  includeBoundaryEvents: boolean;
  volumes: ScenarioVolumeConfig;
  distributions: ScenarioDistributionConfig;
  errors: ScenarioErrorInjection;
};

export type SimulationGuardrail = {
  id: string;
  label: string;
  required: boolean;
  status: "pass" | "fail";
  detail: string;
};

export type ValidationStatus = "pass" | "warn" | "fail";

export type ValidationCheckCategory = "kpi" | "filter" | "schema" | "compliance" | "performance";

export type ValidationKpiRow = {
  id: string;
  label: string;
  expected: number;
  actual: number;
  tolerance: number;
  status: ValidationStatus;
};

export type ValidationAssertion = {
  id: string;
  category: ValidationCheckCategory;
  severity: "low" | "medium" | "high";
  status: ValidationStatus;
  message: string;
  suggestedFix: string;
};

export type SimulationPerformanceMetric = {
  id: string;
  label: string;
  p50Ms: number;
  p95Ms: number;
  status: ValidationStatus;
};

export type SimulationTimelineEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
  status: ValidationStatus;
};

export type SimulationRunSummary = {
  runId: string;
  createdAt: string;
  scenarioLabel: string;
  overallStatus: ValidationStatus;
  sourceConfig: ScenarioConfig;
  generatedCounts: ScenarioVolumeConfig;
  summaryCards: Array<{
    id: string;
    label: string;
    value: string;
    tone: ValidationStatus;
  }>;
  kpiRows: ValidationKpiRow[];
  assertions: ValidationAssertion[];
  performance: SimulationPerformanceMetric[];
  timeline: SimulationTimelineEvent[];
  chainOfCustodyChecks: Array<{
    id: string;
    label: string;
    status: ValidationStatus;
    detail: string;
  }>;
};
