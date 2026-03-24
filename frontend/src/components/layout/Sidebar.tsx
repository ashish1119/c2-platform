import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { branding } from "../../theme/branding";

type SidebarProps = {
  onNavigate?: () => void;
};

export default function Sidebar({ onNavigate }: SidebarProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const location = useLocation();

  const hasPermission = (requiredPermission: string) => {
    const permissions = user?.permissions ?? [];
    const [requiredResource, requiredAction] = requiredPermission.split(":");

    return (
      permissions.includes(requiredPermission) ||
      permissions.includes(`${requiredResource}:*`) ||
      permissions.includes(`*:${requiredAction}`) ||
      permissions.includes("*:*")
    );
  };

  const navItem = (to: string, label: string) => {
    const active = location.pathname === to;

    return (
      <Link
        key={to}
        to={to}
        onClick={onNavigate}
        style={{
          display: "block",
          padding: theme.spacing.md,
          borderRadius: theme.radius.md,
          marginBottom: theme.spacing.sm,
          background: active ? theme.colors.primary : "transparent",
          color: active
            ? "#ffffff"
            : theme.colors.textPrimary,
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        {label}
      </Link>
    );
  };

  return (
    <div
      style={{
        width: "240px",
        background: theme.colors.surface,
        padding: theme.spacing.xl,
        borderRight: `1px solid ${theme.colors.border}`,
      }}
    >
      <div style={{ marginBottom: theme.spacing.xl, display: "flex", justifyContent: "center" }}>
        <img
          src={branding.sidebarLogoSrc}
          alt={branding.logoAlt}
          style={{ height: 42, width: "auto", display: "block" }}
        />
      </div>

      {user?.role === "ADMIN" && navItem("/admin", "Dashboard")}
      {user?.role === "ADMIN" && navItem("/admin/users", "User Management")}
      {user?.role === "ADMIN" && navItem("/admin/assets", "Assets")}
      {user?.role === "OPERATOR" && navItem("/operator/map", "Map")}
      {user?.role === "OPERATOR" && navItem("/operator/alerts", "Alert List")}
      {user?.role === "OPERATOR" && navItem("/operator/tcp-client", "TCP Client")}
      {user?.role === "OPERATOR" && navItem("/reports", "Reports")}
      {user?.role === "OPERATOR" && navItem("/operator/sms", "SMS")}
      {hasPermission("crfs:read") && navItem("/crfs/live", "CRFS Live")}
      {hasPermission("jammer:write") && navItem("/jammer/control", "Jammer Control")}
    </div>
  );
}