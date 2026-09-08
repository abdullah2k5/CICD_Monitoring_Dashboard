import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0b1120',
      paper: '#111827',
      sidebar: '#0f172a',
      elevated: '#172033',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
      disabled: '#64748b',
    },
    primary: {
      main: '#60a5fa',
      light: '#93c5fd',
      dark: '#2563eb',
      contrastText: '#07111f',
    },
    success: { main: '#34d399' },
    error: { main: '#f87171' },
    warning: { main: '#fbbf24' },
    info: { main: '#38bdf8' },
    ai: { main: '#a78bfa' },
    divider: 'rgba(148, 163, 184, 0.16)',
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.04em' },
    h2: { fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.035em' },
    h3: { fontSize: '1.5rem', fontWeight: 750, letterSpacing: '-0.025em' },
    h4: { fontSize: '1.25rem', fontWeight: 750, letterSpacing: '-0.02em' },
    h5: { fontSize: '1.125rem', fontWeight: 700 },
    h6: { fontSize: '1rem', fontWeight: 700 },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.55 },
    caption: { fontSize: '0.75rem', lineHeight: 1.45 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 9, minHeight: 40 } },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: { backgroundImage: 'none', borderColor: 'divider' },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTextField: {
      defaultProps: { size: 'small', variant: 'outlined' },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 700 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 10 } } },
    MuiAppBar: { defaultProps: { elevation: 0 } },
    MuiDrawer: { styleOverrides: { paper: { backgroundImage: 'none' } } },
    MuiTooltip: { defaultProps: { arrow: true } },
  },
});

export default theme;
