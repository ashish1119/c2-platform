import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import { OperatorMapPage, OperatorAlertsPage, OperatorTcpClientPage } from "./pages/operator";
import ReportsPage from "./pages/ReportsPage";
import PlanningPage from "./pages/PlanningPage";
import CrfsLivePage from "./pages/CrfsLivePage";
import DFLive from "./pages/DFLive";
import JammerControlPage from "./pages/JammerControlPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import UserManagement from "./pages/admin/UserManagement";
import AssetsManagementPage from "./pages/admin/AssetsManagementPage";

function FallbackRedirect() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={user.role === "ADMIN" ? "/admin" : "/operator/map"} replace />;
}

function AppRoutes() {
  const [backendError, setBackendError] = useState<string | null>(null);

  useEffect(() => {
    const checkBackendError = () => {
      const error = sessionStorage.getItem("backendError");
      if (error) {
        setBackendError(error);
      }
    };

    checkBackendError();
    const interval = setInterval(checkBackendError, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {backendError && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            background: "#dc2626",
            color: "white",
            padding: "12px 16px",
            fontSize: "14px",
            zIndex: 9999,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>⚠️ {backendError}</span>
          <button
            type="button"
            onClick={() => {
              setBackendError(null);
              sessionStorage.removeItem("backendError");
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "white",
              cursor: "pointer",
              fontSize: "18px",
              padding: "0 8px",
            }}
          >
            ✕
          </button>
        </div>
      )}
      <div style={{ marginTop: backendError ? "44px" : "0" }}>
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
            path="/operator/df-live"
            element={
              <ProtectedRoute requiredRole="OPERATOR">
                <DFLive />
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
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}