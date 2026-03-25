// import { Link, useLocation } from "react-router-dom";
// import { useTheme } from "../../context/ThemeContext";
// import { useAuth } from "../../context/AuthContext";
// import { branding } from "../../theme/branding";

// type SidebarProps = {
//   onNavigate?: () => void;
// };

// export default function Sidebar({ onNavigate }: SidebarProps) {
//   const { theme } = useTheme();
//   const { user } = useAuth();
//   const location = useLocation();

//   const hasPermission = (requiredPermission: string) => {
//     const permissions = user?.permissions ?? [];
//     const [requiredResource, requiredAction] = requiredPermission.split(":");

//     return (
//       permissions.includes(requiredPermission) ||
//       permissions.includes(`${requiredResource}:*`) ||
//       permissions.includes(`*:${requiredAction}`) ||
//       permissions.includes("*:*")
//     );
//   };

//   const navItem = (to: string, label: string) => {
//     const active = location.pathname === to;

//     return (
//       <Link
//         key={to}
//         to={to}
//         onClick={onNavigate}
//         style={{
//           display: "block",
//           padding: theme.spacing.md,
//           borderRadius: theme.radius.md,
//           marginBottom: theme.spacing.sm,
//           background: active ? theme.colors.primary : "transparent",
//           color: active
//             ? "#ffffff"
//             : theme.colors.textPrimary,
//           textDecoration: "none",
//           fontWeight: 500,
//         }}
//       >
//         {label}
//       </Link>
//     );
//   };

//   return (
//     <div
//       style={{
//         width: "240px",
//         background: theme.colors.surface,
//         padding: theme.spacing.xl,
//         borderRight: `1px solid ${theme.colors.border}`,
//       }}
//     >
//       <div style={{ marginBottom: theme.spacing.xl, display: "flex", justifyContent: "center" }}>
//         <img
//           src={branding.sidebarLogoSrc}
//           alt={branding.logoAlt}
//           style={{ height: 42, width: "auto", display: "block" }}
//         />
//       </div>

//       {user?.role === "ADMIN" && navItem("/admin", "Dashboard")}
//       {user?.role === "ADMIN" && navItem("/admin/users", "User Management")}
//       {user?.role === "ADMIN" && navItem("/admin/assets", "Assets")}
//       {user?.role === "OPERATOR" && navItem("/operator/map", "Map")}
//       {user?.role === "OPERATOR" && navItem("/operator/alerts", "Alert List")}
//       {user?.role === "OPERATOR" && navItem("/operator/tcp-client", "TCP Client")}
//       {user?.role === "OPERATOR" && navItem("/reports", "Reports")}
//       {hasPermission("crfs:read") && navItem("/crfs/live", "CRFS Live")}
//       {hasPermission("jammer:write") && navItem("/jammer/control", "Jammer Control")}
//     </div>
//   );
// }


import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { branding } from "../../theme/branding";
import {
  LayoutDashboard,
  Users,
  Database,
  Map,
  AlertTriangle,
  Terminal,
  FileText,
  Radio,
  Zap,
} from "lucide-react";

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

  const navItem = (to: string, label: string, Icon: any) => {
    const active = location.pathname === to;

    return (
      <Link
        key={to}
        to={to}
        onClick={onNavigate}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: theme.spacing.sm,
          padding: `${theme.spacing.sm} ${theme.spacing.md}`,
          borderRadius: theme.radius.md,
          marginBottom: 6,
          background: active ? theme.colors.surfaceAlt : "transparent",
          color: active ? theme.colors.primary : theme.colors.textPrimary,
          textDecoration: "none",
          fontWeight: 500,
          fontSize: 14,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.background = theme.colors.surfaceAlt;
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.background = "transparent";
          }
        }}
      >
        {/* 🔥 Active Indicator Bar */}
        {active && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 6,
              bottom: 6,
              width: 4,
              borderRadius: 4,
              background: theme.colors.primary,
            }}
          />
        )}

        {/* Icon */}
        <Icon size={18} />

        {/* Label */}
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <div
      style={{
        width: 270,
        background: theme.colors.surface,
        borderRight: `1px solid ${theme.colors.border}`,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* 🔥 TOP LOGO */}
      <div
        style={{
          padding: theme.spacing.lg,
          borderBottom: `1px solid ${theme.colors.border}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          background: theme.colors.surfaceAlt,
        }}
      >
        <img
          src={branding.sidebarLogoSrc}
          alt={branding.logoAlt}
          style={{ height: 40 }}
        />
        <span
          style={{
            fontSize: 11,
            color: theme.colors.textSecondary,
            letterSpacing: 1,
          }}
        >
          NAVIGATION
        </span>
      </div>

<<<<<<< HEAD
      {/* NAV ITEMS */}
      <div
        style={{
          flex: 1,
          padding: theme.spacing.md,
        }}
      >
        {/* ADMIN */}
        {user?.role === "ADMIN" && (
          <>
            {navItem("/admin", "Dashboard", LayoutDashboard)}
            {navItem("/admin/users", "Users", Users)}
            {navItem("/admin/assets", "Assets", Database)}
          </>
        )}

        {/* OPERATOR */}
        {user?.role === "OPERATOR" && (
          <>
            {navItem("/operator/map", "Map", Map)}
            {navItem("/operator/alerts", "Alerts", AlertTriangle)}
            {navItem("/operator/tcp-client", "TCP Client", Terminal)}
            {navItem("/reports", "Reports", FileText)}
          </>
        )}

        {/* EXTRA */}
        {hasPermission("crfs:read") &&
          navItem("/crfs/live", "CRFS Live", Radio)}

        {hasPermission("jammer:write") &&
          navItem("/jammer/control", "Jammer Control", Zap)}
      </div>
=======
      {user?.role === "ADMIN" && navItem("/admin/command-center", "Admin Command Center")}
      {user?.role === "ADMIN" && navItem("/admin/users", "Identity and Access")}
      {user?.role === "ADMIN" && navItem("/admin/assets", "Assets and Systems")}
      {user?.role === "ADMIN" && navItem("/admin/geospatial", "Geospatial Sources")}
      {user?.role === "ADMIN" && navItem("/planning", "Reporting Center")}

      {user?.role === "OPERATOR" && navItem("/operator/command-center", "Command Center")}
      {user?.role === "OPERATOR" && navItem("/operator/dashboard", "RF Operations")}
      {user?.role === "OPERATOR" && navItem("/operator/map", "Tactical Map")}
      {user?.role === "OPERATOR" && navItem("/operator/tcp-client", "Sensor Network")}
      {user?.role === "OPERATOR" && navItem("/operator/simulation", "Signal Lab")}
      {user?.role === "OPERATOR" && navItem("/reports", "Reporting Center")}
      {hasPermission("crfs:read") && navItem("/crfs/live", "CRFS Live")}
      {hasPermission("jammer:write") && navItem("/jammer/control", "Jammer Control")}
>>>>>>> origin/main
    </div>
  );
}