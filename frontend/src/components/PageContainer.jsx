import { Box } from '@mui/material';

function PageContainer({ children }) {
  return (
    <Box
      component="main"
      sx={{
        width: '100%',
        maxWidth: 1440,
        mx: 'auto',
        px: { xs: 2, sm: 3, lg: 4 },
        py: { xs: 2.5, sm: 3, lg: 4 },
      }}
    >
      {children}
    </Box>
  );
}

export default PageContainer;
