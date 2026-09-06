const express = require('express');
const { handleGithubWebhook } = require('../controllers/webhookController');

const router = express.Router();

// express.raw keeps req.body as a Buffer so the HMAC signature can be verified
// against the exact bytes GitHub sent, before any JSON parsing happens.
router.post('/github', express.raw({ type: 'application/json' }), handleGithubWebhook);

module.exports = router;
