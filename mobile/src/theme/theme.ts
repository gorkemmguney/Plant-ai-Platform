// NOT: Anahtar isimleri (primary, secondary, buttonPrimary vb.) bilinçli olarak
// KORUNDU — böylece uygulamadaki hiçbir ekrana dokunmadan, sadece bu dosyadaki
// değerleri değiştirerek tüm temayı yeşile çevirebiliyoruz.
export const colors = {
  bg: '#FBFDFC',
  bgAlt: '#F3F9F4',
  card: '#ffffff',
  cardAlt: '#fbfdfb',

  ink: '#222222',
  muted: '#7b8a82',
  muted2: '#9c9c9c',

  border: '#eef3ef',
  borderSoft: '#f4f8f5',

  // Ana vurgu: mockup'taki canlı "büyüyen bitki" yeşili — nötr arka planlar
  // üzerinde tek, net vurgu rengi olarak kullanılır (durum rozetleri, aktif sekme).
  primary: '#1DAA63',
  primaryDeep: '#178A50',
  primarySoft: 'rgba(29,170,99,0.12)',

  secondary: '#1B4332',
  secondaryDeep: '#0F2A1F',
  secondarySoft: 'rgba(27,67,50,0.08)',

  buttonPrimary: '#1DAA63',
  buttonPrimaryText: '#ffffff',

  // "Şeffaf/cam" kartlar için — BlurView ile birlikte kullanılır
  glass: 'rgba(255,255,255,0.75)',
  glassOnDark: 'rgba(255,255,255,0.16)',
  glassBorder: 'rgba(255,255,255,0.5)',
  glassBar: 'rgba(255,255,255,0.85)',

  white: '#ffffff',
  amber: '#f5a524',
  red: '#e0556b',
  green: '#1DAA63',
};

export const gradients = {
  header: [colors.secondary, colors.secondaryDeep] as const,
  primaryButton: [colors.buttonPrimary, colors.primaryDeep] as const,
  softCard: [colors.card, colors.cardAlt] as const,
  hero: [colors.secondary, colors.secondaryDeep] as const,
  // Ana ekranın tam sayfa arka planı: mint -> beyaz yumuşak geçiş
  screenBg: ['#F4FAF6', '#FAFDFB', '#ffffff'] as const,
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
    shadowColor: '#0F2A1F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F2A1F',
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
  green: { bg: '#e3f3ea', text: '#2E8B5E' },
};
