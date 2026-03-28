import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./routes/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
const LoginPage = lazy(() => import("./pages/LoginPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminCommandCenterPage = lazy(() => import("./pages/admin/AdminCommandCenterPage"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const AssetsManagementPage = lazy(() => import("./pages/admin/AssetsManagementPage"));
const OperatorDashboardPage = lazy(() => import("./pages/operator/OperatorDashboardPage"));
const OperatorCommandCenterPage = lazy(() => import("./pages/operator/OperatorCommandCenterPage"));
const OperatorMapPage = lazy(() => import("./pages/operator/OperatorMapPage"));
const OperatorAlertsPage = lazy(() => import("./pages/operator/OperatorAlertsPage"));
const OperatorSMSPage = lazy(() => import("./pages/operator/OperatorSMSPage"));
const OperatorTcpClientPage = lazy(() => import("./pages/operator/OperatorTcpClientPage"));
const OperatorSignalSimulationPage = lazy(
  () => import("./pages/operator/OperatorSignalSimulationPage"),
);
const ReportingCenterPage = lazy(() => import("./pages/ReportingCenterPage"));
const CrfsLivePage = lazy(() => import("./pages/CrfsLivePage"));
const JammerControlPage = lazy(() => import("./pages/JammerControlPage"));
const GeospatialSourcesPage = lazy(() => import("./pages/admin/GeospatialSourcesPage"));
const OperatorDecodioPage = lazy(() => import("./pages/operator/OperatorDecodioPage"));
const DecodioWorkspacePage = lazy(() => import("./pages/operator/DecodioWorkspacePage"));
const TelecomIntelligencePage = lazy(() => import("./pages/TelecomIntelligencePage"));

function RouteFallback() {
  return <div style={{ minHeight: "100vh", background: "#071120" }} />;
}

function FallbackRedirect() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={user.role === "ADMIN" ? "/admin" : "/operator/command-center"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <Navigate to="/admin/command-center" replace />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/command-center"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <AdminCommandCenterPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/overview"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <UserManagement />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/assets"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <AssetsManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/geospatial"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <GeospatialSourcesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator"
              element={
                <ProtectedRoute requiredRole="OPERATOR">
                  <Navigate to="/operator/command-center" replace />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/command-center"
              element={
                <ProtectedRoute requiredRole="OPERATOR">
                  <OperatorCommandCenterPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/dashboard"
              element={
                <ProtectedRoute requiredRole="OPERATOR">
                  <OperatorDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/operator/sms"
              element={
                <ProtectedRoute requiredRole="OPERATOR">
                  <OperatorSMSPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/interception"
              element={
                <ProtectedRoute requiredRole="OPERATOR">
                  <Navigate to="/operator/command-center?section=interception" replace />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/map"
              element={
                <ProtectedRoute requiredRole="OPERATOR">
                  <OperatorMapPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/alerts"
              element={
                <ProtectedRoute requiredRole="OPERATOR">
                  <Navigate to="/operator/command-center?section=alerts" replace />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/tcp-client"
              element={
                <ProtectedRoute requiredRole="OPERATOR">
                  <OperatorTcpClientPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/simulation"
              element={
                <ProtectedRoute requiredRole="OPERATOR">
                  <OperatorSignalSimulationPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/simulation-testing"
              element={
                <ProtectedRoute requiredRole="OPERATOR">
                  <Navigate to="/operator/command-center?section=validation" replace />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/tcpclient"
              element={
                <ProtectedRoute requiredRole="OPERATOR">
                  <Navigate to="/operator/tcp-client" replace />
                </ProtectedRoute>
              }
            />

            <Route
              path="/reports"
              element={
                <ProtectedRoute requiredRole="OPERATOR">
                  <ReportingCenterPage initialSection="reports" allowPlanning={false} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/planning"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <ReportingCenterPage initialSection="planning" allowPlanning={true} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/crfs/live"
              element={
                <ProtectedRoute requiredPermission="crfs:read">
                  <CrfsLivePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/jammer/control"
              element={
                <ProtectedRoute requiredPermission="jammer:write">
                  <JammerControlPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/decodio"
              element={
                <ProtectedRoute requiredRole="OPERATOR">
                  <OperatorDecodioPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator/decodio/workspace"
              element={
                <ProtectedRoute requiredRole="OPERATOR">
                  <DecodioWorkspacePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/telecom/intelligence"
              element={
                <ProtectedRoute requiredPermission="crfs:read">
                  <TelecomIntelligencePage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<FallbackRedirect />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}