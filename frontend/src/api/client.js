const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Adds auth + JSON headers, and throws a descriptive error for any non-2xx response.
async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export function syncRepos(token) {
  return request('/api/repos/sync', { method: 'POST', token });
}

export function listRepos(token) {
  return request('/api/repos', { method: 'GET', token });
}

export function syncBuildRuns(token, repoId) {
  return request(`/api/repos/${repoId}/sync-runs`, { method: 'POST', token });
}

export function listBuildRuns(token, repoId) {
  return request(`/api/repos/${repoId}/runs`, { method: 'GET', token });
}

export function analyzeBuildRun(token, repoId, runId) {
  return request(`/api/repos/${repoId}/runs/${runId}/analyze`, { method: 'POST', token });
}
