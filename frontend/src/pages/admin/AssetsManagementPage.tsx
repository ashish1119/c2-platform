import AppLayout from "../../components/layout/AppLayout";
import PageContainer from "../../components/layout/PageContainer";
import AssetsPage from "./AssetsPage";

export default function AssetsManagementPage() {
  return (
    <AppLayout>
      <PageContainer title="Asset Management">
        <AssetsPage />
      </PageContainer>
    </AppLayout>
  );
}
