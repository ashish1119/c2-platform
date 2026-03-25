import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import SimulationTestingDashboardView from "../../features/simulation-testing/components/SimulationTestingDashboardView";
import { useSimulationTestingDashboard } from "../../features/simulation-testing/state/useSimulationTestingDashboard";

export default function OperatorSimulationTestingPage() {
  const {
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
  } = useSimulationTestingDashboard();

  return (
    <AppLayout>
      <PageContainer title="Simulation Testing Dashboard">
        <SimulationTestingDashboardView
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          config={config}
          activeRun={activeRun}
          runHistory={runHistory}
          guardrails={guardrails}
          canExecute={canExecute}
          publishedRunId={publishedRunId}
          onTemplateChange={applyTemplate}
          onConfigChange={updateConfig}
          onVolumeChange={updateVolumes}
          onErrorToggle={updateErrors}
          onGenerateRun={generateRun}
          onRerunFailedChecks={rerunFailedChecks}
          onPublishActiveRun={publishActiveRun}
          onOpenHistoricalRun={openHistoricalRun}
          onPublishHistoricalRun={publishHistoricalRun}
          onClearPublishedRun={clearPublishedRun}
        />
      </PageContainer>
    </AppLayout>
  );
}
