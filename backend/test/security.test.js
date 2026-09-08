const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

process.env.JWT_SECRET = 'test-secret-for-isolated-tests';
process.env.GITHUB_WEBHOOK_SECRET = 'webhook-test-secret';
process.env.GITHUB_TOKEN = 'github-test-token';
process.env.GEMINI_API_KEY = 'gemini-test-key';

const authController = require('../src/controllers/authController');
const authMiddleware = require('../src/middleware/authMiddleware');
const repoController = require('../src/controllers/repoController');
const webhookController = require('../src/controllers/webhookController');
const User = require('../src/models/User');
const Repo = require('../src/models/Repo');
const BuildRun = require('../src/models/BuildRun');

function mockResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function signWebhook(body) {
  return `sha256=${crypto
    .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
    .update(body)
    .digest('hex')}`;
}

test('registration hashes the password and omits passwordHash from the response', async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  let savedUser;

  User.findOne = async () => null;
  User.create = async (data) => {
    savedUser = data;
    return { _id: 'user-1', ...data, createdAt: new Date() };
  };

  const response = mockResponse();
  await authController.register(
    { body: { name: 'Test User', email: 'test@example.com', password: 'password123' } },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.notEqual(savedUser.passwordHash, 'password123');
  assert.equal(response.body.user.passwordHash, undefined);

  User.findOne = originalFindOne;
  User.create = originalCreate;
});

test('login rejects invalid credentials without revealing which field failed', async () => {
  const originalFindOne = User.findOne;
  User.findOne = async () => null;

  const response = mockResponse();
  await authController.login(
    { body: { email: 'missing@example.com', password: 'password123' } },
    response
  );

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.message, 'Invalid email or password');
  User.findOne = originalFindOne;
});

test('auth middleware rejects missing and invalid JWTs', () => {
  const missing = mockResponse();
  authMiddleware({ headers: {} }, missing, () => assert.fail('next should not run'));
  assert.equal(missing.statusCode, 401);

  const invalid = mockResponse();
  authMiddleware(
    { headers: { authorization: 'Bearer invalid-token' } },
    invalid,
    () => assert.fail('next should not run')
  );
  assert.equal(invalid.statusCode, 401);
});

test('listBuildRuns rejects an invalid repository id as not found', async () => {
  const originalFindOne = Repo.findOne;
  Repo.findOne = async () => assert.fail('invalid ids should not query MongoDB');

  const response = mockResponse();
  await repoController.listBuildRuns(
    { params: { id: 'not-an-object-id' }, user: { id: 'user-1' } },
    response
  );

  assert.equal(response.statusCode, 404);
  Repo.findOne = originalFindOne;
});

test('listBuildRuns rejects a repository owned by another user', async () => {
  const originalFindOne = Repo.findOne;
  Repo.findOne = async () => null;

  const response = mockResponse();
  await repoController.listBuildRuns(
    { params: { id: '507f1f77bcf86cd799439011' }, user: { id: 'user-a' } },
    response
  );

  assert.equal(response.statusCode, 404);
  Repo.findOne = originalFindOne;
});

test('analyzeBuildRun rejects access to another user repository', async () => {
  const originalFindOne = Repo.findOne;
  Repo.findOne = async () => null;

  const response = mockResponse();
  await repoController.analyzeBuildRun(
    {
      params: { id: '507f1f77bcf86cd799439011', runId: '507f1f77bcf86cd799439012' },
      user: { id: 'user-a' },
    },
    response
  );

  assert.equal(response.statusCode, 404);
  Repo.findOne = originalFindOne;
});

test('webhook rejects missing and invalid signatures', async () => {
  const missing = mockResponse();
  await webhookController.handleGithubWebhook(
    { body: Buffer.from('{}'), headers: { 'x-github-event': 'ping' } },
    missing
  );
  assert.equal(missing.statusCode, 401);

  const invalid = mockResponse();
  await webhookController.handleGithubWebhook(
    {
      body: Buffer.from('{}'),
      headers: { 'x-github-event': 'ping', 'x-hub-signature-256': 'sha256=bad' },
    },
    invalid
  );
  assert.equal(invalid.statusCode, 401);
});

test('webhook accepts a valid ping and ignores it without database work', async () => {
  const response = mockResponse();
  await webhookController.handleGithubWebhook(
    {
      body: Buffer.from('{"zen":"test"}'),
      headers: {
        'x-github-event': 'ping',
        'x-hub-signature-256': signWebhook('{"zen":"test"}'),
      },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.message, 'Event ignored');
});

test('webhook upserts a workflow run for every tracked copy of a repository', async () => {
  const originalFind = Repo.find;
  const originalFindOneAndUpdate = BuildRun.findOneAndUpdate;
  const updates = [];
  Repo.find = async () => [{ _id: 'repo-a' }, { _id: 'repo-b' }];
  BuildRun.findOneAndUpdate = async (filter, update) => {
    updates.push({ filter, update });
    return update;
  };

  const body = JSON.stringify({
    repository: { full_name: 'owner/project' },
    workflow_run: {
      id: 123,
      name: 'CI',
      status: 'completed',
      conclusion: 'failure',
      head_branch: 'main',
      head_sha: 'abc123',
      run_started_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:01:00Z',
      html_url: 'https://github.com/owner/project/actions/runs/123',
    },
  });
  const response = mockResponse();
  await webhookController.handleGithubWebhook(
    {
      body: Buffer.from(body),
      headers: { 'x-github-event': 'workflow_run', 'x-hub-signature-256': signWebhook(body) },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(updates.length, 2);
  assert.equal(updates[0].filter.githubRunId, 123);

  Repo.find = originalFind;
  BuildRun.findOneAndUpdate = originalFindOneAndUpdate;
});

test('analyzeBuildRun stores mocked GitHub/Gemini analysis for an owned failed run', async () => {
  const originalFindOne = Repo.findOne;
  const originalBuildFindOne = BuildRun.findOne;
  const originalFetch = global.fetch;
  const saved = { aiAnalysis: null, analyzedAt: null, save: async () => {} };

  Repo.findOne = async () => ({ _id: 'repo-a', fullName: 'owner/project' });
  BuildRun.findOne = async () => ({
    _id: 'run-a',
    repo: 'repo-a',
    githubRunId: 456,
    workflowName: 'CI',
    branch: 'main',
    commitSha: 'abcdef1234567',
    conclusion: 'failure',
    ...saved,
  });
  global.fetch = async (url) => {
    if (url.includes('/jobs')) {
      return { ok: true, json: async () => ({ jobs: [{ name: 'test', conclusion: 'failure', steps: [{ name: 'Run tests', conclusion: 'failure' }] }] }) };
    }
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Check the failed test step.' }] } }] }) };
  };

  const response = mockResponse();
  await repoController.analyzeBuildRun(
    { params: { id: '507f1f77bcf86cd799439011', runId: '507f1f77bcf86cd799439012' }, user: { id: 'user-a' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.aiAnalysis, 'Check the failed test step.');

  Repo.findOne = originalFindOne;
  BuildRun.findOne = originalBuildFindOne;
  global.fetch = originalFetch;
});
