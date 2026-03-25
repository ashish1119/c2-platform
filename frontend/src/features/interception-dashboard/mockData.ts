import type {
  InterceptionAlert,
  InterceptionContact,
  InterceptionEvent,
  InterceptionFilterPreset,
  InterceptionPlatformStatus,
  InterceptionReviewCheck,
  InterceptionSeverity,
  InterceptionSnapshot,
  InterceptionZone,
} from "./model";
import schemaData from "./data/synthetic_dashboard_schema.json";
import payloadData from "./data/synthetic_interception_sample_payload.json";

type SyntheticSchema = {
  dashboard_name: string;
  purpose: string;
  safety_constraints: string[];
  global_filters?: Array<{
    id: string;
    type?: string;
    source?: string;
    allowed?: string[];
  }>;
  widgets: Array<{ id: string; label?: string; type?: string }>;
  data_sources: Record<string, { sheet: string; primary_key: string; restriction?: string }>;
};

type CallRecord = {
  record_id: string;
  timestamp_utc: string;
  cell_id: string;
  duration_sec: number;
  call_status: string;
  audio_evidence_ref?: string | null;
};

type SmsRecord = {
  record_id: string;
  timestamp_utc: string;
  delivery_status: string;
};

type OttRecord = {
  record_id: string;
  timestamp_utc: string;
  event_type: string;
};

type AuditRecord = {
  event_time_utc: string;
  user: string;
  action: string;
  reason_code: string;
};

type SyntheticPayload = {
  case_id: string;
  target_ref: string;
  legal_auth_ref: string;
  collection_window: {
    start_utc: string;
    end_utc: string;
  };
  restrictions: string[];
  call_records: CallRecord[];
  sms_records: SmsRecord[];
  ott_metadata: OttRecord[];
  evidence_index?: Array<{
    evidence_ref: string;
    remarks?: string;
  }>;
  audit_log: AuditRecord[];
};

const schema = schemaData as SyntheticSchema;
const payload = payloadData as SyntheticPayload;

function safeTone(value: number, warnAt: number, criticalAt: number): InterceptionSeverity {
  if (value >= criticalAt) {
    return "critical";
  }
  if (value >= warnAt) {
    return "warning";
  }
  return "stable";
}

function statusTone(status: string): InterceptionSeverity {
  const normalized = status.toLowerCase();
  if (normalized.includes("missed") || normalized.includes("no_answer")) {
    return "warning";
  }
  if (normalized.includes("failed")) {
    return "critical";
  }
  return "stable";
}

function callToContact(call: CallRecord, index: number): InterceptionContact {
  const status = call.call_status.toLowerCase();
  const priority: InterceptionContact["priority"] =
    status === "missed" || status === "no_answer"
      ? "medium"
      : call.duration_sec >= 180
        ? "high"
        : "low";

  const contactStatus: InterceptionContact["status"] =
    status === "completed"
      ? "tracking"
      : status === "missed" || status === "no_answer"
        ? "queued"
        : "handoff";

  const confidence = status === "completed" ? 92 : status === "missed" ? 66 : 72;

  return {
    id: call.record_id.toLowerCase(),
    callsign: call.record_id,
    classification: `Voice ${call.call_status.replace("_", " ")}`,
    observedAtUtc: call.timestamp_utc,
    confidence,
    frequencyMHz: Number((432 + index * 1.85).toFixed(3)),
    bearing: (35 + index * 47) % 360,
    source: call.cell_id,
    status: contactStatus,
    priority,
    velocityKph: status === "completed" ? 34 + index * 6 : 8 + index * 2,
    lastSeenLabel: `${Math.max(3, 8 + index * 7)}s ago`,
    location: {
      x: 16 + ((index * 17) % 72),
      y: 20 + ((index * 13) % 64),
    },
  };
}

function buildEvents(calls: CallRecord[], sms: SmsRecord[], ott: OttRecord[], audit: AuditRecord[]): InterceptionEvent[] {
  const auditEvents: InterceptionEvent[] = audit.map((entry, index) => ({
    id: `audit-${index + 1}`,
    timestampUtc: entry.event_time_utc,
    timeLabel: new Date(entry.event_time_utc).toISOString().slice(11, 19) + "Z",
    type: "Audit",
    actor: entry.user,
    detail: `${entry.action} (${entry.reason_code})`,
    outcome: "Logged",
    severity: "info",
  }));

  const callEvents: InterceptionEvent[] = calls.slice(0, 3).map((call, index) => ({
    id: `call-${index + 1}`,
    timestampUtc: call.timestamp_utc,
    timeLabel: new Date(call.timestamp_utc).toISOString().slice(11, 19) + "Z",
    type: "Voice",
    actor: call.record_id,
    detail: `Call status ${call.call_status} from ${call.cell_id} for ${call.duration_sec}s.`,
    outcome: call.call_status === "completed" ? "Captured" : "Review required",
    severity: statusTone(call.call_status),
  }));

  const smsEvents: InterceptionEvent[] = sms.slice(0, 2).map((entry, index) => ({
    id: `sms-${index + 1}`,
    timestampUtc: entry.timestamp_utc,
    timeLabel: new Date(entry.timestamp_utc).toISOString().slice(11, 19) + "Z",
    type: "SMS",
    actor: entry.record_id,
    detail: `SMS delivery status ${entry.delivery_status}.`,
    outcome: "Metadata indexed",
    severity: entry.delivery_status === "delivered" ? "stable" : "warning",
  }));

  const ottEvents: InterceptionEvent[] = ott.slice(0, 2).map((entry, index) => ({
    id: `ott-${index + 1}`,
    timestampUtc: entry.timestamp_utc,
    timeLabel: new Date(entry.timestamp_utc).toISOString().slice(11, 19) + "Z",
    type: "OTT",
    actor: entry.record_id,
    detail: `${entry.event_type} event processed in metadata-only mode.`,
    outcome: "Metadata retained",
    severity: "info",
  }));

  return [...auditEvents, ...callEvents, ...smsEvents, ...ottEvents]
    .sort((a, b) => (a.timeLabel < b.timeLabel ? 1 : -1))
    .slice(0, 8);
}

function buildAlerts(restrictions: string[], calls: CallRecord[]): InterceptionAlert[] {
  const missedCount = calls.filter((call) => {
    const status = call.call_status.toLowerCase();
    return status === "missed" || status === "no_answer";
  }).length;

  return [
    {
      id: "alt-safety-1",
      title: "Synthetic data guardrails",
      detail: restrictions.join(" | "),
      severity: "info",
      status: "acknowledged",
      channel: "Compliance",
    },
    {
      id: "alt-quality-1",
      title: "Voice records requiring review",
      detail: `${missedCount} call records are non-completed and should be reviewed for test validation flows.`,
      severity: missedCount > 0 ? "warning" : "stable",
      status: missedCount > 0 ? "monitoring" : "acknowledged",
      channel: "QA checks",
    },
    {
      id: "alt-safety-2",
      title: "OTT content restriction active",
      detail: "Only OTT metadata is visible. Message bodies are intentionally excluded.",
      severity: "stable",
      status: "open",
      channel: "Policy enforcement",
    },
  ];
}

function buildZones(calls: CallRecord[]): InterceptionZone[] {
  const completed = calls.filter((call) => call.call_status.toLowerCase() === "completed").length;
  const completionRatio = calls.length > 0 ? completed / calls.length : 0;
  const covered = Math.round(65 + completionRatio * 30);

  return [
    {
      id: "zone-1",
      name: "Urban Core",
      coveragePercent: covered,
      riskPercent: 100 - covered + 10,
      status: covered >= 85 ? "covered" : "contested",
      polygon: [
        { x: 16, y: 18 },
        { x: 49, y: 21 },
        { x: 45, y: 46 },
        { x: 14, y: 43 },
      ],
    },
    {
      id: "zone-2",
      name: "Transit Arc",
      coveragePercent: Math.max(48, covered - 20),
      riskPercent: Math.min(84, 58 + Math.round((1 - completionRatio) * 20)),
      status: "contested",
      polygon: [
        { x: 43, y: 28 },
        { x: 84, y: 33 },
        { x: 74, y: 69 },
        { x: 39, y: 62 },
      ],
    },
    {
      id: "zone-3",
      name: "Outer Ring",
      coveragePercent: Math.max(35, covered - 35),
      riskPercent: Math.min(90, 72 + Math.round((1 - completionRatio) * 12)),
      status: "blind",
      polygon: [
        { x: 10, y: 56 },
        { x: 36, y: 62 },
        { x: 28, y: 89 },
        { x: 8, y: 84 },
      ],
    },
  ];
}

function buildPlatforms(dataSources: SyntheticSchema["data_sources"]): InterceptionPlatformStatus[] {
  return Object.entries(dataSources).slice(0, 4).map(([key, value], index) => ({
    id: `platform-${index + 1}`,
    label: key.toUpperCase(),
    value: value.restriction ? "Restricted" : "Online",
    detail: `Sheet ${value.sheet} keyed by ${value.primary_key}${value.restriction ? ` (${value.restriction})` : ""}.`,
    state: value.restriction ? "warning" : "stable",
  }));
}

function buildFilterPresets(schemaConfig: SyntheticSchema, syntheticPayload: SyntheticPayload): InterceptionFilterPreset[] {
  const filters = schemaConfig.global_filters ?? [];
  if (filters.length === 0) {
    return [];
  }

  return filters.map((filter) => {
    const filterType = filter.type ?? "unknown";
    let valueLabel = "Not set";

    if (filter.id === "case_id") {
      valueLabel = syntheticPayload.case_id;
    } else if (filter.id === "time_window") {
      valueLabel = `${syntheticPayload.collection_window.start_utc} to ${syntheticPayload.collection_window.end_utc}`;
    } else if (filter.id === "service_type") {
      const present = [
        syntheticPayload.call_records.length > 0 ? "voice" : null,
        syntheticPayload.sms_records.length > 0 ? "sms" : null,
        syntheticPayload.ott_metadata.length > 0 ? "ott" : null,
      ].filter((value): value is string => Boolean(value));

      valueLabel = present.join(", ");
    } else if (Array.isArray(filter.allowed) && filter.allowed.length > 0) {
      valueLabel = filter.allowed.join(", ");
    }

    const type: InterceptionFilterPreset["type"] =
      filterType === "single_select" || filterType === "multi_select" || filterType === "time_range"
        ? filterType
        : "unknown";

    return {
      id: filter.id,
      label: filter.id.replace(/_/g, " "),
      type,
      source: filter.source,
      allowedValues: filter.allowed,
      valueLabel,
    };
  });
}

function buildReviewChecks(schemaConfig: SyntheticSchema, syntheticPayload: SyntheticPayload): InterceptionReviewCheck[] {
  const reviewWidget = schemaConfig.widgets.find((widget) => widget.id === "review_checks");
  const evidence = syntheticPayload.evidence_index ?? [];
  const restrictedOtt = syntheticPayload.restrictions.includes("metadata_only_for_ott");
  const syntheticOnly = syntheticPayload.restrictions.includes("synthetic_only");
  const noRealAudio = syntheticPayload.restrictions.includes("no_real_audio_included");

  const callsWithAudio = syntheticPayload.call_records.filter((call) => Boolean(call.audio_evidence_ref)).length;
  const evidenceCoverageOk = evidence.length >= callsWithAudio;

  const checks: InterceptionReviewCheck[] = [
    {
      id: "check-synthetic",
      label: "Synthetic data guard active",
      result: syntheticOnly ? "pass" : "fail",
      detail: syntheticOnly ? "Payload restrictions include synthetic_only." : "Missing synthetic_only restriction flag.",
      tone: syntheticOnly ? "stable" : "critical",
    },
    {
      id: "check-ott",
      label: "OTT metadata-only enforcement",
      result: restrictedOtt ? "pass" : "fail",
      detail: restrictedOtt ? "OTT feed remains metadata_only_for_ott." : "OTT restriction flag is missing.",
      tone: restrictedOtt ? "stable" : "critical",
    },
    {
      id: "check-audio",
      label: "No real audio content references",
      result: noRealAudio ? "pass" : "warn",
      detail: noRealAudio ? "Restrictions explicitly mark no_real_audio_included." : "Audio handling restriction should be confirmed.",
      tone: noRealAudio ? "stable" : "warning",
    },
    {
      id: "check-evidence",
      label: "Evidence index coverage",
      result: evidenceCoverageOk ? "pass" : "warn",
      detail: `${evidence.length} indexed entries for ${callsWithAudio} calls that reference evidence files.`,
      tone: evidenceCoverageOk ? "info" : "warning",
    },
  ];

  if (reviewWidget?.type === "table") {
    return checks;
  }

  return checks.slice(0, 3);
}

function buildSyntheticSnapshot(): InterceptionSnapshot {
  const calls = payload.call_records;
  const sms = payload.sms_records;
  const ott = payload.ott_metadata;
  const filters = buildFilterPresets(schema, payload);
  const reviewChecks = buildReviewChecks(schema, payload);

  const voiceCompleted = calls.filter((call) => call.call_status.toLowerCase() === "completed").length;
  const voiceDuration = calls.reduce((total, call) => total + call.duration_sec, 0);
  const reviewCount = calls.filter((call) => {
    const status = call.call_status.toLowerCase();
    return status === "missed" || status === "no_answer";
  }).length;

  const metrics = [
    {
      id: "voice_total",
      label: "Voice records",
      value: calls.length,
      delta: `Schema widget ${schema.widgets.find((widget) => widget.id === "kpi_voice_total")?.id ?? "kpi_voice_total"}`,
      trend: "steady" as const,
      tone: "info" as const,
    },
    {
      id: "voice_completed",
      label: "Completed calls",
      value: voiceCompleted,
      delta: `${Math.round((voiceCompleted / Math.max(calls.length, 1)) * 100)}% completion`,
      trend: voiceCompleted >= calls.length - 1 ? "up" as const : "steady" as const,
      tone: reviewCount > 0 ? "warning" as const : "stable" as const,
    },
    {
      id: "voice_duration",
      label: "Voice duration",
      value: voiceDuration,
      unit: "sec",
      delta: `${Math.round(voiceDuration / Math.max(calls.length, 1))}s avg`,
      trend: "steady" as const,
      tone: "info" as const,
    },
    {
      id: "sms_total",
      label: "SMS records",
      value: sms.length,
      delta: `${sms.filter((entry) => entry.delivery_status === "delivered").length} delivered`,
      trend: "steady" as const,
      tone: "stable" as const,
    },
    {
      id: "ott_total",
      label: "OTT metadata events",
      value: ott.length,
      delta: "Metadata only",
      trend: "steady" as const,
      tone: "info" as const,
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    missionName: `${schema.dashboard_name} (${payload.case_id})`,
    theater: `${payload.target_ref} / ${payload.legal_auth_ref}`,
    posture: "Synthetic compliance mode",
    filters,
    reviewChecks,
    metrics,
    contacts: calls.map(callToContact),
    events: buildEvents(calls, sms, ott, payload.audit_log),
    alerts: buildAlerts(payload.restrictions, calls),
    zones: buildZones(calls),
    platforms: buildPlatforms(schema.data_sources),
    directives: [
      `Purpose: ${schema.purpose}`,
      ...schema.safety_constraints,
    ],
  };
}

export const INTERCEPTION_SNAPSHOTS: InterceptionSnapshot[] = [buildSyntheticSnapshot()];
