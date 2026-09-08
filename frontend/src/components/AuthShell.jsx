import { Box, Paper, Stack, Typography } from '@mui/material';

function AuthShell({ title, description, children, footer }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        px: { xs: 2, sm: 4, md: 0 },
        py: { xs: 3, sm: 5, md: 8 },
        bgcolor: 'background.default',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 47px, rgba(148, 163, 184, 0.11) 48px), repeating-linear-gradient(90deg, transparent 0, transparent 159px, rgba(52, 211, 153, 0.07) 160px)',
        backgroundSize: '100% 48px, 160px 100%',
        '&::before': {
          content: '"+  add       -  remove       +  pass       -  deploy       +  main"',
          position: 'absolute',
          top: { xs: 24, md: 96 },
          right: { xs: 16, md: '8vw' },
          color: 'rgba(148, 163, 184, 0.22)',
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: { xs: '0.65rem', md: '0.8rem' },
          whiteSpace: 'pre',
          pointerEvents: 'none',
        },
        '&::after': {
          content: '"-  diff      +  build      -  fail      +  checks      -  merge"',
          position: 'absolute',
          bottom: { xs: 24, md: 96 },
          right: { xs: 16, md: '10vw' },
          color: 'rgba(148, 163, 184, 0.18)',
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: { xs: '0.65rem', md: '0.8rem' },
          whiteSpace: 'pre',
          pointerEvents: 'none',
        },
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          width: '100%',
          maxWidth: 440,
          ml: { xs: 0, md: '12vw' },
          p: { xs: 3, sm: 4.5 },
          position: 'relative',
          zIndex: 1,
          borderLeft: 4,
          borderLeftColor: 'success.main',
          bgcolor: 'background.paper',
          boxShadow: '0 22px 56px rgba(0, 0, 0, 0.32)',
          '& .MuiOutlinedInput-root': {
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148, 163, 184, 0.32)' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(147, 197, 253, 0.65)' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.light', borderWidth: 2 },
          },
        }}
      >
        <Stack spacing={3.5}>
          <Box>
            <Typography variant="body2" sx={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', color: 'success.main', fontWeight: 700 }}>
              CI/CD Monitor
            </Typography>
            <Typography variant="h2" component="h1" sx={{ mt: 1, fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>
              {title}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {description}
            </Typography>
          </Box>
          {children}
          {footer}
        </Stack>
      </Paper>
    </Box>
  );
}

export default AuthShell;
