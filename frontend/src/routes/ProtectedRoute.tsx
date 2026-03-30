import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "ADMIN" | "OPERATOR";
  requiredPermission?: string;
}

function RouteAccessLoading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #071120 0%, #0d1f3a 50%, #122b4d 100%)",
        color: "#d7e7ff",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div style={{ display: "grid", gap: "0.5rem", justifyItems: "center" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "999px",
            border: "3px solid rgba(159, 198, 255, 0.3)",
            borderTopColor: "#78b4ff",
            animation: "route-guard-spin 0.85s linear infinite",
          }}
        />
        <p style={{ margin: 0, fontWeight: 600, letterSpacing: "0.03em" }}>Validating session...</p>
      </div>
      <style>{"@keyframes route-guard-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }"}</style>
    </div>
  );
}

export default function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <RouteAccessLoading />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/forbidden" replace />;
  }

  if (requiredPermission) {
    const permissions = user.permissions ?? [];
    const [requiredResource, requiredAction] = requiredPermission.split(":");
    const hasPermission =
      permissions.includes(requiredPermission) ||
      permissions.includes(`${requiredResource}:*`) ||
      permissions.includes(`*:${requiredAction}`) ||
      permissions.includes("*:*");

    if (!hasPermission) {
      return <Navigate to="/forbidden" replace />;
    }
  }

  return children;
}
