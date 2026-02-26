import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";

export default function Sidebar() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const location = useLocation();

  const navItem = (to: string, label: string) => {
    const active = location.pathname === to;

    return (
      <Link
        key={to}
        to={to}
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
      <h2 style={{ marginBottom: theme.spacing.xl }}>
        C2 Platform
      </h2>

      {user?.role === "ADMIN" && navItem("/admin", "Dashboard")}
      {user?.role === "ADMIN" && navItem("/admin/users", "User Management")}
      {user?.role === "ADMIN" && navItem("/admin/assets", "Assets")}
      {user?.role === "OPERATOR" && navItem("/operator", "Operations")}
      {user?.role === "OPERATOR" && navItem("/operator/map", "Map")}
      {user?.role === "OPERATOR" && navItem("/operator/alerts", "Alert List")}
      {user?.role === "OPERATOR" && navItem("/planning", "Planning")}
      {navItem("/reports", "Reports")}
    </div>
  );
}