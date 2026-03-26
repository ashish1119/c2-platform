import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import AlertTable from "../../components/AlertTable";

export default function OperatorDashboard() {
  return (
    <AppLayout>
      <PageContainer title="Operator Dashboard">
        <AlertTable />
      </PageContainer>
    </AppLayout>
  );
}
