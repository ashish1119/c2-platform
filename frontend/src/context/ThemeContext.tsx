import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { themes, ThemeType } from "../theme";

type ThemeMode = "light" | "dark";
type ThemeSetting = ThemeMode | "system";

const ThemeContext = createContext<{
  theme: ThemeType;
  mode: ThemeMode;
  setting: ThemeSetting;
  setThemeMode: (next: ThemeSetting) => void;
  toggleTheme: () => void;
}>({
  theme: themes.light,
  mode: "light",
  setting: "light",
  setThemeMode: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [setting, setSetting] = useState<ThemeSetting>(() => {
    const stored = localStorage.getItem("theme-mode");
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
    return "light";
  });

  const [systemMode, setSystemMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return "light";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemMode(event.matches ? "dark" : "light");
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const mode: ThemeMode = setting === "system" ? systemMode : setting;

  const setThemeMode = (next: ThemeSetting) => {
    setSetting(next);
    localStorage.setItem("theme-mode", next);
  };

  const toggleTheme = () => {
    setThemeMode(mode === "light" ? "dark" : "light");
  };

  const theme = useMemo(() => themes[mode], [mode]);

  return (
    <ThemeContext.Provider value={{ theme, mode, setting, setThemeMode, toggleTheme }}>
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