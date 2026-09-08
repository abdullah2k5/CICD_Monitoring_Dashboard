const express = require('express');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
const { syncRepos, listRepos, syncBuildRuns, listBuildRuns, analyzeBuildRun } = require('../controllers/repoController');

const router = express.Router();
const analysisLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 10,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: { message: 'Too many analysis requests. Try again later.' },
});

router.post('/sync', authMiddleware, syncRepos);
router.get('/', authMiddleware, listRepos);
router.post('/:id/sync-runs', authMiddleware, syncBuildRuns);
router.get('/:id/runs', authMiddleware, listBuildRuns);
router.post('/:id/runs/:runId/analyze', authMiddleware, analysisLimiter, analyzeBuildRun);

module.exports = router;
