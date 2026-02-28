import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import { OperatorMapPage, OperatorAlertsPage } from "./pages/operator";
import ReportsPage from "./pages/ReportsPage";
import PlanningPage from "./pages/PlanningPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import UserManagement from "./pages/admin/UserManagement";
import AssetsManagementPage from "./pages/admin/AssetsManagementPage";
import DecodioManagementPage from "./pages/admin/DecodioManagementPage";
import AuditLogsPage from "./pages/admin/AuditLogsPage";
import SmsManagementPage from "./pages/admin/SmsManagementPage";

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
            path="/admin/decodio"
            element={
              <ProtectedRoute requiredRole="ADMIN" requiredPermission="decodio:read">
                <DecodioManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit-logs"
            element={
              <ProtectedRoute requiredRole="ADMIN" requiredPermission="audit:read">
                <AuditLogsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/sms"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <SmsManagementPage />
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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}