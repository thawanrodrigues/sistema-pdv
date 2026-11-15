import { useColorScheme } from 'react-native';

// Tema base desacoplado. Cores podem ser facilmente trocadas aqui.
export const colors = {
  light: {
    background: '#0a2540',
    headerBackground: '#ffffff',
    textPrimary: '#ffffff',
    textSecondary: '#cbd5e1',
    textHeader: '#1e293b',
    accent: '#f59e0b',
    border: '#e2e8f0',
  },
  dark: {
    background: '#020617',
    headerBackground: '#1e293b',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    textHeader: '#f8fafc',
    accent: '#3b82f6',
    border: '#334155',
  }
};

export const useTheme = () => {
  const colorScheme = useColorScheme() ?? 'light';
  return {
    colors: colors[colorScheme],
    isDark: colorScheme === 'dark',
  };
};
