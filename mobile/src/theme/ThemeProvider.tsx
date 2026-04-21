import React, { createContext, useContext } from 'react';
import { colors, spacing, radii, typography, type Colors, type Spacing, type Radii, type Typography } from './tokens';

export const ThemeContext = createContext<{
  colors: Colors;
  spacing: Spacing;
  radii: Radii;
  typography: Typography;
}>({ colors, spacing, radii, typography });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ colors, spacing, radii, typography }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
