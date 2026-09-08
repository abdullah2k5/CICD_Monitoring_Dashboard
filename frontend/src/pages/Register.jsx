import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, InputAdornment, Link, TextField, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import AuthShell from '../components/AuthShell';

function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
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
      await register(name, email, password);
      navigate('/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create account"
      description="Connect your workspace and keep every workflow signal in view."
      footer={(
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          Already have an account?{' '}
          <Link component={RouterLink} to="/login" underline="hover">Sign in</Link>
        </Typography>
      )}
    >
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
          autoFocus
        />
        <TextField
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <TextField
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
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
          {submitting ? 'Creating account...' : 'Create account'}
        </Button>
      </Box>
    </AuthShell>
  );
}

export default Register;
