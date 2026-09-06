const crypto = require('crypto');
const Repo = require('../models/Repo');
const BuildRun = require('../models/BuildRun');

// Recomputes the HMAC over the raw body and compares it to GitHub's signature header.
function isValidSignature(rawBody, signatureHeader) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expectedDigest = crypto
    .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const expected = Buffer.from(`sha256=${expectedDigest}`);
  const received = Buffer.from(signatureHeader);

  // Buffers must be equal length for timingSafeEqual, or it throws.
  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
}

async function handleGithubWebhook(req, res) {
  const signature = req.headers['x-hub-signature-256'];

  if (!isValidSignature(req.body, signature)) {
    return res.status(401).json({ message: 'Invalid signature' });
  }

  const event = req.headers['x-github-event'];

  if (event !== 'workflow_run') {
    return res.status(200).json({ message: 'Event ignored' });
  }

  try {
    const payload = JSON.parse(req.body);
    const { repository, workflow_run: run } = payload;

    const repo = await Repo.findOne({ fullName: repository.full_name });
    if (!repo) {
      return res.status(200).json({ message: 'Repo not tracked' });
    }

    await BuildRun.findOneAndUpdate(
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

    return res.status(200).json({ message: 'Build run recorded' });
  } catch (err) {
    console.error('Webhook processing error:', err.message);
    return res.status(500).json({ message: 'Failed to process webhook' });
  }
}

module.exports = { handleGithubWebhook };
