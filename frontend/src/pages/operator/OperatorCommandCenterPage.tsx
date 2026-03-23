import { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";
import AlertTable from "../../components/AlertTable";
import InterceptionDashboardView from "../../features/interception-dashboard/components/InterceptionDashboardView";
import { useInterceptionDashboardState } from "../../features/interception-dashboard/state/useInterceptionDashboardState";
import SimulationTestingDashboardView from "../../features/simulation-testing/components/SimulationTestingDashboardView";
import { useSimulationTestingDashboard } from "../../features/simulation-testing/state/useSimulationTestingDashboard";
import { useTheme } from "../../context/ThemeContext";

type CommandSection = "overview" | "interception" | "alerts" | "validation";

const SECTION_LABELS: Record<CommandSection, string> = {
  overview: "Mission Overview",
  interception: "Interception",
  alerts: "Alert Triage",
  validation: "Simulation Validation",
};

function parseSection(value: string | null): CommandSection {
  if (value === "interception" || value === "alerts" || value === "validation") {
    return value;
  }
  return "overview";
}

function SectionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  const { theme } = useTheme();

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${active ? theme.colors.primary : theme.colors.border}`,
        borderRadius: theme.radius.md,
        background: active ? theme.colors.primary : theme.colors.surfaceAlt,
        color: active ? "#ffffff" : theme.colors.textPrimary,
        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}

function MissionOverview() {
  const { theme } = useTheme();

  return (
    <div style={{ display: "grid", gap: theme.spacing.lg }}>
      <Card>
        <div style={{ display: "grid", gap: theme.spacing.sm }}>
          <h2 style={{ margin: 0 }}>Command and Control Workflow</h2>
          <p style={{ margin: 0, color: theme.colors.textSecondary }}>
            This workspace merges interception intelligence, alert triage, and simulation validation into one operator surface.
            Use the linked tool pages for deep tactical controls.
          </p>
        </div>
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: theme.spacing.md,
        }}
      >
        <Card>
          <div style={{ display: "grid", gap: theme.spacing.sm }}>
            <div style={{ fontWeight: 700 }}>Live RF Operations</div>
            <div style={{ color: theme.colors.textSecondary }}>
              Spectrum ingest, detection telemetry, DF triangulation, and stream sessions.
            </div>
            <Link to="/operator/dashboard" style={{ color: theme.colors.primary, fontWeight: 600 }}>
              Open RF Operations Dashboard
            </Link>
          </div>
        </Card>

        <Card>
          <div style={{ display: "grid", gap: theme.spacing.sm }}>
            <div style={{ fontWeight: 700 }}>Map and Field Picture</div>
            <div style={{ color: theme.colors.textSecondary }}>
              Correlate assets, alerts, signals, and heat-map overlays on a common map layer.
            </div>
            <Link to="/operator/map" style={{ color: theme.colors.primary, fontWeight: 600 }}>
              Open Tactical Map
            </Link>
          </div>
        </Card>

        <Card>
          <div style={{ display: "grid", gap: theme.spacing.sm }}>
            <div style={{ fontWeight: 700 }}>RF Scenario Lab</div>
            <div style={{ color: theme.colors.textSecondary }}>
              Generate synthetic RF/DF conditions and publish them into live dashboards.
            </div>
            <Link to="/operator/simulation" style={{ color: theme.colors.primary, fontWeight: 600 }}>
              Open Signal Lab
            </Link>
          </div>
        </Card>

        <Card>
          <div style={{ display: "grid", gap: theme.spacing.sm }}>
            <div style={{ fontWeight: 700 }}>Network Sensor Link</div>
            <div style={{ color: theme.colors.textSecondary }}>
              Validate listener health and TCP upstream connectivity for ingest reliability.
            </div>
            <Link to="/operator/tcp-client" style={{ color: theme.colors.primary, fontWeight: 600 }}>
              Open TCP Control
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function InterceptionSection() {
  const state = useInterceptionDashboardState();

  return (
    <InterceptionDashboardView
      snapshot={state.snapshot}
      filterCounts={state.filterCounts}
      selectedContact={state.selectedContact}
      selectedContactId={state.selectedContactId}
      activeServiceTypes={state.activeServiceTypes}
      availableServiceTypes={state.availableServiceTypes}
      timeWindowPreset={state.timeWindowPreset}
      onToggleServiceType={state.toggleServiceType}
      onSetTimeWindowPreset={state.setTimeWindowPreset}
      onSelectContact={state.setSelectedContactId}
    />
  );
}

function SimulationValidationSection() {
  const state = useSimulationTestingDashboard();

  return (
    <SimulationTestingDashboardView
      templates={state.templates}
      selectedTemplateId={state.selectedTemplateId}
      config={state.config}
      activeRun={state.activeRun}
      runHistory={state.runHistory}
      guardrails={state.guardrails}
      canExecute={state.canExecute}
      publishedRunId={state.publishedRunId}
      onTemplateChange={state.applyTemplate}
      onConfigChange={state.updateConfig}
      onVolumeChange={state.updateVolumes}
      onErrorToggle={state.updateErrors}
      onGenerateRun={state.generateRun}
      onRerunFailedChecks={state.rerunFailedChecks}
      onPublishActiveRun={state.publishActiveRun}
      onOpenHistoricalRun={state.openHistoricalRun}
      onPublishHistoricalRun={state.publishHistoricalRun}
      onClearPublishedRun={state.clearPublishedRun}
    />
  );
}

export default function OperatorCommandCenterPage() {
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const activeSection = useMemo(
    () => parseSection(new URLSearchParams(location.search).get("section")),
    [location.search]
  );

  const setSection = (section: CommandSection) => {
    navigate(`/operator/command-center?section=${section}`, { replace: true });
  };

  return (
    <AppLayout>
      <PageContainer title="Operator Command Center">
        <div style={{ display: "grid", gap: theme.spacing.lg }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.md, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Operator Command Center</h2>
              <div style={{ color: theme.colors.textSecondary }}>
                Unified operations surface for mission context, intelligence, alert triage, and simulation assurance.
              </div>
            </div>
            <div style={{ display: "flex", gap: theme.spacing.sm, flexWrap: "wrap" }}>
              {(Object.keys(SECTION_LABELS) as CommandSection[]).map((section) => (
                <SectionButton
                  key={section}
                  active={activeSection === section}
                  label={SECTION_LABELS[section]}
                  onClick={() => setSection(section)}
                />
              ))}
            </div>
          </div>

          {activeSection === "overview" && <MissionOverview />}
          {activeSection === "interception" && <InterceptionSection />}
          {activeSection === "alerts" && (
            <Card>
              <AlertTable />
            </Card>
          )}
          {activeSection === "validation" && <SimulationValidationSection />}
        </div>
      </PageContainer>
    </AppLayout>
  );
}