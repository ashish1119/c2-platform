import Card from "../../../components/ui/Card";
import { useTheme } from "../../../context/ThemeContext";
import type { ScenarioConfig, ScenarioTemplate, SimulationGuardrail, SimulationRunSummary, ValidationStatus } from "../model";

type SimulationTestingDashboardViewProps = {
  templates: ScenarioTemplate[];
  selectedTemplateId: string;
  config: ScenarioConfig;
  activeRun: SimulationRunSummary | null;
  runHistory: SimulationRunSummary[];
  guardrails: SimulationGuardrail[];
  canExecute: boolean;
  publishedRunId: string | null;
  onTemplateChange: (templateId: ScenarioTemplate["id"]) => void;
  onConfigChange: (patch: Partial<ScenarioConfig>) => void;
  onVolumeChange: (patch: Partial<ScenarioConfig["volumes"]>) => void;
  onErrorToggle: (patch: Partial<ScenarioConfig["errors"]>) => void;
  onGenerateRun: () => void;
  onRerunFailedChecks: () => void;
  onPublishActiveRun: () => void;
  onOpenHistoricalRun: (runId: string) => void;
  onPublishHistoricalRun: (runId: string) => void;
  onClearPublishedRun: () => void;
};

function statusColor(status: ValidationStatus, colors: ReturnType<typeof useTheme>["theme"]["colors"]) {
  if (status === "fail") return colors.danger;
  if (status === "warn") return colors.warning;
  return colors.success;
}

function pillStyle(color: string) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 600,
    color,
    border: `1px solid ${color}`,
  } as const;
}

function sectionTitle(label: string, subtitle: string, theme: ReturnType<typeof useTheme>["theme"]) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.colors.textMuted }}>
        {label}
      </div>
      <div style={{ color: theme.colors.textSecondary }}>{subtitle}</div>
    </div>
  );
}

export default function SimulationTestingDashboardView({
  templates,
  selectedTemplateId,
  config,
  activeRun,
  runHistory,
  guardrails,
  canExecute,
  publishedRunId,
  onTemplateChange,
  onConfigChange,
  onVolumeChange,
  onErrorToggle,
  onGenerateRun,
  onRerunFailedChecks,
  onPublishActiveRun,
  onOpenHistoricalRun,
  onPublishHistoricalRun,
  onClearPublishedRun,
}: SimulationTestingDashboardViewProps) {
  const { theme } = useTheme();
  const isActiveRunPublished = activeRun ? publishedRunId === activeRun.runId : false;

  return (
    <div style={{ display: "grid", gap: theme.spacing.lg }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: theme.spacing.lg, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: theme.typography.h2.fontSize, fontWeight: theme.typography.h2.fontWeight }}>
              Simulation / Validation Dashboard
            </div>
            <div style={{ color: theme.colors.textSecondary, maxWidth: 760 }}>
              Sandbox for synthetic telecom scenario generation, KPI validation, compliance review, and performance testing.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={pillStyle(theme.colors.info)}>Simulation Sandbox</span>
            <span style={pillStyle(canExecute ? theme.colors.success : theme.colors.danger)}>
              {canExecute ? "Guardrails enforced" : "Execution blocked"}
            </span>
            <span style={pillStyle(publishedRunId ? theme.colors.warning : theme.colors.textMuted)}>
              {publishedRunId ? `Shared feed: ${publishedRunId}` : "Shared feed inactive"}
            </span>
            {activeRun ? <span style={pillStyle(statusColor(activeRun.overallStatus, theme.colors))}>{activeRun.runId}</span> : null}
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gap: theme.spacing.lg, gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.9fr)" }}>
        <Card>
          <div style={{ display: "grid", gap: theme.spacing.lg }}>
            {sectionTitle("Scenario Setup", "Select a template and adjust synthetic generation volumes and constraints.", theme)}

            <div style={{ display: "grid", gap: theme.spacing.md, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Scenario template</span>
                <select
                  value={selectedTemplateId}
                  onChange={(event) => onTemplateChange(event.target.value as ScenarioTemplate["id"])}
                  style={{ padding: 10, borderRadius: theme.radius.md, border: `1px solid ${theme.colors.border}`, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Case ID</span>
                <input
                  value={config.caseId}
                  onChange={(event) => onConfigChange({ caseId: event.target.value })}
                  style={{ padding: 10, borderRadius: theme.radius.md, border: `1px solid ${theme.colors.border}`, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Window start (UTC)</span>
                <input
                  value={config.startUtc}
                  onChange={(event) => onConfigChange({ startUtc: event.target.value })}
                  style={{ padding: 10, borderRadius: theme.radius.md, border: `1px solid ${theme.colors.border}`, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>Window end (UTC)</span>
                <input
                  value={config.endUtc}
                  onChange={(event) => onConfigChange({ endUtc: event.target.value })}
                  style={{ padding: 10, borderRadius: theme.radius.md, border: `1px solid ${theme.colors.border}`, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gap: theme.spacing.md, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              {Object.entries(config.volumes).map(([key, value]) => (
                <label key={key} style={{ display: "grid", gap: 6 }}>
                  <span style={{ textTransform: "capitalize" }}>{key}</span>
                  <input
                    type="number"
                    min={0}
                    value={value}
                    onChange={(event) => onVolumeChange({ [key]: Number(event.target.value) } as Partial<ScenarioConfig["volumes"]>)}
                    style={{ padding: 10, borderRadius: theme.radius.md, border: `1px solid ${theme.colors.border}`, background: theme.colors.surfaceAlt, color: theme.colors.textPrimary }}
                  />
                </label>
              ))}
            </div>

            <div style={{ display: "grid", gap: theme.spacing.sm }}>
              <div style={{ fontWeight: 600 }}>Error injection</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {Object.entries(config.errors).map(([key, value]) => (
                  <label key={key} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: theme.radius.md, border: `1px solid ${theme.colors.border}`, background: theme.colors.surfaceAlt }}>
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(event) => onErrorToggle({ [key]: event.target.checked } as Partial<ScenarioConfig["errors"]>)}
                    />
                    <span>{key}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={!canExecute}
                onClick={onGenerateRun}
                style={{
                  border: "none",
                  borderRadius: theme.radius.md,
                  background: canExecute ? theme.colors.primary : theme.colors.border,
                  color: "#ffffff",
                  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                  cursor: canExecute ? "pointer" : "not-allowed",
                }}
              >
                Generate Synthetic Batch
              </button>
              <button
                type="button"
                disabled={!activeRun}
                onClick={onRerunFailedChecks}
                style={{
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.md,
                  background: theme.colors.surfaceAlt,
                  color: theme.colors.textPrimary,
                  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                  cursor: activeRun ? "pointer" : "not-allowed",
                }}
              >
                Re-run Failed Checks
              </button>
              <button
                type="button"
                disabled={!activeRun}
                onClick={onPublishActiveRun}
                style={{
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.md,
                  background: activeRun ? theme.colors.surfaceAlt : theme.colors.border,
                  color: theme.colors.textPrimary,
                  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                  cursor: activeRun ? "pointer" : "not-allowed",
                }}
              >
                Publish to Operator Views
              </button>
              <button
                type="button"
                disabled={!publishedRunId}
                onClick={onClearPublishedRun}
                style={{
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.md,
                  background: theme.colors.surfaceAlt,
                  color: theme.colors.textPrimary,
                  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                  cursor: publishedRunId ? "pointer" : "not-allowed",
                }}
              >
                Clear Shared Feed
              </button>
            </div>

            {activeRun ? (
              <div
                style={{
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.md,
                  background: theme.colors.surfaceAlt,
                  color: theme.colors.textSecondary,
                }}
              >
                {isActiveRunPublished
                  ? "This run is currently published to the shared operator simulation feed used by the Operator Dashboard and Operator Map."
                  : "Publish the active run to send synthetic detections, alerts, RF signals, DF assets, heat cells, and triangulation overlays into other operator views."}
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <div style={{ display: "grid", gap: theme.spacing.lg }}>
            {sectionTitle("Compliance Guardrails", "Mandatory safety constraints for synthetic-only execution.", theme)}
            <div style={{ display: "grid", gap: theme.spacing.sm }}>
              {guardrails.map((guardrail) => {
                const color = statusColor(guardrail.status, theme.colors);
                return (
                  <div key={guardrail.id} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.md, background: theme.colors.surfaceAlt }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <strong>{guardrail.label}</strong>
                      <span style={pillStyle(color)}>{guardrail.status.toUpperCase()}</span>
                    </div>
                    <div style={{ color: theme.colors.textSecondary, marginTop: 8 }}>{guardrail.detail}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {activeRun ? (
        <>
          <div style={{ display: "grid", gap: theme.spacing.md, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {activeRun.summaryCards.map((card) => (
              <Card key={card.id}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.colors.textMuted }}>{card.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{card.value}</div>
                  <span style={pillStyle(statusColor(card.tone, theme.colors))}>{card.tone.toUpperCase()}</span>
                </div>
              </Card>
            ))}
          </div>

          <div style={{ display: "grid", gap: theme.spacing.lg, gridTemplateColumns: "minmax(0, 1.25fr) minmax(320px, 0.85fr)" }}>
            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                {sectionTitle("Expected vs Actual KPIs", "Comparison grid for baseline formulas and tolerance-driven validation.", theme)}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {[
                          "Metric",
                          "Expected",
                          "Actual",
                          "Tolerance",
                          "Status",
                        ].map((label) => (
                          <th key={label} style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}`, color: theme.colors.textMuted }}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeRun.kpiRows.map((row) => (
                        <tr key={row.id}>
                          <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{row.label}</td>
                          <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{row.expected}</td>
                          <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{row.actual}</td>
                          <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{row.tolerance}</td>
                          <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                            <span style={pillStyle(statusColor(row.status, theme.colors))}>{row.status.toUpperCase()}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                {sectionTitle("Failed Assertions", "Check failures and warnings requiring QA or compliance review.", theme)}
                <div style={{ display: "grid", gap: theme.spacing.sm }}>
                  {activeRun.assertions.map((assertion) => (
                    <div key={assertion.id} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.md, background: theme.colors.surfaceAlt }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <strong>{assertion.category.toUpperCase()}</strong>
                        <span style={pillStyle(statusColor(assertion.status, theme.colors))}>{assertion.status.toUpperCase()}</span>
                      </div>
                      <div style={{ marginTop: 8, color: theme.colors.textSecondary }}>{assertion.message}</div>
                      <div style={{ marginTop: 8, color: theme.colors.textMuted, fontSize: 12 }}>{assertion.suggestedFix}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <div style={{ display: "grid", gap: theme.spacing.lg, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                {sectionTitle("Performance Metrics", "Latency and throughput telemetry for scenario execution and dashboard interaction.", theme)}
                <div style={{ display: "grid", gap: theme.spacing.sm }}>
                  {activeRun.performance.map((metric) => (
                    <div key={metric.id} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.md, background: theme.colors.surfaceAlt }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <strong>{metric.label}</strong>
                        <span style={pillStyle(statusColor(metric.status, theme.colors))}>{metric.status.toUpperCase()}</span>
                      </div>
                      <div style={{ marginTop: 8, color: theme.colors.textSecondary }}>p50 {metric.p50Ms} ms | p95 {metric.p95Ms} ms</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ display: "grid", gap: theme.spacing.md }}>
                {sectionTitle("Chain of Custody", "Evidence and audit integrity checks for simulation traceability.", theme)}
                <div style={{ display: "grid", gap: theme.spacing.sm }}>
                  {activeRun.chainOfCustodyChecks.map((check) => (
                    <div key={check.id} style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.md, background: theme.colors.surfaceAlt }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <strong>{check.label}</strong>
                        <span style={pillStyle(statusColor(check.status, theme.colors))}>{check.status.toUpperCase()}</span>
                      </div>
                      <div style={{ marginTop: 8, color: theme.colors.textSecondary }}>{check.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <div style={{ display: "grid", gap: theme.spacing.md }}>
              {sectionTitle("Run Timeline", "Execution trace for generation, validation, and review actions.", theme)}
              <div style={{ display: "grid", gap: theme.spacing.sm }}>
                {activeRun.timeline.map((event) => (
                  <div key={event.id} style={{ display: "grid", gridTemplateColumns: "180px 140px minmax(0, 1fr)", gap: theme.spacing.md, paddingTop: theme.spacing.md, borderTop: `1px solid ${theme.colors.border}` }}>
                    <div style={{ color: theme.colors.textSecondary }}>{new Date(event.at).toLocaleString()}</div>
                    <div>{event.actor}</div>
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong>{event.action}</strong>
                      <div style={{ color: theme.colors.textSecondary }}>{event.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
            <div style={{ fontSize: theme.typography.h3.fontSize, fontWeight: theme.typography.h3.fontWeight }}>No simulation run yet</div>
            <div style={{ color: theme.colors.textSecondary }}>Select a template, adjust scenario parameters, and generate a synthetic batch to populate validation results.</div>
          </div>
        </Card>
      )}

      <Card>
        <div style={{ display: "grid", gap: theme.spacing.md }}>
          {sectionTitle("Recent Runs", "Session-level registry for reopening and comparing recent simulation outputs.", theme)}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[
                    "Run ID",
                    "Scenario",
                    "Created",
                    "Status",
                    "Actions",
                  ].map((label) => (
                    <th key={label} style={{ textAlign: "left", padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}`, color: theme.colors.textMuted }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runHistory.map((run) => (
                  <tr key={run.runId}>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{run.runId}</td>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{run.scenarioLabel}</td>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>{new Date(run.createdAt).toLocaleString()}</td>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                      <span style={pillStyle(statusColor(run.overallStatus, theme.colors))}>{run.overallStatus.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.border}` }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => onOpenHistoricalRun(run.runId)}
                          style={{
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: theme.radius.md,
                            background: theme.colors.surfaceAlt,
                            color: theme.colors.textPrimary,
                            padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                            cursor: "pointer",
                          }}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => onPublishHistoricalRun(run.runId)}
                          style={{
                            border: `1px solid ${theme.colors.border}`,
                            borderRadius: theme.radius.md,
                            background: theme.colors.surfaceAlt,
                            color: theme.colors.textPrimary,
                            padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                            cursor: "pointer",
                          }}
                        >
                          Publish
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
