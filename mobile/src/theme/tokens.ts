/** Aligns with `old/figma-design/src/styles/theme.css` (white-first Sarthi AI tokens). */
export const colors = {
  // Brand — primary indigo
  indigo: '#4F46E5',
  indigoLight: '#EEF2FF',
  indigoDark: '#4338CA',

  // Surfaces
  white: '#FFFFFF',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceMuted: '#F8F9FA',
  /** Legacy: cards are white on muted canvas */
  card: '#FFFFFF',
  border: '#E5E5E5',
  borderMuted: '#F5F5F5',

  // Text
  text: '#1A1A1A',
  textSecondary: '#525252',
  textMuted: '#A3A3A3',

  // Semantic
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  error: '#EF4444',
  errorLight: '#FEF2F2',

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
  sm: 8,
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
