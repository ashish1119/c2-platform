import { useTheme } from "../../context/ThemeContext";

export default function Topbar() {
  const { theme, toggleTheme } = useTheme();

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
      <div style={{ fontWeight: 600 }}>
        Enterprise Command Platform
      </div>

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
        Toggle Theme
      </button>
    </div>
  );
}