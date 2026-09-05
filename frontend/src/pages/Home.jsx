import { Box, Typography } from '@mui/material';

function Home() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
      }}
    >
      <Typography variant="h3" component="h1">
        CI/CD Monitoring Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Frontend scaffold ready.
      </Typography>
    </Box>
  );
}

export default Home;
