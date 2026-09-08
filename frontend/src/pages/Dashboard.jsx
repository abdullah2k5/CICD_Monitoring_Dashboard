import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { listRepos, syncRepos } from '../api/client';
import RepositoryCard from '../components/RepositoryCard';

function Dashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [syncSuccess, setSyncSuccess] = useState(false);

  async function loadRepos() {
    setLoading(true);
    setError('');
    try {
      const data = await listRepos(token);
      setRepos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRepos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setError('');
    try {
      await syncRepos(token);
      await loadRepos();
      setSyncSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <Stack spacing={{ xs: 3, md: 4 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Box>
          <Typography variant="h2" component="h1">
            Welcome back, {user?.name || 'there'}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Monitor your GitHub repositories and CI/CD workflows.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={handleLogout}
          sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
        >
          Logout
        </Button>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Box>
          <Typography variant="h5">Repository overview</Typography>
          <Typography variant="body2" color="text.secondary">
            Connected GitHub repositories
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={handleSync}
          disabled={syncing}
          startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {syncing ? 'Syncing...' : 'Sync Repositories'}
        </Button>
      </Box>

      {error && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={loadRepos} disabled={loading}>
                Try Again
              </Button>
            }
          >
            <Typography variant="body2" fontWeight={700}>
              Unable to load repositories
            </Typography>
            <Typography variant="body2">{error}</Typography>
          </Alert>
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography variant="caption" color="text.secondary">Total repositories</Typography>
            <Typography variant="h3" sx={{ mt: 0.5 }}>{repos.length}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <Typography variant="caption" color="text.secondary">Public</Typography>
            <Typography variant="h3" color="success.main" sx={{ mt: 0.5 }}>
              {repos.filter((repo) => !repo.private).length}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <Typography variant="caption" color="text.secondary">Private</Typography>
            <Typography variant="h3" color="text.primary" sx={{ mt: 0.5 }}>
              {repos.filter((repo) => repo.private).length}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 2 }}>
          <Box>
            <Typography variant="h5">Your Repositories</Typography>
            <Typography variant="body2" color="text.secondary">
              {repos.length} connected {repos.length === 1 ? 'repository' : 'repositories'}
            </Typography>
          </Box>
        </Box>

        {loading ? (
          <Grid container spacing={2}>
            {[0, 1, 2].map((item) => (
              <Grid key={item} size={{ xs: 12, sm: 6, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2.25 }}>
                  <Skeleton width="48%" />
                  <Skeleton variant="text" sx={{ fontSize: '1.5rem', mt: 1 }} />
                  <Skeleton width="72%" />
                  <Skeleton width="40%" sx={{ mt: 2 }} />
                  <Skeleton width="100%" sx={{ mt: 3 }} />
                </Paper>
              </Grid>
            ))}
          </Grid>
        ) : repos.length === 0 ? (
          <Box sx={{ py: { xs: 4, sm: 6 }, textAlign: 'center' }}>
            <Typography variant="h5">No repositories connected</Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 460, mx: 'auto', mt: 1 }}>
              Connect your GitHub repositories to start monitoring your CI/CD workflows.
            </Typography>
            <Button variant="contained" onClick={handleSync} disabled={syncing} sx={{ mt: 3 }}>
              {syncing ? 'Syncing...' : 'Sync Repositories'}
            </Button>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {repos.map((repo) => (
              <Grid key={repo._id} size={{ xs: 12, sm: 6, md: 4 }}>
                <RepositoryCard
                  repository={repo}
                  onViewBuilds={(repoId) => navigate(`/dashboard/repos/${repoId}`)}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      <Snackbar
        open={syncSuccess}
        autoHideDuration={4000}
        onClose={() => setSyncSuccess(false)}
        message="Repositories synchronized successfully"
      />
    </Stack>
  );
}

export default Dashboard;
