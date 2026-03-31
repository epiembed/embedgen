/**
 * GitHub REST API wrapper.
 * All methods accept a `token` parameter (from getToken()) and construct
 * authenticated fetch requests to api.github.com.
 *
 * Error handling:
 *   401 → throws AuthError  (caller should trigger re-auth)
 *   404 → throws NotFoundError
 *   422 → throws ConflictError
 *   other non-ok → throws ApiError
 */

const BASE = 'https://api.github.com';

// ── Error types ───────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(message = 'GitHub authentication required.') {
    super(message);
    this.name = 'AuthError';
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Resource not found.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message = 'Conflict — file may have changed.') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ── Internal fetch helper ─────────────────────────────────────────────

async function ghFetch(token, path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (res.ok) return res;

  switch (res.status) {
    case 401: throw new AuthError();
    case 404: throw new NotFoundError();
    case 422: throw new ConflictError();
    default:  throw new ApiError(res.status, `GitHub API error: ${res.status} ${res.statusText}`);
  }
}

// ── API methods ───────────────────────────────────────────────────────

/**
 * Get the authenticated user.
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function getUser(token) {
  const res = await ghFetch(token, '/user');
  return res.json();
}

/**
 * List the authenticated user's repos, sorted by last updated.
 * Fetches up to `perPage` repos from page 1 (default 100).
 * @param {string} token
 * @param {{ perPage?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function listRepos(token, { perPage = 100 } = {}) {
  const params = new URLSearchParams({ sort: 'updated', per_page: String(perPage) });
  const res = await ghFetch(token, `/user/repos?${params}`);
  return res.json();
}

/**
 * Create a new repo for the authenticated user.
 * @param {string} token
 * @param {string} name
 * @param {string} [description]
 * @param {boolean} [isPublic]
 * @returns {Promise<object>}
 */
export async function createRepo(token, name, description = '', isPublic = true) {
  const res = await ghFetch(token, '/user/repos', {
    method: 'POST',
    body: JSON.stringify({ name, description, private: !isPublic, auto_init: true }),
  });
  return res.json();
}

/**
 * Get file contents at a path in a repo.
 * Returns null if the file does not exist (404).
 * @param {string} token
 * @param {string} owner
 * @param {string} repo
 * @param {string} path
 * @returns {Promise<object|null>}
 */
export async function getContents(token, owner, repo, path) {
  try {
    const res = await ghFetch(token, `/repos/${owner}/${repo}/contents/${path}`);
    return res.json();
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
}

/**
 * Create or update a file in a repo.
 * Content must be a base64-encoded string.
 * Pass `sha` when updating an existing file.
 * @param {string} token
 * @param {string} owner
 * @param {string} repo
 * @param {string} path
 * @param {string} content  base64-encoded file content
 * @param {string} message  commit message
 * @param {string} [sha]    blob SHA of the file being replaced (omit for create)
 * @returns {Promise<object>}
 */
export async function createOrUpdateFile(token, owner, repo, path, content, message, sha) {
  const body = { message, content };
  if (sha) body.sha = sha;
  const res = await ghFetch(token, `/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return res.json();
}
