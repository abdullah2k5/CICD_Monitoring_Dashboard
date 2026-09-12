import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import AuthShell from '../components/AuthShell';

// The backend redirects here after GitHub OAuth with either:
//   /oauth/callback?token=<app JWT>&user=<JSON safe user>   (success)
//   /oauth/callback?error=<code>&message=<text>             (failure)
//
// AuthContext does not expose an OAuth setter yet, so this page never invents a
// storage mechanism. It looks for a conventional OAuth setter on the context and,
// if none exists, shows a clear error instead of silently dropping the session.
// When AuthContext is updated, it should expose one of these names so this page
// starts working without further changes.
const OAUTH_SETTER_NAMES = ['setOAuthSession', 'setAuthSession', 'completeOAuth', 'loginWithOAuth'];

// Reads and validates the OAuth query params the backend appended to the
// redirect. Returns { kind: 'success', token, user } or { kind: 'error', message }.
// Only the app's JWT is handled here; the GitHub access token never crosses the
// frontend, and this page never calls the GitHub API.
function parseOAuthQuery() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  const message = params.get('message');
  const token = params.get('token');
  const userRaw = params.get('user');

  // Backend routed us here with an OAuth failure (?error=...&message=...).
  if (error) {
    return { kind: 'error', message: message || 'GitHub sign-in failed. Please try again.' };
  }

  // No token means no authenticated session to store.
  if (!token) {
    return { kind: 'error', message: 'No sign-in information was received. Please try signing in again.' };
  }

  // Safely parse the JSON serialized safe user.
  let user = null;
  try {
    user = JSON.parse(userRaw);
  } catch {
    user = null;
  }

  if (!user || typeof user !== 'object' || Array.isArray(user) || typeof user.id !== 'string') {
    return { kind: 'error', message: 'The sign-in information is invalid. Please try signing in again.' };
  }

  return { kind: 'success', token, user };
}

function OAuthCallback() {
  const auth = useAuth();
  const navigate = useNavigate();
  const processedRef = useRef(false);

  const [status, setStatus] = useState('processing'); // 'processing' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  // Parse the OAuth query string exactly once at mount (lazy initializer), so a
  // later URL cleanup in the effect cannot change the captured outcome.
  const [outcome] = useState(parseOAuthQuery);

  // The OAuth setter must come from AuthContext. Support the conventional names
  // so this page works as soon as AuthContext exposes one; fall back to a clear
  // error otherwise (see OAUTH_SETTER_NAMES above).
  const oauthSetterName = OAUTH_SETTER_NAMES.find((name) => typeof auth[name] === 'function');
  const needsOAuthSetter = outcome?.kind === 'success' && !oauthSetterName;

  useEffect(() => {
    // StrictMode mounts effects twice in development; only process once.
    if (processedRef.current) return;
    processedRef.current = true;

    // Remove the OAuth query parameters from the browser URL. The app JWT in the
    // query string is short-lived, but it should not linger in the address bar.
    window.history.replaceState({}, '', window.location.pathname);

    if (outcome?.kind !== 'success' || !oauthSetterName) {
      return;
    }

    // Store the OAuth session and navigate, both synchronously in the same
    // effect run. There is no async step to cancel, so a StrictMode cleanup
    // cannot prevent navigation, and a synchronous setter error is caught below.
    try {
      auth[oauthSetterName](outcome.token, outcome.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setErrorMessage(err && err.message ? err.message : 'GitHub sign-in failed. Please try again.');
      setStatus('error');
    }
  }, [auth, navigate, outcome, oauthSetterName]);

  // Error display is derived from the parse outcome and the missing-setter case;
  // only a rejected OAuth setter call mutates state asynchronously.
  const isErrorState =
    status === 'error' || outcome?.kind === 'error' || needsOAuthSetter;

  const displayMessage =
    outcome?.kind === 'error'
      ? outcome.message
      : needsOAuthSetter
        ? 'GitHub sign-in succeeded, but this app is not configured to store the OAuth session yet. Please sign in with your email and password.'
        : errorMessage;

  return (
    <AuthShell
      title={isErrorState ? 'Sign-in issue' : 'Signing in'}
      description={
        isErrorState
          ? 'We could not complete the GitHub sign-in.'
          : 'Completing your GitHub authentication...'
      }
    >
      {isErrorState ? (
        <>
          <Alert severity="error">{displayMessage}</Alert>
          <Button
            component={RouterLink}
            to="/login"
            variant="contained"
            color="success"
            size="large"
            sx={{ mt: 1 }}
          >
            Back to login
          </Button>
        </>
      ) : (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={40} />
        </Box>
      )}
    </AuthShell>
  );
}

export default OAuthCallback;