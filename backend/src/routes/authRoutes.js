const express = require('express');
const { register, login } = require('../controllers/authController');
const { startGithubOAuth, githubOAuthCallback, githubConfigCheck } = require('../controllers/githubAuthController');

const router = express.Router();

// Public GitHub OAuth routes. No authMiddleware: the user is not authenticated
// yet either when starting OAuth or when returning from GitHub.
router.get('/github', startGithubOAuth);
router.get('/github/callback', githubOAuthCallback);

// TEMP DIAGNOSTIC route for debugging the Vercel preview callback URL.
router.get('/github/config-check', githubConfigCheck);

router.post('/register', register);
router.post('/login', login);

module.exports = router;
