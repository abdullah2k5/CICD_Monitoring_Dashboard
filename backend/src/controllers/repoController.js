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

// Pulls out just the job/step names and conclusions GitHub reports for a run,
// since we intentionally never download the full log archive.
function extractFailedSteps(jobs) {
  const failedJobs = [];

  for (const job of jobs) {
    const failedSteps = (job.steps || [])
      .filter((step) => step.conclusion === 'failure')
      .map((step) => step.name);

    if (job.conclusion === 'failure' || failedSteps.length > 0) {
      failedJobs.push({ jobName: job.name, failedSteps });
    }
  }

  return failedJobs;
}

function buildAnalysisPrompt(repo, buildRun, failedJobs) {
  const failureSummary = failedJobs
    .map((job) => `- Job "${job.jobName}" failed at step(s): ${job.failedSteps.join(', ') || '(job failed, no specific step marked)'}`)
    .join('\n');

  return `You are helping a developer understand why a CI build failed.

Workflow: ${buildRun.workflowName}
Repository: ${repo.fullName}
Branch: ${buildRun.branch}
Commit: ${buildRun.commitSha.slice(0, 7)}

Failed jobs/steps (names only, no logs available):
${failureSummary || '(no specific failed step names were reported by GitHub)'}

Important: you only have the job and step names above, not the actual log output. Do not invent specific error messages or details you cannot know from this limited context. Based only on these names, explain in plain English why this build likely failed, then suggest 1-2 likely causes and 1-2 concrete next debugging steps (e.g. "check the logs for the X step").`;
}

async function analyzeBuildRun(req, res) {
  try {
    const repo = await findOwnedRepo(req.params.id, req.user.id);
    if (!repo) {
      return res.status(404).json({ message: 'Repo not found' });
    }

    const buildRun = await BuildRun.findOne({ _id: req.params.runId, repo: repo._id });
    if (!buildRun) {
      return res.status(404).json({ message: 'Build run not found' });
    }

    if (buildRun.conclusion !== 'failure') {
      return res.status(400).json({ message: 'Analysis is only available for failed runs.' });
    }

    let failedJobs;
    try {
      const jobsResponse = await fetch(
        `https://api.github.com/repos/${repo.fullName}/actions/runs/${buildRun.githubRunId}/jobs`,
        {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            'User-Agent': 'cicd-monitoring-dashboard',
          },
        }
      );

      if (!jobsResponse.ok) {
        return res.status(502).json({ message: 'Failed to fetch job details from GitHub' });
      }

      const jobsData = await jobsResponse.json();
      failedJobs = extractFailedSteps(jobsData.jobs || []);
    } catch (err) {
      console.error('GitHub jobs fetch error:', err.message);
      return res.status(502).json({ message: 'Failed to fetch job details from GitHub' });
    }

    const prompt = buildAnalysisPrompt(repo, buildRun, failedJobs);

    let analysisText;
    try {
      const geminiResponse = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': process.env.GEMINI_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );

          if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.text();
        console.error('Gemini API error:', geminiResponse.status, errorBody);
        return res.status(502).json({ message: 'Failed to get analysis from Gemini', detail: errorBody });
      }

      const geminiData = await geminiResponse.json();
      analysisText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!analysisText) {
        return res.status(502).json({ message: 'Gemini returned an empty analysis' });
      }
    } catch (err) {
      console.error('Gemini call error:', err.message);
      return res.status(502).json({ message: 'Failed to get analysis from Gemini' });
    }

    buildRun.aiAnalysis = analysisText;
    buildRun.analyzedAt = new Date();
    await buildRun.save();

    return res.json({ aiAnalysis: buildRun.aiAnalysis, analyzedAt: buildRun.analyzedAt });
  } catch (err) {
    console.error('Analyze build run error:', err.message);
    return res.status(500).json({ message: 'Failed to analyze build run' });
  }
}

module.exports = { syncRepos, listRepos, syncBuildRuns, listBuildRuns, analyzeBuildRun };
