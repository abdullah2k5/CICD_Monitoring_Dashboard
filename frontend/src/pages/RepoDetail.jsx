import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { analyzeBuildRun, listBuildRuns, syncBuildRuns } from '../api/client';

function statusChipColor(run) {
  if (run.conclusion === 'success') return 'success';
  if (run.conclusion === 'failure') return 'error';
  return 'default';
}

function statusChipLabel(run) {
  if (run.conclusion) return run.conclusion;
  return run.status || 'unknown';
}

function RepoDetail() {
  const { repoId } = useParams();
  const { token } = useAuth();

  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [analyzingIds, setAnalyzingIds] = useState({});
  const [analysisErrors, setAnalysisErrors] = useState({});

  async function loadRuns() {
    setLoading(true);
    setError('');
    try {
      const data = await listBuildRuns(token, repoId);
      setRuns(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId]);

  async function handleSync() {
    setSyncing(true);
    setError('');
    try {
      await syncBuildRuns(token, repoId);
      await loadRuns();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleAnalyze(runId) {
    setAnalyzingIds((prev) => ({ ...prev, [runId]: true }));
    setAnalysisErrors((prev) => ({ ...prev, [runId]: '' }));
    try {
      const result = await analyzeBuildRun(token, repoId, runId);
      setRuns((prevRuns) =>
        prevRuns.map((run) =>
          run._id === runId
            ? { ...run, aiAnalysis: result.aiAnalysis, analyzedAt: result.analyzedAt }
            : run
        )
      );
    } catch (err) {
      setAnalysisErrors((prev) => ({ ...prev, [runId]: err.message }));
    } finally {
      setAnalyzingIds((prev) => ({ ...prev, [runId]: false }));
    }
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Button component={RouterLink} to="/dashboard">
          Back to Dashboard
        </Button>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1">
          Build Runs
        </Typography>
        <Button
          variant="contained"
          onClick={handleSync}
          disabled={syncing}
          startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {syncing ? 'Syncing...' : 'Sync Builds'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : runs.length === 0 ? (
        <Typography color="text.secondary">
          No build runs yet — click Sync Builds to check GitHub Actions for this repo.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {runs.map((run) => (
            <Card key={run._id} variant="outlined">
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                  }}
                >
                  <Box>
                    <Typography variant="subtitle1">{run.workflowName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {run.branch} · {run.commitSha?.slice(0, 7)}
                    </Typography>
                  </Box>
                  <Chip label={statusChipLabel(run)} color={statusChipColor(run)} size="small" />
                </Box>

                {run.conclusion === 'failure' && (
                  <Box sx={{ mt: 2 }}>
                    {run.aiAnalysis ? (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          AI Analysis
                        </Typography>
                        <Alert severity="info" sx={{ mt: 0.5 }}>
                          {run.aiAnalysis}
                        </Alert>
                      </Box>
                    ) : (
                      <>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={Boolean(analyzingIds[run._id])}
                          startIcon={
                            analyzingIds[run._id] ? (
                              <CircularProgress size={14} color="inherit" />
                            ) : null
                          }
                          onClick={() => handleAnalyze(run._id)}
                        >
                          {analyzingIds[run._id] ? 'Analyzing...' : 'Analyze Failure with AI'}
                        </Button>
                        {analysisErrors[run._id] && (
                          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                            {analysisErrors[run._id]}
                          </Typography>
                        )}
                      </>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}

export default RepoDetail;
