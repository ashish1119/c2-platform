import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import InterceptionDashboardView from "../../features/interception-dashboard/components/InterceptionDashboardView";
import { useInterceptionDashboardState } from "../../features/interception-dashboard/state/useInterceptionDashboardState";

export default function OperatorInterceptionDashboardPage() {
  const {
    snapshot,
    filterCounts,
    selectedContact,
    selectedContactId,
    activeServiceTypes,
    availableServiceTypes,
    timeWindowPreset,
    setTimeWindowPreset,
    toggleServiceType,
    setSelectedContactId,
  } = useInterceptionDashboardState();

  return (
    <AppLayout>
      <PageContainer title="Interception Dashboard">
        <InterceptionDashboardView
          snapshot={snapshot}
          filterCounts={filterCounts}
          selectedContact={selectedContact}
          selectedContactId={selectedContactId}
          activeServiceTypes={activeServiceTypes}
          availableServiceTypes={availableServiceTypes}
          timeWindowPreset={timeWindowPreset}
          onToggleServiceType={toggleServiceType}
          onSetTimeWindowPreset={setTimeWindowPreset}
          onSelectContact={setSelectedContactId}
        />
      </PageContainer>
    </AppLayout>
  );
}