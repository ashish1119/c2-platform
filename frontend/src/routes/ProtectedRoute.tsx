import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "ADMIN" | "OPERATOR";
  requiredPermission?: string;
}

export default function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
}: ProtectedRouteProps) {
  const { user } = useAuth();

  // Not logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Role mismatch
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/login" replace />;
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
      return <Navigate to="/login" replace />;
    }
  }

  return children;
}