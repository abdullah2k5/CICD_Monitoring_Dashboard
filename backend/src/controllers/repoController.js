const Repo = require('../models/Repo');
const BuildRun = require('../models/BuildRun');

async function syncRepos(req, res) {
  try {
    const response = await fetch('https://api.github.com/user/repos', {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'cicd-monitoring-dashboard',
      },
    });

    if (!response.ok) {
      return res.status(502).json({ message: 'Failed to fetch repos from GitHub' });
    }

    const githubRepos = await response.json();

    const savedRepos = [];
    for (const repo of githubRepos) {
      const saved = await Repo.findOneAndUpdate(
        { owner: req.user.id, githubRepoId: repo.id },
        {
          owner: req.user.id,
          githubRepoId: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          htmlUrl: repo.html_url,
          defaultBranch: repo.default_branch,
          private: repo.private,
        },
        { upsert: true, returnDocument: 'after' }
      );
      savedRepos.push(saved);
    }

    return res.json(savedRepos);
  } catch (err) {
    console.error('Sync repos error:', err.message);
    return res.status(500).json({ message: 'Failed to sync repos' });
  }
}

async function listRepos(req, res) {
  try {
    const repos = await Repo.find({ owner: req.user.id });
    return res.json(repos);
  } catch (err) {
    console.error('List repos error:', err.message);
    return res.status(500).json({ message: 'Failed to list repos' });
  }
}

// Verifies the repo exists and belongs to the requesting user before any build-run access.
async function findOwnedRepo(repoId, ownerId) {
  return Repo.findOne({ _id: repoId, owner: ownerId });
}

async function syncBuildRuns(req, res) {
  try {
    const repo = await findOwnedRepo(req.params.id, req.user.id);
    if (!repo) {
      return res.status(404).json({ message: 'Repo not found' });
    }

    const response = await fetch(
      `https://api.github.com/repos/${repo.fullName}/actions/runs`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          'User-Agent': 'cicd-monitoring-dashboard',
        },
      }
    );

    if (!response.ok) {
      return res.status(502).json({ message: 'Failed to fetch workflow runs from GitHub' });
    }

    const data = await response.json();
    const githubRuns = data.workflow_runs || [];

    const savedRuns = [];
    for (const run of githubRuns) {
      const saved = await BuildRun.findOneAndUpdate(
        { repo: repo._id, githubRunId: run.id },
        {
          repo: repo._id,
          githubRunId: run.id,
          workflowName: run.name,
          status: run.status,
          conclusion: run.conclusion,
          branch: run.head_branch,
          commitSha: run.head_sha,
          startedAt: run.run_started_at,
          completedAt: run.updated_at,
          htmlUrl: run.html_url,
        },
        { upsert: true, returnDocument: 'after' }
      );
      savedRuns.push(saved);
    }

    return res.json(savedRuns);
  } catch (err) {
    console.error('Sync build runs error:', err.message);
    return res.status(500).json({ message: 'Failed to sync build runs' });
  }
}

async function listBuildRuns(req, res) {
  try {
    const repo = await findOwnedRepo(req.params.id, req.user.id);
    if (!repo) {
      return res.status(404).json({ message: 'Repo not found' });
    }

    const runs = await BuildRun.find({ repo: repo._id }).sort({ startedAt: -1 });
    return res.json(runs);
  } catch (err) {
    console.error('List build runs error:', err.message);
    return res.status(500).json({ message: 'Failed to list build runs' });
  }
}

module.exports = { syncRepos, listRepos, syncBuildRuns, listBuildRuns };
