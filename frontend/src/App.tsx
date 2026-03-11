import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import { OperatorMapPage, OperatorAlertsPage, OperatorTcpClientPage } from "./pages/operator";
import ReportsPage from "./pages/ReportsPage";
import PlanningPage from "./pages/PlanningPage";
import CrfsLivePage from "./pages/CrfsLivePage";
import JammerControlPage from "./pages/JammerControlPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import UserManagement from "./pages/admin/UserManagement";
import AssetsManagementPage from "./pages/admin/AssetsManagementPage";
import OperatorDashboard from "./pages/OperatorDashboard";

function FallbackRedirect() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={user.role === "ADMIN" ? "/admin" : "/operator/map"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/admin"
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
            path="/operator"
            element={
              <ProtectedRoute requiredRole="OPERATOR">
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

          <Route
            path="/planning"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <PlanningPage />
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
      </BrowserRouter>
    </AuthProvider>
  );
}