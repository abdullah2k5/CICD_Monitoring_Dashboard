const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { syncRepos, listRepos, syncBuildRuns, listBuildRuns } = require('../controllers/repoController');

const router = express.Router();

router.post('/sync', authMiddleware, syncRepos);
router.get('/', authMiddleware, listRepos);
router.post('/:id/sync-runs', authMiddleware, syncBuildRuns);
router.get('/:id/runs', authMiddleware, listBuildRuns);

module.exports = router;
