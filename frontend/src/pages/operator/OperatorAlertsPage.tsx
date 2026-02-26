import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import AlertTable from "../../components/AlertTable";

export default function OperatorAlertsPage() {
  return (
    <AppLayout>
      <PageContainer title="Operator Alerts">
        <AlertTable />
      </PageContainer>
    </AppLayout>
  );
}
