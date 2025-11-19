export const APP_NAME = 'Fresky Hielo';

export const COLORS = {
  primary: '#1976D2',
  primaryDark: '#0D47A1',
  primaryLight: '#E3F2FD',
  secondary: '#9C27B0',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  border: '#E0E0E0',
  textPrimary: '#212121',
  textSecondary: '#757575',
  muted: '#9E9E9E',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#D32F2F',
  info: '#0288D1',
  // Card gradients or specific colors
  cards: {
    sales: '#9C27B0',
    billing: '#FF9800',
    precorte: '#607D8B',
    traspaso: '#3F51B5',
    report: '#009688',
    data: '#00897B',
    settings: '#5E35B1',
  },
};

export const SPACING = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 40,
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const BORDER_RADIUS = {
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
  round: 9999,
};

export const TYPOGRAPHY = {
  h1: { fontSize: 32, fontWeight: 'bold' as 'bold', color: COLORS.textPrimary },
  h2: { fontSize: 24, fontWeight: 'bold' as 'bold', color: COLORS.textPrimary },
  h3: { fontSize: 20, fontWeight: '600' as '600', color: COLORS.textPrimary },
  body: { fontSize: 16, color: COLORS.textPrimary },
  caption: { fontSize: 14, color: COLORS.textSecondary },
  small: { fontSize: 12, color: COLORS.muted },
};
