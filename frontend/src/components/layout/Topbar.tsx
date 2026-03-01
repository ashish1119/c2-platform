import { useTheme } from "../../context/ThemeContext";
import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { changePassword } from "../../api/auth";

type TopbarProps = {
  isSidebarVisible: boolean;
  onToggleSidebar: () => void;
};

export default function Topbar({ isSidebarVisible, onToggleSidebar }: TopbarProps) {
  const { theme, mode, setting, setThemeMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const pageTitle = (() => {
    const pathname = location.pathname;
    if (pathname === "/admin") return "Admin Dashboard";
    if (pathname === "/admin/users") return "User Management";
    if (pathname === "/admin/assets") return "Asset Management";
    if (pathname === "/admin/decodio") return "Decodio Control";
    if (pathname === "/admin/audit-logs") return "Audit Logs";
    if (pathname === "/admin/sms") return "SMS Monitoring";
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
        position: "relative",
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

        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: theme.spacing.sm,
            background: theme.colors.surfaceAlt,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            color: theme.colors.textPrimary,
            fontSize: theme.typography.body.fontSize,
          }}
        >
          Theme
          <select
            value={setting}
            onChange={(event) => setThemeMode(event.target.value as "light" | "dark" | "system")}
            title={`Current mode: ${mode}`}
            style={{
              background: theme.colors.surface,
              color: theme.colors.textPrimary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.sm,
              padding: `2px ${theme.spacing.sm}`,
            }}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: theme.spacing.sm,
            background: theme.colors.surfaceAlt,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            color: theme.colors.textPrimary,
          }}
        >
          <div style={{ display: "grid", lineHeight: 1.2 }}>
            <span style={{ fontWeight: 600 }}>{user?.username ?? "Unknown User"}</span>
            <span style={{ fontSize: 12, color: theme.colors.textSecondary }}>{user?.role ?? "-"}</span>
          </div>

          <button
            onClick={() => {
              setShowPasswordForm((value) => !value);
              setPasswordStatus("");
              setCurrentPassword("");
              setNewPassword("");
            }}
            style={{
              background: theme.colors.surface,
              color: theme.colors.textPrimary,
              border: `1px solid ${theme.colors.border}`,
              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
              borderRadius: theme.radius.sm,
              cursor: "pointer",
            }}
          >
            Change Password
          </button>

          <button
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
            style={{
              background: theme.colors.danger,
              color: "#ffffff",
              border: `1px solid ${theme.colors.border}`,
              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
              borderRadius: theme.radius.sm,
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {showPasswordForm && (
        <div
          style={{
            position: "absolute",
            top: 74,
            right: theme.spacing.xl,
            width: 320,
            zIndex: 2000,
            background: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            boxShadow: theme.shadows.md,
            padding: theme.spacing.md,
            display: "grid",
            gap: theme.spacing.sm,
          }}
        >
          <div style={{ fontWeight: 600 }}>Change Password</div>
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Current password"
            style={{
              width: "100%",
              padding: theme.spacing.sm,
              borderRadius: theme.radius.sm,
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.background,
              color: theme.colors.textPrimary,
            }}
          />
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="New password"
            style={{
              width: "100%",
              padding: theme.spacing.sm,
              borderRadius: theme.radius.sm,
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.background,
              color: theme.colors.textPrimary,
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: theme.spacing.sm }}>
            <button
              onClick={() => {
                setShowPasswordForm(false);
                setPasswordStatus("");
              }}
              style={{
                background: theme.colors.surfaceAlt,
                color: theme.colors.textPrimary,
                border: `1px solid ${theme.colors.border}`,
                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                borderRadius: theme.radius.sm,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!currentPassword || !newPassword) {
                  setPasswordStatus("Please enter current and new password.");
                  return;
                }
                try {
                  setBusy(true);
                  setPasswordStatus("");
                  const response = await changePassword({
                    current_password: currentPassword,
                    new_password: newPassword,
                  });
                  setPasswordStatus(response.data.message ?? "Password updated");
                  setCurrentPassword("");
                  setNewPassword("");
                } catch (error: any) {
                  setPasswordStatus(error?.response?.data?.detail ?? "Failed to change password");
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              style={{
                background: theme.colors.primary,
                color: "#ffffff",
                border: `1px solid ${theme.colors.border}`,
                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                borderRadius: theme.radius.sm,
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? "Saving..." : "Save"}
            </button>
          </div>
          {passwordStatus && (
            <div style={{ color: passwordStatus.toLowerCase().includes("success") ? theme.colors.success : theme.colors.danger, fontSize: 12 }}>
              {passwordStatus}
            </div>
          )}
        </div>
      )}
    </div>
  );
}