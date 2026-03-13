import { APP_VARIANT } from '../config';

const primaryColor = APP_VARIANT === 'helper' ? '#9A3412' : '#1E3A8A';
const accentColor = APP_VARIANT === 'helper' ? '#FB923C' : '#FACC15';

export const theme = {
  colors: {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    text: '#0F172A',
    muted: '#475569',
    border: '#E2E8F0',
    primary: primaryColor,
    primaryText: '#FFFFFF',
    accent: accentColor,
    danger: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  space: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 22,
    xl: 28,
  },
  shadow: {
    card: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
  },
};
