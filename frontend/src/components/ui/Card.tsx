import { useTheme } from "../../context/ThemeContext";

export default function Card({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <div
      style={{
        background: theme.colors.surface,
        padding: theme.spacing.lg,
        borderRadius: theme.radius.lg,
        boxShadow: theme.shadows.sm,
        border: `1px solid ${theme.colors.border}`,
      }}
    >
      {children}
    </div>
  );
}