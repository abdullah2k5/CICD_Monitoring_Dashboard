const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const STATE_COOKIE_NAME = 'github_oauth_state';
const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
const TOKEN_EXPIRY = '1h';
const GITHUB_APP = 'cicd-monitoring-dashboard';

// Reads cookies without relying on extra middleware (no cookie-parser in this project).
function readCookies(req) {
  const cookies = {};
  const cookieHeader = req.headers.cookie || '';
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const name = part.substring(0, separator).trim();
    const rawValue = part.substring(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
  }
  return cookies;
}

function stateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: STATE_MAX_AGE_MS,
    path: '/',
  };
}

function clearStateCookie(res) {
  res.clearCookie(STATE_COOKIE_NAME, { path: '/', sameSite: 'lax' });
}

// Constant-time comparison so OAuth state cannot be leaked via timing differences.
function timingSafeEqualStrings(a, b) {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

// Derives a fixed 32-byte AES-256 key from the configured secret.
function deriveEncryptionKey() {
  const secret = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret).digest();
}

// AES-256-GCM encrypt. IV + auth tag + ciphertext are stored together in one
// reversible encoded string so decryptToken can restore the plaintext later.
function encryptToken(plaintext) {
  const key = deriveEncryptionKey();
  if (!key) throw new Error('GitHub token encryption is not configured');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((part) => part.toString('base64')).join('.');
}

// Reverses encryptToken output. Kept internal for now; never serialized to the client.
function decryptToken(payload) {
  const key = deriveEncryptionKey();
  if (!key) throw new Error('GitHub token encryption is not configured');
  const [ivBase64, tagBase64, ciphertextBase64] = String(payload).split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivBase64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextBase64, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

// Exchanges the authorization code for a GitHub access token, server-to-server.
async function exchangeCodeForToken(code) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_OAUTH_CALLBACK_URL;
  if (!clientId || !clientSecret || !redirectUri) {
    const err = new Error('GitHub OAuth is not configured');
    err.isGitHubConfigError = true;
    throw err;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  let response;
  try {
    response = await axios.post('https://github.com/login/oauth/access_token', body.toString(), {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // Keep the existing manual HTTP-status validation below instead of letting
      // axios reject on non-2xx (which would be mislabeled as a network error).
      validateStatus: () => true,
    });
  } catch (err) {
    // TEMP DIAGNOSTIC: surface which network call failed. Never include the
    // client secret, code, or any headers here.
    throw new Error(`GitHub token exchange network error: ${err.message}`);
  }

  const data = response.data || {};

  if (response.status < 200 || response.status >= 300 || !data.access_token) {
    // Never include the client secret or `code` in the error surfaced to clients.
    throw new Error('GitHub token exchange failed');
  }
  return data.access_token;
}

async function fetchGitHubJson(url, accessToken) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': GITHUB_APP,
        Accept: 'application/vnd.github+json',
      },
    });
  } catch (err) {
    // TEMP DIAGNOSTIC: surface which external GitHub API call failed. Only the
    // hostname and the original error message are included; never tokens or headers.
    const hostname = new URL(url).hostname;
    throw new Error(`GitHub API network error for ${hostname}: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error('GitHub API request failed');
  }
  return response.json();
}

// Prefers the primary verified email; falls back to the first verified email.
function pickVerifiedEmail(emails) {
  if (!Array.isArray(emails)) return null;
  const verified = emails.filter(
    (entry) => entry && typeof entry.email === 'string' && entry.verified === true
  );
  if (verified.length === 0) return null;
  const primary = verified.find((entry) => entry.primary === true);
  return (primary || verified[0]).email.trim().toLowerCase();
}

function toSafeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function redirectToFrontend(res, frontendUrl) {
  const target = new URL('/oauth/callback', frontendUrl);
  target.searchParams.set('error', 'oauth_failed');
  target.searchParams.set('message', 'GitHub authentication failed. Please try again.');
  return res.redirect(target.toString());
}

function redirectOAuthError(res, frontendUrl, error, message) {
  const target = new URL('/oauth/callback', frontendUrl);
  target.searchParams.set('error', error);
  target.searchParams.set('message', message);
  return res.redirect(target.toString());
}

function redirectOAuthSuccess(res, frontendUrl, token, user) {
  const target = new URL('/oauth/callback', frontendUrl);
  // Only the short-lived app JWT and safe user data go in the URL. No GitHub token.
  target.searchParams.set('token', token);
  target.searchParams.set('user', JSON.stringify(toSafeUser(user)));
  return res.redirect(target.toString());
}

async function startGithubOAuth(req, res) {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_OAUTH_CALLBACK_URL;
    if (!clientId || !redirectUri) {
      return res.status(500).json({ message: 'GitHub OAuth is not configured' });
    }

    // Cryptographically secure, random per-request state; never static.
    const state = crypto.randomBytes(32).toString('hex');
    res.cookie(STATE_COOKIE_NAME, state, stateCookieOptions());

    const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('scope', 'user:email repo');
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('prompt', 'select_account');

    // The client secret is never included in the authorize URL.
    return res.redirect(authorizeUrl.toString());
  } catch (err) {
    console.error('GitHub OAuth start error:', err.message);
    return res.status(500).json({ message: 'Failed to start GitHub OAuth' });
  }
}

async function githubOAuthCallback(req, res) {
  // TEMP DIAGNOSTIC
  console.log('OAuth callback started');
  try {
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      return res.status(500).json({ message: 'GitHub OAuth is not configured' });
    }

    const { code, state } = req.query;

    if (typeof code !== 'string' || code.length === 0) {
      return res.status(400).json({ message: 'Missing authorization code' });
    }

    // Validate the OAuth state stored in the HTTP-only cookie.
    const storedState = readCookies(req)[STATE_COOKIE_NAME];
    if (
      typeof state !== 'string' ||
      state.length === 0 ||
      typeof storedState !== 'string' ||
      !timingSafeEqualStrings(state, storedState)
    ) {
      clearStateCookie(res);
      return redirectOAuthError(
        res,
        frontendUrl,
        'invalid_state',
        'GitHub OAuth state is invalid or expired. Please try again.'
      );
    }
    clearStateCookie(res);

    // Exchange the authorization code for a GitHub access token.
    // TEMP DIAGNOSTIC
    console.log('Starting GitHub token exchange');
    const accessToken = await exchangeCodeForToken(code);
    // TEMP DIAGNOSTIC
    console.log('GitHub token exchange completed');

    // TEMP DIAGNOSTIC: sequential awaits so the stage logs below are exact.
    // TEMP DIAGNOSTIC
    console.log('Fetching GitHub user');
    const githubUser = await fetchGitHubJson('https://api.github.com/user', accessToken);
    // TEMP DIAGNOSTIC
    console.log('GitHub user fetched');

    // TEMP DIAGNOSTIC
    console.log('Fetching GitHub emails');
    const githubEmails = await fetchGitHubJson('https://api.github.com/user/emails', accessToken);
    // TEMP DIAGNOSTIC
    console.log('GitHub emails fetched');

    // Only verified GitHub emails are trusted.
    const email = pickVerifiedEmail(githubEmails);
    if (!email) {
      return redirectOAuthError(
        res,
        frontendUrl,
        'no_verified_email',
        'Your GitHub account has no verified email. Verify an email on GitHub and try again.'
      );
    }

    const encryptedToken = encryptToken(accessToken);
    const githubId = String(githubUser.id);

    // TEMP DIAGNOSTIC
    console.log('Looking up local user');
    let user = await User.findOne({ githubId });

    if (!user) {
      // Do not auto-link a fresh GitHub identity to an existing email/password account.
      const existingByEmail = await User.findOne({ email });
      if (existingByEmail) {
        return redirectOAuthError(
          res,
          frontendUrl,
          'account_conflict',
          'An account with this email already exists. Sign in locally and link your GitHub account to continue.'
        );
      }

      user = new User({
        name: githubUser.name || githubUser.login,
        email,
        githubId,
        githubUsername: githubUser.login,
        githubAccessTokenEncrypted: encryptedToken,
      });
    } else {
      // Refresh the handle and rotate the encrypted token for the existing OAuth user.
      user.githubUsername = githubUser.login;
      user.githubAccessTokenEncrypted = encryptedToken;
    }

    await user.save();

    // TEMP DIAGNOSTIC
    console.log('Local user ready');

    // Issue the app's existing JWT so the GitHub login uses the same auth channel.
    // TEMP DIAGNOSTIC
    console.log('Signing application JWT');
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: TOKEN_EXPIRY,
    });

    // TEMP DIAGNOSTIC
    console.log('Redirecting to frontend');
    return redirectOAuthSuccess(res, frontendUrl, token, user);
  } catch (err) {
    // Safe diagnostic only: never log the GitHub access token, client secret, or encryption key.
    console.error('GitHub OAuth callback error:', err.message);

    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      return res.status(500).json({ message: 'GitHub OAuth is not configured' });
    }
    return redirectToFrontend(res, frontendUrl);
  }
}

// TEMP DIAGNOSTIC: reports whether GitHub OAuth callback env is configured to
// match the Vercel preview callback. Returns booleans only; never the value.
async function githubConfigCheck(req, res) {
  const expectedPreviewCallback =
    'https://cicd-backend-kcfryjiml-project-edb6.vercel.app/api/auth/github/callback';
  const callbackUrl = process.env.GITHUB_OAUTH_CALLBACK_URL;

  return res.json({
    configured: Boolean(callbackUrl),
    matchesExpectedPreviewCallback: callbackUrl === expectedPreviewCallback,
  });
}

module.exports = { startGithubOAuth, githubOAuthCallback, githubConfigCheck };