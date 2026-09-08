import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import ReactMarkdown from 'react-markdown';

function AIAnalysisPanel({ analysis, loading, error, onAnalyze, onRetry }) {
  if (analysis) {
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="secondary.main" sx={{ fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          AI Failure Analysis
        </Typography>
        <Alert severity="info" sx={{ mt: 0.75, bgcolor: 'rgba(167, 139, 250, 0.1)', borderColor: 'rgba(167, 139, 250, 0.28)' }}>
          <Box sx={{ '& p': { mt: 0, mb: 1.5 }, '& p:last-child': { mb: 0 }, '& h1, & h2, & h3': { mt: 1.5, mb: 1, fontSize: '1rem' }, '& ul, & ol': { pl: 2.5, mb: 1.5 }, '& code': { px: 0.5, py: 0.25, borderRadius: 0.5, bgcolor: 'rgba(15, 23, 42, 0.55)', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' } }}>
            <ReactMarkdown>{analysis}</ReactMarkdown>
          </Box>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Understand why this workflow failed and what to check next.
      </Typography>
      {error && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={onRetry}>Retry</Button>} sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      )}
      <Button
        size="small"
        variant="outlined"
        color="secondary"
        onClick={onAnalyze}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}
      >
        {loading ? 'Analyzing...' : 'Analyze Failure'}
      </Button>
    </Box>
  );
}

export default AIAnalysisPanel;
