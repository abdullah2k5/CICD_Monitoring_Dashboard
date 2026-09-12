import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Divider, InputAdornment, Link, TextField, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import AuthShell from '../components/AuthShell';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      description="Monitor your GitHub repositories and CI/CD workflows in one place."
      footer={(
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          New to CI/CD Monitor?{' '}
          <Link component={RouterLink} to="/register" underline="hover">Create an account</Link>
        </Typography>
      )}
    >
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          autoFocus
        />
        <TextField
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <Button type="button" size="small" onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Button>
                </InputAdornment>
              ),
            },
          }}
        />
        <Button type="submit" variant="contained" color="success" size="large" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </Box>
      <Divider sx={{ my: 2, color: 'text.disabled', fontSize: '0.8125rem' }}>or</Divider>
      <Button
        component="a"
        href={`${API_BASE_URL}/api/auth/github`}
        variant="outlined"
        color="primary"
        size="large"
        fullWidth
      >
        Continue with GitHub
      </Button>
    </AuthShell>
  );
}

export default Login;
