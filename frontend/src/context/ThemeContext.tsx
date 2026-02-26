import { createContext, useContext, useState } from "react";
import { themes, ThemeType } from "../theme";

const ThemeContext = createContext<{
  theme: ThemeType;
  toggleTheme: () => void;
}>({
  theme: themes.light,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<"light" | "dark">("light");

  const toggleTheme = () => {
    setMode(prev => (prev === "light" ? "dark" : "light"));
  };

  const theme = themes[mode];

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
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