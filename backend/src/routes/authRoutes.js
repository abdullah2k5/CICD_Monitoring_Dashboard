const express = require('express');
const { register, login } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const {
  startGithubOAuth,
  githubOAuthCallback,
  githubConfigCheck,
  startGithubLink,
  githubLink,
  githubLinkCallback,
} = require('../controllers/githubAuthController');

const router = express.Router();

// Public GitHub OAuth routes. No authMiddleware: the user is not authenticated
// yet either when starting OAuth or when returning from GitHub.
router.get('/github', startGithubOAuth);
router.get('/github/callback', githubOAuthCallback);

// Account linking. /github/link/start requires the application JWT and returns
// a short-lived, single-purpose link URL. The other two are public browser
// steps reached through that signed link and GitHub's redirect respectively.
router.get('/github/link/start', authMiddleware, startGithubLink);
router.get('/github/link', githubLink);
router.get('/github/link/callback', githubLinkCallback);

// TEMP DIAGNOSTIC route for debugging the Vercel preview callback URL.
router.get('/github/config-check', githubConfigCheck);

router.post('/register', register);
router.post('/login', login);

module.exports = router;
