import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useGlobalStore } from '@/stores/global';
import { themeColors, rankNames, medalDefs, themeText, dayTypeLabel } from '@/config/theme';
import type { ThemeColors } from '@/config/theme';
import type { ThemeType, MedalDef } from '@/types';

export interface ThemeContextValue {
  theme: ThemeType;
  colors: ThemeColors;
  rankNames: string[];
  medals: MedalDef[];
  text: ReturnType<typeof getThemeText>;
  dayTypeLabel: typeof dayTypeLabel;
  setTheme: (theme: ThemeType) => void;
}

function getThemeText(theme: ThemeType) {
  return themeText[theme];
}

const defaultValue: ThemeContextValue = {
  theme: 'prince',
  colors: themeColors.prince,
  rankNames: rankNames.prince,
  medals: medalDefs.prince,
  text: getThemeText('prince'),
  dayTypeLabel,
  setTheme: () => {},
};

export const ThemeContext = createContext<ThemeContextValue>(defaultValue);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const theme = useGlobalStore((s) => s.theme);
  const setThemeGlobal = useGlobalStore((s) => s.setTheme);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      colors: themeColors[theme],
      rankNames: rankNames[theme],
      medals: medalDefs[theme],
      text: getThemeText(theme),
      dayTypeLabel,
      setTheme: setThemeGlobal,
    }),
    [theme, setThemeGlobal],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
