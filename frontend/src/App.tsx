import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import OperatorDashboard from "./pages/OperatorDashboard";
import OperatorMapPage from "./pages/operator/OperatorMapPage";
import OperatorAlertsPage from "./pages/operator/OperatorAlertsPage";
import ReportsPage from "./pages/ReportsPage";
import PlanningPage from "./pages/PlanningPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import UserManagement from "./pages/admin/UserManagement";
import AssetsManagementPage from "./pages/admin/AssetsManagementPage";

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
            path="/reports"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/planning"
            element={
              <ProtectedRoute requiredRole="OPERATOR">
                <PlanningPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}