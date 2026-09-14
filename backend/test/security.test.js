const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

process.env.JWT_SECRET = 'test-secret-for-isolated-tests';
process.env.GITHUB_WEBHOOK_SECRET = 'webhook-test-secret';
process.env.GITHUB_TOKEN = 'github-test-token';
process.env.GEMINI_API_KEY = 'gemini-test-key';
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
process.env.GITHUB_OAUTH_CALLBACK_URL = 'https://backend.test/api/auth/github/callback';
process.env.GITHUB_TOKEN_ENCRYPTION_KEY = 'test-encryption-key';
process.env.FRONTEND_URL = 'https://frontend.test';

const authController = require('../src/controllers/authController');
const authMiddleware = require('../src/middleware/authMiddleware');
const repoController = require('../src/controllers/repoController');
const webhookController = require('../src/controllers/webhookController');
const githubAuthController = require('../src/controllers/githubAuthController');
const axios = require('axios');
const jwt = require('jsonwebtoken');
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

function mockRedirectResponse() {
  const response = mockResponse();
  response.redirectUrl = undefined;
  response.clearedCookies = [];
  response.redirect = function redirect(url) {
    this.redirectUrl = url;
    return this;
  };
  response.clearCookie = function clearCookie(name) {
    this.clearedCookies.push(name);
    return this;
  };
  return response;
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
// --- GitHub account linking flow ---

test('startGithubLink returns a short-lived single-purpose link URL', async () => {
  const originalFindById = User.findById;
  User.findById = async (id) => ({ _id: id, name: 'Test User', email: 'test@example.com' });

  const response = mockResponse();
  await githubAuthController.startGithubLink(
    { user: { id: '507f1f77bcf86cd799439011' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.match(response.body.linkUrl, /^\/api\/auth\/github\/link\?token=/);

  const token = response.body.linkUrl.split('=').pop();
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  assert.equal(payload.purpose, 'github-link');
  assert.equal(payload.sub, '507f1f77bcf86cd799439011');
  assert.notEqual(token, process.env.JWT_SECRET);

  User.findById = originalFindById;
});

test('startGithubLink rejects a missing local user', async () => {
  const originalFindById = User.findById;
  User.findById = async () => null;

  const response = mockResponse();
  await githubAuthController.startGithubLink(
    { user: { id: '507f1f77bcf86cd799439011' } },
    response
  );

  assert.equal(response.statusCode, 404);
  User.findById = originalFindById;
});

test('githubLink rejects invalid and mis-purposed link tokens', async () => {
  const invalid = mockResponse();
  await githubAuthController.githubLink({ query: { token: 'not-a-token' } }, invalid);
  assert.equal(invalid.statusCode, 400);

  // A normal application JWT must never be accepted as a link token.
  const appJwt = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
  const misused = mockResponse();
  await githubAuthController.githubLink({ query: { token: appJwt } }, misused);
  assert.equal(misused.statusCode, 400);
});

test('github link state cookie binding rejects tampered user ids and signatures', () => {
  const userId = '507f1f77bcf86cd799439011';
  const cookie = githubAuthController.encodeLinkState('state-abc', userId);

  assert.ok(cookie.startsWith('link.'));

  const parsed = githubAuthController.parseLinkState(cookie);
  assert.equal(parsed.state, 'state-abc');
  assert.equal(parsed.userId, userId);
  assert.equal(parsed.signature, cookie.split('.').pop());

  // Swapping the bound user id must invalidate the binding.
  const [prefix, state, , signature] = cookie.split('.');
  const tamperedUser = [prefix, state, '507f1f77bcf86cd799439099', signature].join('.');
  assert.equal(githubAuthController.parseLinkState(tamperedUser), null);

  // Tampering with the signature must invalidate the binding.
  const [prefix2, state2, userId2] = cookie.split('.');
  const badSignature = [prefix2, state2, userId2, '0'.repeat(64)].join('.');
  assert.equal(githubAuthController.parseLinkState(badSignature), null);
});
test('githubLinkCallback attaches GitHub to the existing local user only', async () => {
  const originalFindById = User.findById;
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  const originalAxiosPost = axios.post;
  const originalFetch = global.fetch;

  const savedUser = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Local User',
    email: 'local@example.com',
    githubId: null,
    githubUsername: null,
    githubAccessTokenEncrypted: null,
    save: async () => {},
  };

  User.findById = async (id) => {
    assert.equal(id, '507f1f77bcf86cd799439011');
    return savedUser;
  };
  User.findOne = async () => null;
  User.create = async () => assert.fail('linking must not create a new User');

  axios.post = async () => ({ status: 200, data: { access_token: 'github-live-token' } });
  global.fetch = async (url) => {
    if (url.includes('/user/emails')) {
      return { ok: true, json: async () => [{ email: 'local@example.com', verified: true, primary: true }] };
    }
    return { ok: true, json: async () => ({ id: 12345, login: 'octocat', name: 'Octo Cat' }) };
  };

  const state = 'state-xyz';
  const cookie = githubAuthController.encodeLinkState(state, '507f1f77bcf86cd799439011');
  const response = mockRedirectResponse();
  await githubAuthController.githubLinkCallback(
    { query: { code: 'auth-code', state }, headers: { cookie: `github_oauth_state=${cookie}` } },
    response
  );

  const redirectUrl = new URL(response.redirectUrl);
  assert.equal(redirectUrl.pathname, '/oauth/callback');
  assert.equal(redirectUrl.searchParams.get('github'), 'linked');
  assert.equal(redirectUrl.searchParams.get('username'), 'octocat');
  assert.equal(redirectUrl.searchParams.has('token'), false);

  assert.equal(savedUser.githubId, '12345');
  assert.equal(savedUser.githubUsername, 'octocat');
  assert.match(savedUser.githubAccessTokenEncrypted, /^[^.]+[.][^.]+[.][^.]+$/);
  assert.notEqual(savedUser.githubAccessTokenEncrypted, 'github-live-token');
  assert.ok(!JSON.stringify(response).includes('github-live-token'));

  User.findById = originalFindById;
  User.findOne = originalFindOne;
  User.create = originalCreate;
  axios.post = originalAxiosPost;
  global.fetch = originalFetch;
});

test('githubLinkCallback rejects a GitHub account bound to another user', async () => {
  const originalFindById = User.findById;
  const originalFindOne = User.findOne;
  const originalAxiosPost = axios.post;
  const originalFetch = global.fetch;

  const savedUser = {
    _id: '507f1f77bcf86cd799439011',
    githubId: null,
    save: async () => assert.fail('conflict must not save'),
  };

  User.findById = async () => savedUser;
  User.findOne = async (filter) =>
    filter.githubId === '12345' ? { _id: '507f1f77bcf86cd799439099' } : null;
  axios.post = async () => ({ status: 200, data: { access_token: 'github-live-token' } });
  global.fetch = async (url) => {
    if (url.includes('/user/emails')) {
      return { ok: true, json: async () => [{ email: 'local@example.com', verified: true, primary: true }] };
    }
    return { ok: true, json: async () => ({ id: 12345, login: 'octocat' }) };
  };

  const state = 'state-xyz';
  const cookie = githubAuthController.encodeLinkState(state, '507f1f77bcf86cd799439011');
  const response = mockRedirectResponse();
  await githubAuthController.githubLinkCallback(
    { query: { code: 'auth-code', state }, headers: { cookie: `github_oauth_state=${cookie}` } },
    response
  );

  const redirectUrl = new URL(response.redirectUrl);
  assert.equal(redirectUrl.searchParams.get('error'), 'github_link_conflict');
  assert.match(redirectUrl.searchParams.get('message'), /already connected to another account/);

  User.findById = originalFindById;
  User.findOne = originalFindOne;
  axios.post = originalAxiosPost;
  global.fetch = originalFetch;
});
test('githubLinkCallback rejects silently replacing an already-linked GitHub account', async () => {
  const originalFindById = User.findById;
  const originalFindOne = User.findOne;
  const originalAxiosPost = axios.post;
  const originalFetch = global.fetch;

  const savedUser = {
    _id: '507f1f77bcf86cd799439011',
    githubId: '99999',
    save: async () => assert.fail('conflict must not save'),
  };

  User.findById = async () => savedUser;
  User.findOne = async () => null;
  axios.post = async () => ({ status: 200, data: { access_token: 'github-live-token' } });
  global.fetch = async (url) => {
    if (url.includes('/user/emails')) {
      return { ok: true, json: async () => [{ email: 'local@example.com', verified: true, primary: true }] };
    }
    return { ok: true, json: async () => ({ id: 12345, login: 'octocat' }) };
  };

  const state = 'state-xyz';
  const cookie = githubAuthController.encodeLinkState(state, '507f1f77bcf86cd799439011');
  const response = mockRedirectResponse();
  await githubAuthController.githubLinkCallback(
    { query: { code: 'auth-code', state }, headers: { cookie: `github_oauth_state=${cookie}` } },
    response
  );

  const redirectUrl = new URL(response.redirectUrl);
  assert.equal(redirectUrl.searchParams.get('error'), 'github_link_conflict');
  assert.match(redirectUrl.searchParams.get('message'), /Another GitHub account is already connected/);

  User.findById = originalFindById;
  User.findOne = originalFindOne;
  axios.post = originalAxiosPost;
  global.fetch = originalFetch;
});

test('githubLinkCallback requires a verified GitHub email', async () => {
  const originalFindById = User.findById;
  const originalAxiosPost = axios.post;
  const originalFetch = global.fetch;

  User.findById = async () => ({ _id: '507f1f77bcf86cd799439011', githubId: null });
  axios.post = async () => ({ status: 200, data: { access_token: 'github-live-token' } });
  global.fetch = async (url) => {
    if (url.includes('/user/emails')) {
      return { ok: true, json: async () => [{ email: 'local@example.com', verified: false, primary: true }] };
    }
    return { ok: true, json: async () => ({ id: 12345, login: 'octocat' }) };
  };

  const state = 'state-xyz';
  const cookie = githubAuthController.encodeLinkState(state, '507f1f77bcf86cd799439011');
  const response = mockRedirectResponse();
  await githubAuthController.githubLinkCallback(
    { query: { code: 'auth-code', state }, headers: { cookie: `github_oauth_state=${cookie}` } },
    response
  );

  const redirectUrl = new URL(response.redirectUrl);
  assert.equal(redirectUrl.searchParams.get('error'), 'github_link_failed');
  assert.match(redirectUrl.searchParams.get('message'), /no verified email/);

  User.findById = originalFindById;
  axios.post = originalAxiosPost;
  global.fetch = originalFetch;
});

test('githubLinkCallback rejects a tampered linking cookie before any user lookup', async () => {
  const originalFindById = User.findById;
  const originalAxiosPost = axios.post;
  User.findById = async () => assert.fail('tampered cookie must not load a user');
  axios.post = async () => assert.fail('tampered cookie must not exchange a code');

  const state = 'state-xyz';
  const parts = githubAuthController
    .encodeLinkState(state, '507f1f77bcf86cd799439011')
    .split('.');
  const tampered = [parts[0], parts[1], parts[2], '0'.repeat(64)].join('.');

  const response = mockRedirectResponse();
  await githubAuthController.githubLinkCallback(
    { query: { code: 'auth-code', state }, headers: { cookie: `github_oauth_state=${tampered}` } },
    response
  );

  assert.match(response.redirectUrl, /error=github_link_failed/);

  User.findById = originalFindById;
  axios.post = originalAxiosPost;
});
