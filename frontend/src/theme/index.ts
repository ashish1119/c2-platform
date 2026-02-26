import { lightTheme } from "./light";
import { darkTheme } from "./dark";
import { spacing, radius, shadows, typography } from "./tokens";

export const themes = {
  light: {
    ...lightTheme,
    spacing,
    radius,
    shadows,
    typography,
  },
  dark: {
    ...darkTheme,
    spacing,
    radius,
    shadows,
    typography,
  },
};

export type ThemeType = typeof themes.light;