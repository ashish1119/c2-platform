// import { useTheme } from "../../context/ThemeContext";

// export default function Card({ children }: { children: React.ReactNode }) {
//   const { theme } = useTheme();

//   return (
//     <div
//       style={{
//         background: theme.colors.surface,
//         padding: theme.spacing.lg,
//         borderRadius: theme.radius.lg,
//         boxShadow: theme.shadows.sm,
//         border: `1px solid ${theme.colors.border}`,
//       }}
//     >
//       {children}
//     </div>
//   );
// }


import { useTheme } from "../../context/ThemeContext";

export default function Card({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  const isDark = theme.mode === "dark";

  return (
    <div
      style={{
        position: "relative",

        // 🔹 Glass background
        background: isDark
          ? "rgba(255, 255, 255, 0.05)"
          : "rgba(255, 255, 255, 0.65)",

        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",

        // 🔹 Spacing
        padding: theme.spacing.lg,

        // 🔹 Shape (sharper edges)
        borderRadius: 10,

        // 🔹 Border (your color)
        border: "1px solid rgba(17, 193, 202, 0.6)",

        // 🔹 Subtle glow border effect
        boxShadow: isDark
          ? "0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(17,193,202,0.2)"
          : "0 4px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(17,193,202,0.15)",

        // 🔹 Smooth hover feel
        transition: "all 0.25s ease",

        // 🔹 Better text rendering
        color: theme.colors.textPrimary,
      }}
    >
      {children}
    </div>
  );
}