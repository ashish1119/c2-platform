import { createContext, useContext, useState } from "react";
import { themes, ThemeType } from "../theme";

const ThemeContext = createContext<{
  theme: ThemeType;
  mode: "light" | "dark";
  toggleTheme: () => void;
}>({
  theme: themes.light,
  mode: "light",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("theme-mode");
    return stored === "dark" ? "dark" : "light";
  });

  const toggleTheme = () => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("theme-mode", next);
      return next;
    });
  };

  const theme = themes[mode];

  return (
    <ThemeContext.Provider value={{ theme, mode, toggleTheme }}>
      <div
        style={{
          background: theme.colors.background,
          color: theme.colors.textPrimary,
          minHeight: "100vh",
          fontFamily: theme.typography.fontFamily,
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);