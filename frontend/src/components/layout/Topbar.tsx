import { useTheme } from "../../context/ThemeContext";
import { useLocation } from "react-router-dom";

type TopbarProps = {
  isSidebarVisible: boolean;
  onToggleSidebar: () => void;
};

export default function Topbar({ isSidebarVisible, onToggleSidebar }: TopbarProps) {
  const { theme, mode, toggleTheme } = useTheme();
  const location = useLocation();

  const pageTitle = (() => {
    const pathname = location.pathname;
    if (pathname === "/admin") return "Admin Dashboard";
    if (pathname === "/admin/users") return "User Management";
    if (pathname === "/admin/assets") return "Asset Management";
    if (pathname === "/admin/decodio") return "Decodio Control";
    if (pathname === "/admin/audit-logs") return "Audit Logs";
    if (pathname === "/operator") return "Operations Center";
    if (pathname === "/operator/map") return "Operator Map";
    if (pathname === "/operator/alerts") return "Operator Alerts";
    if (pathname === "/planning") return "Planning Tool";
    if (pathname === "/reports") return "Reports";
    return "";
  })();

  return (
    <div
      style={{
        height: "64px",
        background: theme.colors.surface,
        borderBottom: `1px solid ${theme.colors.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `0 ${theme.spacing.xl}`,
      }}
    >
      <div style={{ fontWeight: 600, minWidth: "240px" }}>
        Enterprise Command Platform
      </div>

      <div
        style={{
          flex: 1,
          textAlign: "center",
          fontSize: theme.typography.h3.fontSize,
          fontWeight: theme.typography.h3.fontWeight,
          color: theme.colors.textPrimary,
          padding: `0 ${theme.spacing.lg}`,
        }}
      >
        {pageTitle}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm }}>
        <button
          onClick={onToggleSidebar}
          style={{
            background: theme.colors.surfaceAlt,
            color: theme.colors.textPrimary,
            border: `1px solid ${theme.colors.border}`,
            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            borderRadius: theme.radius.md,
            cursor: "pointer",
          }}
        >
          {isSidebarVisible ? "Hide Menu" : "Show Menu"}
        </button>

        <button
          onClick={toggleTheme}
          style={{
            background: theme.colors.primary,
            color: "#fff",
            border: "none",
            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            borderRadius: theme.radius.md,
            cursor: "pointer",
          }}
        >
          {mode === "light" ? "Switch to Dark Theme" : "Switch to Light Theme"}
        </button>
      </div>
    </div>
  );
}