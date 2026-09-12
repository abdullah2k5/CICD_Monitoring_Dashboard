import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { analyzeBuildRun, listBuildRuns, listRepos, syncBuildRuns } from '../api/client';
import BuildRunCard from '../components/BuildRunCard';

function RepoDetail() {
  const { repoId } = useParams();
  const { token } = useAuth();

  const [runs, setRuns] = useState([]);
  const [repository, setRepository] = useState(null);
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

  async function loadRepository() {
    try {
      const repositories = await listRepos(token);
      const selectedRepository = repositories.find((repo) => repo._id === repoId);
      setRepository(selectedRepository || null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadRuns();
    loadRepository();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId]);

  async function handleSync() {
    if (syncing) return;
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
    if (analyzingIds[runId]) return;
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
    <Stack spacing={{ xs: 3, md: 4 }}>
        <Box>
        <Button component={RouterLink} to="/dashboard">
          ← Back to Dashboard
        </Button>
        </Box>

        <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          <Stack spacing={2.5}>
            <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h2" component="h1" noWrap>
                  {repository?.name || 'Repository details'}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }} noWrap>
                  {repository?.fullName || 'Repository information unavailable'}
                </Typography>
              </Box>
              <Button
                variant="contained"
                onClick={handleSync}
                disabled={syncing}
                startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : null}
              >
                {syncing ? 'Syncing...' : 'Sync Runs'}
              </Button>
            </Box>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              {repository && <Typography variant="body2" color={repository.private ? 'text.secondary' : 'success.main'}>{repository.private ? 'Private' : 'Public'}</Typography>}
              {repository?.defaultBranch && <Typography variant="body2" color="text.secondary">· {repository.defaultBranch}</Typography>}
              {repository?.htmlUrl && <Link href={repository.htmlUrl} target="_blank" rel="noopener noreferrer" variant="body2" underline="hover">Open on GitHub ↗</Link>}
            </Stack>
          </Stack>
        </Paper>

        {error && (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={loadRuns} disabled={loading}>Try Again</Button>}>
            Unable to load workflow runs: {error}
          </Alert>
        )}

        <Box>
          <Typography variant="h4" component="h2">Workflow Runs</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>Recent GitHub Actions workflow executions.</Typography>
        </Box>

        {loading ? (
          <Grid container spacing={2}>
            {[0, 1, 2].map((item) => (
              <Grid key={item} size={{ xs: 12 }}>
                <Paper variant="outlined" sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ height: 24, bgcolor: 'action.hover', borderRadius: 1, width: '38%' }} />
                      <Box sx={{ height: 16, bgcolor: 'action.hover', borderRadius: 1, width: '55%', mt: 1 }} />
                    </Box>
                    <Box sx={{ height: 28, bgcolor: 'action.hover', borderRadius: 4, width: 90 }} />
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        ) : runs.length === 0 ? (
          <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
            <Typography variant="h5">No workflow runs found</Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 480, mx: 'auto', mt: 1 }}>
              GitHub Actions runs will appear here when they are available for this repository.
            </Typography>
            <Button variant="contained" onClick={handleSync} disabled={syncing} sx={{ mt: 3 }}>
              {syncing ? 'Syncing...' : 'Sync Runs'}
            </Button>
          </Paper>
        ) : (
          <Stack spacing={2}>
            {runs.map((run) => (
              <BuildRunCard
                key={run._id}
                run={run}
                analyzing={Boolean(analyzingIds[run._id])}
                analysisError={analysisErrors[run._id]}
                onAnalyze={() => handleAnalyze(run._id)}
                onRetry={() => handleAnalyze(run._id)}
              />
            ))}
          </Stack>
        )}
    </Stack>
  );
}

export default RepoDetail;
