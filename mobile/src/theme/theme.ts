export const colors = {
  bg: '#f7f7f8',
  bgAlt: '#eef0f1',
  card: '#ffffff',
  cardAlt: '#fafafa',

  ink: '#111114',
  muted: '#6b6b74',
  muted2: '#9a9aa3',

  border: '#e4e4e8',
  borderSoft: '#eef0f1',

  primary: '#eda972',
  primaryDeep: '#dd8f4f',
  primarySoft: 'rgba(237,169,114,0.16)',

  secondary: '#4a4a65',
  secondaryDeep: '#37374d',
  secondarySoft: 'rgba(74,74,101,0.10)',

  buttonPrimary: '#15151a',
  buttonPrimaryText: '#ffffff',

  white: '#ffffff',
  amber: '#f5a524',
  red: '#e0556b',
  green: '#5fb88a',
};

export const gradients = {
  header: [colors.secondary, colors.secondaryDeep] as const,
  primaryButton: [colors.buttonPrimary, '#1f1f26'] as const,
  softCard: [colors.card, colors.cardAlt] as const,
};

export const fonts = {
  display: 'Inter_800ExtraBold',
  displaySemi: 'Inter_700Bold',
  displayExtra: 'Inter_800ExtraBold',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  sansExtra: 'Inter_800ExtraBold',
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 22,
  full: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const shadow = {
  sm: {
    shadowColor: '#111114',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#111114',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 6,
  },
  glow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
};

export const badgeColors = {
  primary: { bg: colors.primarySoft, text: colors.primaryDeep },
  secondary: { bg: colors.secondarySoft, text: colors.secondary },
  amber: { bg: '#fdf0dc', text: '#b3711a' },
  red: { bg: '#fbe4e8', text: '#c23434' },
  green: { bg: '#e3f3ea', text: '#3d8f66' },
};
