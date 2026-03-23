import { useMemo, useState } from "react";
import { publishDashboardSimulationSnapshot, stopDashboardSimulation } from "../../signal-simulation/state/dashboardSimulationBridge";
import {
  buildDashboardSimulationSnapshot,
  buildGuardrails,
  buildSimulationRunSummary,
  getTemplateConfig,
  SCENARIO_TEMPLATES,
} from "../mockData";
import type { ScenarioConfig, ScenarioTemplateId, SimulationRunSummary } from "../model";

export function useSimulationTestingDashboard() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<ScenarioTemplateId>("baseline");
  const [config, setConfig] = useState<ScenarioConfig>(() => getTemplateConfig("baseline"));
  const [activeRun, setActiveRun] = useState<SimulationRunSummary | null>(null);
  const [runHistory, setRunHistory] = useState<SimulationRunSummary[]>([]);
  const [publishedRunId, setPublishedRunId] = useState<string | null>(null);

  const templates = SCENARIO_TEMPLATES;
  const guardrails = useMemo(() => buildGuardrails(), []);
  const canExecute = guardrails.every((item) => item.status === "pass");

  function activateRun(summary: SimulationRunSummary) {
    const restoredConfig = structuredClone(summary.sourceConfig);
    setSelectedTemplateId(restoredConfig.templateId);
    setConfig(restoredConfig);
    setActiveRun(summary);
  }

  function applyTemplate(templateId: ScenarioTemplateId) {
    setSelectedTemplateId(templateId);
    setConfig(getTemplateConfig(templateId));
  }

  function updateConfig(patch: Partial<ScenarioConfig>) {
    setConfig((current) => ({ ...current, ...patch }));
  }

  function updateVolumes(patch: Partial<ScenarioConfig["volumes"]>) {
    setConfig((current) => ({
      ...current,
      volumes: { ...current.volumes, ...patch },
    }));
  }

  function updateErrors(patch: Partial<ScenarioConfig["errors"]>) {
    setConfig((current) => ({
      ...current,
      errors: { ...current.errors, ...patch },
    }));
  }

  function publishRun(summary: SimulationRunSummary, scenarioConfig: ScenarioConfig) {
    publishDashboardSimulationSnapshot(buildDashboardSimulationSnapshot(scenarioConfig, summary));
    setPublishedRunId(summary.runId);
  }

  function generateRun() {
    const summary = buildSimulationRunSummary({ ...config, templateId: selectedTemplateId });
    activateRun(summary);
    setRunHistory((current) => [summary, ...current].slice(0, 8));
  }

  function rerunFailedChecks() {
    if (!activeRun) {
      return;
    }

    const rerun = buildSimulationRunSummary({ ...config, templateId: selectedTemplateId });
    rerun.timeline = [
      {
        id: "rerun-failed",
        at: new Date().toISOString(),
        actor: "qa.analyst",
        action: "rerun_failed_checks",
        detail: "Failed and warning checks re-evaluated after parameter review.",
        status: rerun.overallStatus,
      },
      ...rerun.timeline,
    ];
    activateRun(rerun);
    setRunHistory((current) => [rerun, ...current].slice(0, 8));
  }

  function publishActiveRun() {
    if (!activeRun) {
      return;
    }

    publishRun(activeRun, activeRun.sourceConfig);
  }

  function openHistoricalRun(runId: string) {
    const historicalRun = runHistory.find((run) => run.runId === runId);
    if (!historicalRun) {
      return;
    }

    activateRun(historicalRun);
  }

  function publishHistoricalRun(runId: string) {
    const historicalRun = runHistory.find((run) => run.runId === runId);
    if (!historicalRun) {
      return;
    }

    activateRun(historicalRun);
    publishRun(historicalRun, historicalRun.sourceConfig);
  }

  function clearPublishedRun() {
    stopDashboardSimulation();
    setPublishedRunId(null);
  }

  return {
    templates,
    selectedTemplateId,
    config,
    activeRun,
    runHistory,
    guardrails,
    canExecute,
    publishedRunId,
    applyTemplate,
    updateConfig,
    updateVolumes,
    updateErrors,
    generateRun,
    rerunFailedChecks,
    publishActiveRun,
    openHistoricalRun,
    publishHistoricalRun,
    clearPublishedRun,
  };
}
