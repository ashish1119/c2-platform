import AppLayout from "../components/layout/AppLayout";
import PageContainer from "../components/layout/PageContainer";
import TelecomIntelligenceDashboard from "../features/telecom-intelligence/components/TelecomIntelligenceDashboard";

export default function TelecomIntelligencePage() {
  return (
    <AppLayout>
      <PageContainer title="Cellular Interception">
        <TelecomIntelligenceDashboard />
      </PageContainer>
    </AppLayout>
  );
}
