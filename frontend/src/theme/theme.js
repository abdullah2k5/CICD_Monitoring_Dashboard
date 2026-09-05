import { createTheme } from '@mui/material/styles';

// Centralized MUI theme so palette/typography can be adjusted in one place as the app grows.
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
  },
});

export default theme;
