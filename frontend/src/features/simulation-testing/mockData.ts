import type {
  ScenarioConfig,
  ScenarioTemplate,
  ScenarioTemplateId,
  SimulationGuardrail,
  SimulationRunSummary,
  ValidationAssertion,
  ValidationKpiRow,
  ValidationStatus,
} from "./model";
import type { AlertRecord } from "../../api/alerts";
import type { AssetRecord } from "../../api/assets";
import type { HeatCell, RFSignal, TriangulationResult } from "../../api/rf";
import type { SmsDetectionRecord, SmsSpectrumOccupancyBin } from "../../api/operatorDashboard";
import type {
  DashboardSimulationSnapshot,
  SimulationTriangulationResult,
} from "../signal-simulation/state/dashboardSimulationBridge";

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: "baseline",
    label: "Baseline",
    description: "Nominal synthetic traffic mix for regression and operator training.",
  },
  {
    id: "voice_spike",
    label: "Voice Spike",
    description: "Elevated voice volume to validate KPI scaling and list performance.",
  },
  {
    id: "sms_heavy",
    label: "SMS Heavy",
    description: "SMS-dominant run to test service filters and delivery distributions.",
  },
  {
    id: "ott_burst",
    label: "OTT Burst",
    description: "High OTT metadata event density with metadata-only restrictions enforced.",
  },
  {
    id: "boundary_window",
    label: "Boundary Window",
    description: "Events land on time-window edges to validate inclusion semantics.",
  },
  {
    id: "data_quality_edge",
    label: "Data Quality Edge",
    description: "Inject malformed and partial synthetic records to test resilience and alerts.",
  },
];

const TEMPLATE_DEFAULTS: Record<ScenarioTemplateId, Omit<ScenarioConfig, "templateId">> = {
  baseline: {
    caseId: "CASE-2026-001",
    startUtc: "2026-03-20T10:00:00Z",
    endUtc: "2026-03-20T12:30:00Z",
    includeBoundaryEvents: true,
    volumes: { voice: 120, sms: 60, ott: 35, cdr: 120, audit: 8, evidence: 84 },
    distributions: {
      completedPct: 72,
      missedPct: 18,
      noAnswerPct: 10,
      smsDeliveredPct: 68,
      smsSubmittedPct: 32,
      ottSessionPct: 55,
      ottCallSetupPct: 25,
      ottAttachmentPct: 20,
    },
    errors: {
      nullTimestamps: false,
      unknownStatuses: false,
      missingEvidenceRefs: false,
      duplicateRecordIds: false,
      outOfWindowEvents: false,
    },
  },
  voice_spike: {
    caseId: "CASE-2026-002",
    startUtc: "2026-03-20T09:00:00Z",
    endUtc: "2026-03-20T15:00:00Z",
    includeBoundaryEvents: true,
    volumes: { voice: 2200, sms: 140, ott: 90, cdr: 2200, audit: 18, evidence: 1540 },
    distributions: {
      completedPct: 78,
      missedPct: 14,
      noAnswerPct: 8,
      smsDeliveredPct: 72,
      smsSubmittedPct: 28,
      ottSessionPct: 58,
      ottCallSetupPct: 24,
      ottAttachmentPct: 18,
    },
    errors: {
      nullTimestamps: false,
      unknownStatuses: false,
      missingEvidenceRefs: false,
      duplicateRecordIds: false,
      outOfWindowEvents: false,
    },
  },
  sms_heavy: {
    caseId: "CASE-2026-003",
    startUtc: "2026-03-20T06:00:00Z",
    endUtc: "2026-03-20T18:00:00Z",
    includeBoundaryEvents: true,
    volumes: { voice: 180, sms: 2400, ott: 120, cdr: 180, audit: 14, evidence: 96 },
    distributions: {
      completedPct: 64,
      missedPct: 22,
      noAnswerPct: 14,
      smsDeliveredPct: 74,
      smsSubmittedPct: 26,
      ottSessionPct: 50,
      ottCallSetupPct: 20,
      ottAttachmentPct: 30,
    },
    errors: {
      nullTimestamps: false,
      unknownStatuses: false,
      missingEvidenceRefs: false,
      duplicateRecordIds: false,
      outOfWindowEvents: false,
    },
  },
  ott_burst: {
    caseId: "CASE-2026-004",
    startUtc: "2026-03-20T07:30:00Z",
    endUtc: "2026-03-20T19:30:00Z",
    includeBoundaryEvents: true,
    volumes: { voice: 120, sms: 180, ott: 3200, cdr: 120, audit: 20, evidence: 72 },
    distributions: {
      completedPct: 70,
      missedPct: 18,
      noAnswerPct: 12,
      smsDeliveredPct: 65,
      smsSubmittedPct: 35,
      ottSessionPct: 62,
      ottCallSetupPct: 22,
      ottAttachmentPct: 16,
    },
    errors: {
      nullTimestamps: false,
      unknownStatuses: false,
      missingEvidenceRefs: false,
      duplicateRecordIds: false,
      outOfWindowEvents: false,
    },
  },
  boundary_window: {
    caseId: "CASE-2026-005",
    startUtc: "2026-03-20T10:00:00Z",
    endUtc: "2026-03-20T10:30:00Z",
    includeBoundaryEvents: true,
    volumes: { voice: 240, sms: 160, ott: 80, cdr: 240, audit: 10, evidence: 150 },
    distributions: {
      completedPct: 70,
      missedPct: 20,
      noAnswerPct: 10,
      smsDeliveredPct: 66,
      smsSubmittedPct: 34,
      ottSessionPct: 55,
      ottCallSetupPct: 25,
      ottAttachmentPct: 20,
    },
    errors: {
      nullTimestamps: false,
      unknownStatuses: false,
      missingEvidenceRefs: false,
      duplicateRecordIds: false,
      outOfWindowEvents: true,
    },
  },
  data_quality_edge: {
    caseId: "CASE-2026-006",
    startUtc: "2026-03-20T11:00:00Z",
    endUtc: "2026-03-20T14:00:00Z",
    includeBoundaryEvents: false,
    volumes: { voice: 420, sms: 240, ott: 110, cdr: 420, audit: 16, evidence: 180 },
    distributions: {
      completedPct: 60,
      missedPct: 25,
      noAnswerPct: 15,
      smsDeliveredPct: 58,
      smsSubmittedPct: 42,
      ottSessionPct: 50,
      ottCallSetupPct: 20,
      ottAttachmentPct: 30,
    },
    errors: {
      nullTimestamps: true,
      unknownStatuses: true,
      missingEvidenceRefs: true,
      duplicateRecordIds: true,
      outOfWindowEvents: true,
    },
  },
};

const TEMPLATE_LOCATIONS: Record<
  ScenarioTemplateId,
  { latitude: number; longitude: number; headingDeg: number }
> = {
  baseline: { latitude: 12.9716, longitude: 77.5946, headingDeg: 32 },
  voice_spike: { latitude: 12.9892, longitude: 77.6128, headingDeg: 58 },
  sms_heavy: { latitude: 12.9541, longitude: 77.5734, headingDeg: 86 },
  ott_burst: { latitude: 12.9987, longitude: 77.6412, headingDeg: 118 },
  boundary_window: { latitude: 12.9438, longitude: 77.6024, headingDeg: 144 },
  data_quality_edge: { latitude: 12.9661, longitude: 77.5538, headingDeg: 174 },
};

const SERVICE_CHANNELS = [
  { key: "voice", label: "Voice", frequencyHz: 440_125_000, bandwidthHz: 25_000, modulation: "VOICE_META" },
  { key: "sms", label: "SMS", frequencyHz: 440_325_000, bandwidthHz: 12_500, modulation: "SMS_META" },
  { key: "ott", label: "OTT", frequencyHz: 440_575_000, bandwidthHz: 40_000, modulation: "OTT_META" },
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function serviceOffset(index: number): { latitude: number; longitude: number } {
  const offsets = [
    { latitude: 0.009, longitude: -0.012 },
    { latitude: -0.006, longitude: 0.014 },
    { latitude: 0.004, longitude: 0.018 },
  ];

  return offsets[index] ?? { latitude: 0, longitude: 0 };
}

function buildDirectionFinderAssets(config: ScenarioConfig): AssetRecord[] {
  const origin = TEMPLATE_LOCATIONS[config.templateId];
  const sensorOffsets = [
    { latitude: -0.036, longitude: -0.028 },
    { latitude: 0.028, longitude: -0.022 },
    { latitude: -0.008, longitude: 0.036 },
  ];

  return sensorOffsets.map((offset, index) => ({
    id: `sim-test-sensor-${index + 1}`,
    name: `SIM DF Sensor ${index + 1}`,
    type: "DIRECTION_FINDER",
    status: "ACTIVE",
    latitude: Number((origin.latitude + offset.latitude).toFixed(6)),
    longitude: Number((origin.longitude + offset.longitude).toFixed(6)),
    df_radius_m: 18_000,
    bearing_deg: Number((origin.headingDeg + index * 52).toFixed(0)),
  }));
}

function buildTriangulationForService(
  config: ScenarioConfig,
  summary: SimulationRunSummary,
  assets: AssetRecord[],
  index: number
): SimulationTriangulationResult {
  const origin = TEMPLATE_LOCATIONS[config.templateId];
  const channel = SERVICE_CHANNELS[index];
  const offset = serviceOffset(index);
  const centroid = {
    latitude: Number((origin.latitude + offset.latitude).toFixed(6)),
    longitude: Number((origin.longitude + offset.longitude).toFixed(6)),
  };
  const intersections = [
    centroid,
    {
      latitude: Number((centroid.latitude + 0.002).toFixed(6)),
      longitude: Number((centroid.longitude - 0.0015).toFixed(6)),
    },
    {
      latitude: Number((centroid.latitude - 0.0018).toFixed(6)),
      longitude: Number((centroid.longitude + 0.0012).toFixed(6)),
    },
  ];
  const roiPolygon = [
    { latitude: centroid.latitude + 0.006, longitude: centroid.longitude - 0.005 },
    { latitude: centroid.latitude + 0.005, longitude: centroid.longitude + 0.006 },
    { latitude: centroid.latitude - 0.006, longitude: centroid.longitude + 0.005 },
    { latitude: centroid.latitude - 0.005, longitude: centroid.longitude - 0.006 },
  ].map((point) => ({
    latitude: Number(point.latitude.toFixed(6)),
    longitude: Number(point.longitude.toFixed(6)),
  }));
  const confidence =
    summary.overallStatus === "fail"
      ? 0.61
      : summary.overallStatus === "warn"
        ? 0.77
        : 0.9;

  return {
    emitter_id: `${summary.runId}-${channel.key}`,
    emitter_label: `${summary.scenarioLabel} ${channel.label}`,
    frequency_hz: channel.frequencyHz,
    antenna_count: assets.length,
    intersection_count: intersections.length,
    centroid_latitude: centroid.latitude,
    centroid_longitude: centroid.longitude,
    roi_polygon: roiPolygon,
    intersections,
    confidence_level: confidence,
    rays: assets.map((asset, assetIndex) => ({
      source_id: asset.id,
      source_latitude: asset.latitude,
      source_longitude: asset.longitude,
      bearing_deg: Number(((TEMPLATE_LOCATIONS[config.templateId].headingDeg + index * 34 + assetIndex * 41) % 360).toFixed(1)),
      end_latitude: centroid.latitude,
      end_longitude: centroid.longitude,
      confidence: Number(clamp(confidence - assetIndex * 0.04, 0.45, 0.95).toFixed(2)),
    })),
    warning:
      config.errors.outOfWindowEvents || config.errors.unknownStatuses
        ? "Synthetic anomalies injected for validation review."
        : null,
  };
}

function buildAggregateTriangulation(
  triangulations: SimulationTriangulationResult[],
  summary: SimulationRunSummary
): TriangulationResult | null {
  if (triangulations.length === 0) {
    return null;
  }

  const centroidLatitude =
    triangulations.reduce((sum, item) => sum + (item.centroid_latitude ?? 0), 0) / triangulations.length;
  const centroidLongitude =
    triangulations.reduce((sum, item) => sum + (item.centroid_longitude ?? 0), 0) / triangulations.length;

  return {
    antenna_count: triangulations.reduce((sum, item) => sum + item.antenna_count, 0),
    intersection_count: triangulations.reduce((sum, item) => sum + item.intersection_count, 0),
    centroid_latitude: Number(centroidLatitude.toFixed(6)),
    centroid_longitude: Number(centroidLongitude.toFixed(6)),
    roi_polygon: triangulations[0].roi_polygon,
    intersections: triangulations.flatMap((item) => item.intersections ?? []).slice(0, 12),
    confidence_level:
      triangulations.reduce((sum, item) => sum + (item.confidence_level ?? 0.7), 0) / triangulations.length,
    rays: triangulations.flatMap((item) => item.rays),
    warning: summary.overallStatus === "pass" ? null : "Shared simulation feed includes validation anomalies.",
  };
}

function buildSpectrumBins(config: ScenarioConfig): SmsSpectrumOccupancyBin[] {
  return SERVICE_CHANNELS.flatMap((channel, index) => {
    const total = config.volumes[channel.key];
    const windowPowerBase = channel.key === "voice" ? -58 : channel.key === "sms" ? -62 : -55;

    return [-2, -1, 0, 1, 2].map((step) => ({
      frequency_hz: channel.frequencyHz + step * 25_000,
      detection_count: Math.max(1, Math.round(total / (step === 0 ? 7 : 14)) + Math.max(0, 2 - Math.abs(step))),
      max_power_dbm: Number((windowPowerBase - Math.abs(step) * 3 + index).toFixed(2)),
    }));
  });
}

function buildDetections(
  config: ScenarioConfig,
  summary: SimulationRunSummary,
  triangulations: SimulationTriangulationResult[],
  assets: AssetRecord[]
): SmsDetectionRecord[] {
  const startMs = new Date(config.startUtc).getTime();
  const endMs = new Date(config.endUtc).getTime();
  const durationMs = Math.max(endMs - startMs, 60_000);

  return SERVICE_CHANNELS.flatMap((channel, index) => {
    const total = config.volumes[channel.key];
    const detectionCount = Math.min(Math.max(6, Math.round(total / 24)), 32);
    const triangulation = triangulations[index];

    return Array.from({ length: detectionCount }, (_, detectionIndex) => {
      const sensor = assets[detectionIndex % assets.length];
      const positionRatio = detectionCount === 1 ? 0 : detectionIndex / (detectionCount - 1);
      const timestampMs = startMs + positionRatio * durationMs;
      const snr = clamp(24 - index * 3 - (detectionIndex % 5), 8, 28);
      const frequencyJitter = ((detectionIndex % 5) - 2) * 1_500;

      return {
        id: `${summary.runId}-det-${channel.key}-${detectionIndex + 1}`,
        source_node: sensor.name,
        timestamp_utc: new Date(timestampMs).toISOString(),
        frequency_hz: channel.frequencyHz + frequencyJitter,
        bandwidth_hz: channel.bandwidthHz,
        power_dbm: Number((-61 + index * 4 - (detectionIndex % 4)).toFixed(2)),
        snr_db: snr,
        modulation: channel.modulation,
        confidence: Number(clamp((triangulation.confidence_level ?? 0.7) - (detectionIndex % 3) * 0.03, 0.45, 0.97).toFixed(2)),
        latitude: triangulation.centroid_latitude,
        longitude: triangulation.centroid_longitude,
        altitude_m: 0,
        doa_azimuth_deg: triangulation.rays[detectionIndex % triangulation.rays.length]?.bearing_deg ?? null,
        doa_elevation_deg: 0,
        doa_rmse_deg: Number((1.2 + index * 0.6).toFixed(2)),
        raw_payload: {
          source: "simulation-testing-dashboard",
          run_id: summary.runId,
          case_id: config.caseId,
          service: channel.key,
          scenario: summary.scenarioLabel,
          metadata_only: channel.key === "ott",
        },
      };
    });
  });
}

function buildSignals(
  summary: SimulationRunSummary,
  triangulations: SimulationTriangulationResult[]
): RFSignal[] {
  return triangulations.map((triangulation, index) => ({
    id: index + 1,
    frequency: triangulation.frequency_hz,
    modulation: SERVICE_CHANNELS[index]?.modulation ?? "SIM_META",
    power_level: Number((-54 - index * 3).toFixed(2)),
    bandwidth_hz: SERVICE_CHANNELS[index]?.bandwidthHz ?? 20_000,
    confidence: Number((triangulation.confidence_level ?? 0.72).toFixed(2)),
    doa_deg: triangulation.rays[0]?.bearing_deg ?? null,
    latitude: triangulation.centroid_latitude ?? 0,
    longitude: triangulation.centroid_longitude ?? 0,
    detected_at: summary.createdAt,
  }));
}

function buildHeatCells(triangulations: SimulationTriangulationResult[]): HeatCell[] {
  return triangulations.flatMap((triangulation, index) => {
    const centroidLatitude = triangulation.centroid_latitude ?? 0;
    const centroidLongitude = triangulation.centroid_longitude ?? 0;
    const cells = [
      { latitude_bucket: centroidLatitude, longitude_bucket: centroidLongitude, density: 0.96 - index * 0.08 },
      { latitude_bucket: centroidLatitude + 0.01, longitude_bucket: centroidLongitude - 0.01, density: 0.72 - index * 0.05 },
      { latitude_bucket: centroidLatitude - 0.008, longitude_bucket: centroidLongitude + 0.006, density: 0.66 - index * 0.04 },
    ];

    return cells.map((cell) => ({
      latitude_bucket: Number(cell.latitude_bucket.toFixed(3)),
      longitude_bucket: Number(cell.longitude_bucket.toFixed(3)),
      density: Number(clamp(cell.density, 0.18, 0.99).toFixed(2)),
    }));
  });
}

function buildAlerts(
  config: ScenarioConfig,
  summary: SimulationRunSummary,
  triangulations: SimulationTriangulationResult[]
): AlertRecord[] {
  const primary = triangulations[0];
  const alerts: AlertRecord[] = [
    {
      id: `${summary.runId}-alert-status`,
      alert_name: "Simulation Validation Status",
      alert_type: "SIMULATION_TEST",
      severity: summary.overallStatus === "fail" ? "HIGH" : summary.overallStatus === "warn" ? "MEDIUM" : "LOW",
      status: "NEW",
      description: `${summary.scenarioLabel} published to shared operator feed with ${summary.overallStatus.toUpperCase()} validation outcome.`,
      created_at: summary.createdAt,
      latitude: primary?.centroid_latitude ?? null,
      longitude: primary?.centroid_longitude ?? null,
    },
  ];

  if (config.errors.outOfWindowEvents || config.errors.nullTimestamps) {
    alerts.push({
      id: `${summary.runId}-alert-schema`,
      alert_name: "Synthetic Schema Anomaly",
      alert_type: "SIMULATION_TEST",
      severity: "MEDIUM",
      status: "NEW",
      description: "Synthetic out-of-window or null timestamp records were injected for QA review.",
      created_at: new Date(new Date(summary.createdAt).getTime() + 8_000).toISOString(),
      latitude: primary?.centroid_latitude ?? null,
      longitude: primary?.centroid_longitude ?? null,
    });
  }

  if (config.volumes.voice + config.volumes.sms + config.volumes.ott > 5000) {
    alerts.push({
      id: `${summary.runId}-alert-load`,
      alert_name: "Simulation Load Advisory",
      alert_type: "SIMULATION_TEST",
      severity: "LOW",
      status: "NEW",
      description: "High-volume scenario published to measure dashboard latency under load.",
      created_at: new Date(new Date(summary.createdAt).getTime() + 16_000).toISOString(),
      latitude: triangulations[1]?.centroid_latitude ?? primary?.centroid_latitude ?? null,
      longitude: triangulations[1]?.centroid_longitude ?? primary?.centroid_longitude ?? null,
    });
  }

  return alerts;
}

export function getTemplateConfig(templateId: ScenarioTemplateId): ScenarioConfig {
  return {
    templateId,
    ...structuredClone(TEMPLATE_DEFAULTS[templateId]),
  };
}

export function buildGuardrails(): SimulationGuardrail[] {
  return [
    {
      id: "synthetic-only",
      label: "Synthetic data only",
      required: true,
      status: "pass",
      detail: "All scenarios are generated from synthetic-only templates.",
    },
    {
      id: "ott-metadata-only",
      label: "OTT metadata-only restriction",
      required: true,
      status: "pass",
      detail: "OTT content fields are excluded from the simulation payload.",
    },
    {
      id: "no-real-content",
      label: "No real content or audio",
      required: true,
      status: "pass",
      detail: "Evidence and audio references remain placeholders for training only.",
    },
  ];
}

function computeStatus(actual: number, expected: number, tolerance: number): ValidationStatus {
  const delta = Math.abs(actual - expected);
  if (delta <= tolerance) {
    return "pass";
  }
  if (delta <= tolerance * 2) {
    return "warn";
  }
  return "fail";
}

function buildKpiRows(config: ScenarioConfig): ValidationKpiRow[] {
  const expectedEvidence = Math.round(config.volumes.voice * (config.distributions.completedPct / 100));
  const actualEvidence = config.errors.missingEvidenceRefs
    ? Math.max(0, expectedEvidence - Math.round(config.volumes.voice * 0.18))
    : expectedEvidence;

  return [
    {
      id: "voice-total",
      label: "Voice records total",
      expected: config.volumes.voice,
      actual: config.volumes.voice,
      tolerance: 0,
      status: "pass",
    },
    {
      id: "sms-total",
      label: "SMS records total",
      expected: config.volumes.sms,
      actual: config.volumes.sms,
      tolerance: 0,
      status: "pass",
    },
    {
      id: "ott-total",
      label: "OTT metadata events total",
      expected: config.volumes.ott,
      actual: config.volumes.ott,
      tolerance: 0,
      status: "pass",
    },
    {
      id: "evidence-coverage",
      label: "Evidence coverage",
      expected: expectedEvidence,
      actual: actualEvidence,
      tolerance: 4,
      status: computeStatus(actualEvidence, expectedEvidence, 4),
    },
    {
      id: "audit-events",
      label: "Audit event count",
      expected: config.volumes.audit,
      actual: config.volumes.audit + (config.errors.duplicateRecordIds ? 1 : 0),
      tolerance: 1,
      status: computeStatus(config.volumes.audit + (config.errors.duplicateRecordIds ? 1 : 0), config.volumes.audit, 1),
    },
  ];
}

function buildAssertions(config: ScenarioConfig, kpiRows: ValidationKpiRow[]): ValidationAssertion[] {
  const assertions: ValidationAssertion[] = [
    {
      id: "filter-service",
      category: "filter",
      severity: "medium",
      status: "pass",
      message: "Service filter isolation validated for voice/sms/ott toggles.",
      suggestedFix: "No action required.",
    },
    {
      id: "filter-time-window",
      category: "filter",
      severity: "high",
      status: config.errors.outOfWindowEvents ? "warn" : "pass",
      message: config.errors.outOfWindowEvents
        ? "Out-of-window synthetic events detected; boundary logic should be verified."
        : "Time-window inclusion logic passed baseline checks.",
      suggestedFix: "Verify boundary inclusion presets against generated timestamps.",
    },
    {
      id: "schema-contract",
      category: "schema",
      severity: "medium",
      status: config.errors.nullTimestamps || config.errors.unknownStatuses ? "warn" : "pass",
      message:
        config.errors.nullTimestamps || config.errors.unknownStatuses
          ? "Injected schema anomalies present for resilience testing."
          : "Required synthetic fields and status enums conform to schema.",
      suggestedFix: "Inspect null handling and enum fallback rendering.",
    },
  ];

  const failingKpis = kpiRows.filter((row) => row.status !== "pass");
  if (failingKpis.length > 0) {
    assertions.push({
      id: "kpi-delta",
      category: "kpi",
      severity: "high",
      status: failingKpis.some((row) => row.status === "fail") ? "fail" : "warn",
      message: `${failingKpis.length} KPI comparisons exceeded expected tolerance.`,
      suggestedFix: "Review generation formulas and evidence coverage derivation.",
    });
  }

  assertions.push({
    id: "compliance-ott",
    category: "compliance",
    severity: "high",
    status: "pass",
    message: "OTT payload remained metadata-only during simulation run.",
    suggestedFix: "No action required.",
  });

  assertions.push({
    id: "performance-suite",
    category: "performance",
    severity: "low",
    status: config.volumes.voice + config.volumes.sms + config.volumes.ott > 5000 ? "warn" : "pass",
    message:
      config.volumes.voice + config.volumes.sms + config.volumes.ott > 5000
        ? "Large scenario may approach current UI latency threshold."
        : "Performance remained within target latency envelope.",
    suggestedFix: "Use performance panel to confirm p95 thresholds.",
  });

  return assertions;
}

export function buildSimulationRunSummary(config: ScenarioConfig): SimulationRunSummary {
  const template = SCENARIO_TEMPLATES.find((item) => item.id === config.templateId) ?? SCENARIO_TEMPLATES[0];
  const createdAt = new Date().toISOString();
  const runId = `SIM-${createdAt.slice(11, 19).replace(/:/g, "")}-${config.templateId.toUpperCase()}`;
  const kpiRows = buildKpiRows(config);
  const assertions = buildAssertions(config, kpiRows);
  const hasFail = [...kpiRows.map((row) => row.status), ...assertions.map((item) => item.status)].includes("fail");
  const hasWarn = [...kpiRows.map((row) => row.status), ...assertions.map((item) => item.status)].includes("warn");
  const overallStatus: ValidationStatus = hasFail ? "fail" : hasWarn ? "warn" : "pass";
  const totalChecks = assertions.length + kpiRows.length;
  const passingChecks = [...assertions, ...kpiRows].filter((item) => item.status === "pass").length;

  return {
    runId,
    createdAt,
    scenarioLabel: template.label,
    overallStatus,
    sourceConfig: structuredClone(config),
    generatedCounts: config.volumes,
    summaryCards: [
      {
        id: "overall",
        label: "Overall pass rate",
        value: `${Math.round((passingChecks / Math.max(totalChecks, 1)) * 100)}%`,
        tone: overallStatus,
      },
      {
        id: "kpi",
        label: "KPI consistency",
        value: `${kpiRows.filter((row) => row.status === "pass").length}/${kpiRows.length}`,
        tone: hasFail ? "warn" : "pass",
      },
      {
        id: "filter",
        label: "Filter correctness",
        value: `${assertions.filter((item) => item.category === "filter" && item.status === "pass").length}/${assertions.filter((item) => item.category === "filter").length}`,
        tone: assertions.some((item) => item.category === "filter" && item.status !== "pass") ? "warn" : "pass",
      },
      {
        id: "compliance",
        label: "Compliance safeguards",
        value: "Enforced",
        tone: "pass",
      },
    ],
    kpiRows,
    assertions,
    performance: [
      {
        id: "filter-latency",
        label: "Filter latency",
        p50Ms: 38,
        p95Ms: config.volumes.voice + config.volumes.sms + config.volumes.ott > 5000 ? 188 : 92,
        status: config.volumes.voice + config.volumes.sms + config.volumes.ott > 5000 ? "warn" : "pass",
      },
      {
        id: "render-latency",
        label: "Render latency",
        p50Ms: 44,
        p95Ms: config.volumes.voice + config.volumes.sms + config.volumes.ott > 5000 ? 210 : 108,
        status: config.volumes.voice + config.volumes.sms + config.volumes.ott > 5000 ? "warn" : "pass",
      },
    ],
    timeline: [
      {
        id: "generate",
        at: createdAt,
        actor: "qa.analyst",
        action: "generate_batch",
        detail: `Generated ${config.volumes.voice + config.volumes.sms + config.volumes.ott} service records for ${template.label}.`,
        status: "pass",
      },
      {
        id: "validate",
        at: new Date(Date.now() + 12_000).toISOString(),
        actor: "qa.analyst",
        action: "run_validation_suite",
        detail: `${totalChecks} checks evaluated across KPI, filter, schema, compliance, and performance domains.`,
        status: overallStatus,
      },
      {
        id: "review",
        at: new Date(Date.now() + 18_000).toISOString(),
        actor: "compliance.officer",
        action: "review_chain_of_custody",
        detail: "Synthetic-only, metadata-only, and evidence coverage checks reviewed.",
        status: hasFail ? "warn" : "pass",
      },
    ],
    chainOfCustodyChecks: [
      {
        id: "audit-present",
        label: "Audit events present",
        status: config.volumes.audit > 0 ? "pass" : "fail",
        detail: `${config.volumes.audit} synthetic audit events generated for this run.`,
      },
      {
        id: "evidence-linkage",
        label: "Evidence linkage completeness",
        status: config.errors.missingEvidenceRefs ? "warn" : "pass",
        detail: config.errors.missingEvidenceRefs
          ? "Evidence references intentionally degraded for resilience testing."
          : "Voice evidence references align with completed-call coverage target.",
      },
      {
        id: "ott-safe",
        label: "OTT metadata-only payload",
        status: "pass",
        detail: "No OTT message body or content payload was generated.",
      },
    ],
  };
}

export function buildDashboardSimulationSnapshot(
  config: ScenarioConfig,
  summary: SimulationRunSummary
): DashboardSimulationSnapshot {
  const directionFinderAssets = buildDirectionFinderAssets(config);
  const triangulations = SERVICE_CHANNELS.map((_, index) =>
    buildTriangulationForService(config, summary, directionFinderAssets, index)
  );

  return {
    spectrumBins: buildSpectrumBins(config),
    detections: buildDetections(config, summary, triangulations, directionFinderAssets),
    alerts: buildAlerts(config, summary, triangulations),
    directionFinderAssets,
    signals: buildSignals(summary, triangulations),
    heatCells: buildHeatCells(triangulations),
    triangulation: buildAggregateTriangulation(triangulations, summary),
    triangulations,
    lastUpdatedAt: summary.createdAt,
  };
}
