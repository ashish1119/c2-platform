import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
<<<<<<< HEAD
=======
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import { OperatorMapPage, OperatorAlertsPage, OperatorTcpClientPage, OperatorSMSPage } from "./pages/operator";
import ReportsPage from "./pages/ReportsPage";
import PlanningPage from "./pages/PlanningPage";
import CrfsLivePage from "./pages/CrfsLivePage";
import JammerControlPage from "./pages/JammerControlPage";
>>>>>>> origin/Akash
import ProtectedRoute from "./routes/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
<<<<<<< HEAD
const LoginPage = lazy(() => import("./pages/LoginPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminCommandCenterPage = lazy(() => import("./pages/admin/AdminCommandCenterPage"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const AssetsManagementPage = lazy(() => import("./pages/admin/AssetsManagementPage"));
const OperatorDashboardPage = lazy(() => import("./pages/operator/OperatorDashboardPage"));
const OperatorCommandCenterPage = lazy(() => import("./pages/operator/OperatorCommandCenterPage"));
const OperatorMapPage = lazy(() => import("./pages/operator/OperatorMapPage"));
const OperatorTcpClientPage = lazy(() => import("./pages/operator/OperatorTcpClientPage"));
const OperatorSignalSimulationPage = lazy(
  () => import("./pages/operator/OperatorSignalSimulationPage"),
);
const ReportingCenterPage = lazy(() => import("./pages/ReportingCenterPage"));
const CrfsLivePage = lazy(() => import("./pages/CrfsLivePage"));
const JammerControlPage = lazy(() => import("./pages/JammerControlPage"));
const GeospatialSourcesPage = lazy(() => import("./pages/admin/GeospatialSourcesPage"));

function RouteFallback() {
  return <div style={{ minHeight: "100vh", background: "#071120" }} />;
}
=======
import UserManagement from "./pages/admin/UserManagement";
import AssetsManagementPage from "./pages/admin/AssetsManagementPage";
import OperatorDashboard from "./pages/OperatorDashboard";
>>>>>>> origin/aditya-new-branch

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

<<<<<<< HEAD
            <Route
              path="/operator/dashboard"
              element={
                <ProtectedRoute requiredRole="OPERATOR">
                  <OperatorDashboardPage />
                </ProtectedRoute>
              }
            />
=======
          <Route
            path="/operator/sms"
            element={
              <ProtectedRoute requiredRole="OPERATOR">
<<<<<<< HEAD
                <OperatorSMSPage />
=======
                <Navigate to="/operator/map" replace />
              </ProtectedRoute>
            }
          />

          <Route
            path="/operator/dashboard"
            element={
              <ProtectedRoute requiredRole="OPERATOR">
                <OperatorDashboard />
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
                <OperatorAlertsPage />
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
            path="/operator/tcpclient"
            element={
              <ProtectedRoute requiredRole="OPERATOR">
                <Navigate to="/operator/tcp-client" replace />
>>>>>>> origin/aditya-new-branch
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute requiredRole="OPERATOR">
                <ReportsPage />
              </ProtectedRoute>
            }
          />
>>>>>>> origin/Akash

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

            <Route path="*" element={<FallbackRedirect />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}