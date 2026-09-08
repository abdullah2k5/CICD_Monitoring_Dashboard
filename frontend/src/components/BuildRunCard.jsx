import { Box, Card, CardContent, Divider, Link, Stack, Typography } from '@mui/material';
import BuildStatusChip from './BuildStatusChip';
import AIAnalysisPanel from './AIAnalysisPanel';

function formatTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function BuildRunCard({ run, analyzing, analysisError, onAnalyze, onRetry }) {
  const timestamp = formatTimestamp(run.startedAt || run.createdAt);
  const commit = run.commitSha ? run.commitSha.slice(0, 7) : null;
  const isFailure = run.conclusion === 'failure';
  const isSuccess = run.status === 'completed' && run.conclusion === 'success';
  const statusBorder = isFailure ? 'error.main' : isSuccess ? 'success.main' : 'divider';

  return (
    <Card sx={{ borderLeft: 4, borderLeftColor: statusBorder, transition: 'border-color 160ms ease, background-color 160ms ease', '&:hover': { borderColor: 'primary.main', borderLeftColor: statusBorder, bgcolor: 'background.elevated' } }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" component="h3" noWrap>
              {run.workflowName || 'Unnamed workflow'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {run.branch || 'Branch unavailable'}
              {commit ? ` · ${commit}` : ''}
            </Typography>
          </Box>
          <Box sx={{ '& .MuiChip-root': { fontSize: '0.8rem', fontWeight: 800, minHeight: 32 } }}>
            <BuildStatusChip run={run} />
          </Box>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.75, sm: 2 }} sx={{ mt: 2 }}>
          {timestamp && <Typography variant="caption" color="text.secondary">Started {timestamp}</Typography>}
          {run.htmlUrl && (
            <Link href={run.htmlUrl} target="_blank" rel="noopener noreferrer" variant="caption" underline="hover">
              Open run ↗
            </Link>
          )}
        </Stack>

        {run.conclusion === 'failure' && (
          <>
            <Divider sx={{ mt: 2 }} />
            <AIAnalysisPanel
              analysis={run.aiAnalysis}
              loading={analyzing}
              error={analysisError}
              onAnalyze={onAnalyze}
              onRetry={onRetry}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default BuildRunCard;
