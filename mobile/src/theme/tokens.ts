export const colors = {
  // Brand
  indigo: '#5B4EE7',
  indigoLight: '#EEF0FF',
  indigoDark: '#3D35B5',

  // Neutrals
  white: '#FFFFFF',
  background: '#F7F8FC',
  card: '#EEF0FF',
  border: '#D8D9F0',
  text: '#1A1D3A',
  textSecondary: '#6B6F8C',
  textMuted: '#A0A5C4',

  // Semantic
  success: '#22C55E',
  successLight: '#DCFCE7',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',

  // Category chips
  chipWork: '#DBEAFE',
  chipWorkText: '#1E40AF',
  chipPersonal: '#FCE7F3',
  chipPersonalText: '#9D174D',
  chipNeedsFocus: '#FFFBEB',
  chipNeedsFocusText: '#92400E',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  display: {
    fontFamily: 'serif',
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 36,
  },
  title: {
    fontFamily: 'System',
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  body: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  caption: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  label: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
} as const;

export type Colors = typeof colors;
export type Spacing = typeof spacing;
export type Radii = typeof radii;
export type Typography = typeof typography;
