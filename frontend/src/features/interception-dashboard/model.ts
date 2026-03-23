export type InterceptionSeverity = "critical" | "warning" | "info" | "stable";

export type InterceptionMetric = {
  id: string;
  label: string;
  value: number;
  unit?: string;
  delta: string;
  trend: "up" | "down" | "steady";
  tone: InterceptionSeverity;
};

export type InterceptionContact = {
  id: string;
  callsign: string;
  classification: string;
  observedAtUtc?: string;
  confidence: number;
  frequencyMHz: number;
  bearing: number;
  source: string;
  status: "tracking" | "queued" | "handoff" | "lost";
  priority: "high" | "medium" | "low";
  velocityKph: number;
  lastSeenLabel: string;
  location: {
    x: number;
    y: number;
  };
};

export type InterceptionEvent = {
  id: string;
  timestampUtc?: string;
  timeLabel: string;
  type: string;
  actor: string;
  detail: string;
  outcome: string;
  severity: InterceptionSeverity;
};

export type InterceptionAlert = {
  id: string;
  title: string;
  detail: string;
  severity: InterceptionSeverity;
  status: "open" | "monitoring" | "acknowledged";
  channel: string;
};

export type InterceptionZone = {
  id: string;
  name: string;
  coveragePercent: number;
  riskPercent: number;
  status: "covered" | "contested" | "blind";
  polygon: Array<{
    x: number;
    y: number;
  }>;
};

export type InterceptionPlatformStatus = {
  id: string;
  label: string;
  value: string;
  detail: string;
  state: InterceptionSeverity;
};

export type InterceptionFilterPreset = {
  id: string;
  label: string;
  type: "single_select" | "multi_select" | "time_range" | "unknown";
  source?: string;
  allowedValues?: string[];
  valueLabel: string;
};

export type InterceptionTimeWindowPreset = "full" | "first_half" | "second_half";

export type InterceptionReviewCheck = {
  id: string;
  label: string;
  result: "pass" | "warn" | "fail";
  detail: string;
  tone: InterceptionSeverity;
};

export type InterceptionSnapshot = {
  generatedAt: string;
  missionName: string;
  theater: string;
  posture: string;
  filters: InterceptionFilterPreset[];
  reviewChecks: InterceptionReviewCheck[];
  metrics: InterceptionMetric[];
  contacts: InterceptionContact[];
  events: InterceptionEvent[];
  alerts: InterceptionAlert[];
  zones: InterceptionZone[];
  platforms: InterceptionPlatformStatus[];
  directives: string[];
};