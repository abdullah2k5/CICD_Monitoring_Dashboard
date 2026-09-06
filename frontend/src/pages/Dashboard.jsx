import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Typography,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { listRepos, syncRepos } from '../api/client';

function Dashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

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
    setSyncing(true);
    setError('');
    try {
      await syncRepos(token);
      await loadRepos();
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
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1">
          Welcome, {user?.name}
        </Typography>
        <Button variant="outlined" onClick={handleLogout}>
          Logout
        </Button>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          onClick={handleSync}
          disabled={syncing}
          startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {syncing ? 'Syncing...' : 'Sync Repos'}
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
      ) : repos.length === 0 ? (
        <Typography color="text.secondary">
          No repos yet — click Sync Repos to import from GitHub.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {repos.map((repo) => (
            <Grid key={repo._id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" component="h2" gutterBottom noWrap>
                    {repo.name}
                  </Typography>
                  <Chip
                    label={repo.private ? 'Private' : 'Public'}
                    color={repo.private ? 'default' : 'success'}
                    size="small"
                  />
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    onClick={() => navigate(`/dashboard/repos/${repo._id}`)}
                  >
                    View Builds
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

export default Dashboard;
