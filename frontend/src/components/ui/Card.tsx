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


import React from "react";
import { useTheme } from "../../context/ThemeContext";

type CardProps = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
};

export default function Card({
  children,
  style,
  className,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: CardProps) {
  const { theme } = useTheme();

  const isDark = theme.mode === "dark";

  return (
    <div
      className={className}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "relative",

        // 🔹 Glass background
        background: isDark
          ? "rgba(255, 255, 255, 0.05)"
          : "rgba(255, 255, 255, 0.65)",

        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",

        padding: theme.spacing.lg,
        borderRadius: 10,

        border: "1px solid rgba(17, 193, 202, 0.6)",

        boxShadow: isDark
          ? "0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(17,193,202,0.2)"
          : "0 4px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(17,193,202,0.15)",

        transition: "all 0.25s ease",

        color: theme.colors.textPrimary,

        ...style, // ✅ allow override
      }}
    >
      {children}
    </div>
  );
}