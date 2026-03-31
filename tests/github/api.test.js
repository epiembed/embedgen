// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getUser,
  listRepos,
  createRepo,
  getContents,
  createOrUpdateFile,
  AuthError,
  ConflictError,
  ApiError,
} from '../../src/github/api.js';

const TOKEN = 'ghp_test_token';

function mockFetch(status, body) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  });
}

beforeEach(() => { vi.stubGlobal('fetch', mockFetch(200, {})); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

// ── getUser ───────────────────────────────────────────────────────────

describe('getUser', () => {
  it('calls GET /user with auth header', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { login: 'alice' }));
    const user = await getUser(TOKEN);
    expect(user.login).toBe('alice');
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain('/user');
    expect(opts.headers['Authorization']).toBe(`Bearer ${TOKEN}`);
  });

  it('throws AuthError on 401', async () => {
    vi.stubGlobal('fetch', mockFetch(401, {}));
    await expect(getUser(TOKEN)).rejects.toBeInstanceOf(AuthError);
  });
});

// ── listRepos ─────────────────────────────────────────────────────────

describe('listRepos', () => {
  it('calls GET /user/repos with sort=updated', async () => {
    vi.stubGlobal('fetch', mockFetch(200, []));
    await listRepos(TOKEN);
    const [url] = fetch.mock.calls[0];
    expect(url).toContain('/user/repos');
    expect(url).toContain('sort=updated');
  });

  it('uses perPage option', async () => {
    vi.stubGlobal('fetch', mockFetch(200, []));
    await listRepos(TOKEN, { perPage: 30 });
    const [url] = fetch.mock.calls[0];
    expect(url).toContain('per_page=30');
  });

  it('throws AuthError on 401', async () => {
    vi.stubGlobal('fetch', mockFetch(401, {}));
    await expect(listRepos(TOKEN)).rejects.toBeInstanceOf(AuthError);
  });
});

// ── createRepo ────────────────────────────────────────────────────────

describe('createRepo', () => {
  it('calls POST /user/repos', async () => {
    vi.stubGlobal('fetch', mockFetch(201, { name: 'my-repo' }));
    await createRepo(TOKEN, 'my-repo', 'desc', true);
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain('/user/repos');
    expect(opts.method).toBe('POST');
  });

  it('sends name and private flag in body', async () => {
    vi.stubGlobal('fetch', mockFetch(201, {}));
    await createRepo(TOKEN, 'my-repo', 'a description', false);
    const [, opts] = fetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.name).toBe('my-repo');
    expect(body.private).toBe(true);
    expect(body.description).toBe('a description');
  });

  it('throws AuthError on 401', async () => {
    vi.stubGlobal('fetch', mockFetch(401, {}));
    await expect(createRepo(TOKEN, 'r')).rejects.toBeInstanceOf(AuthError);
  });
});

// ── getContents ───────────────────────────────────────────────────────

describe('getContents', () => {
  it('calls GET /repos/{owner}/{repo}/contents/{path}', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { sha: 'abc' }));
    const result = await getContents(TOKEN, 'alice', 'repo', 'file.txt');
    expect(result.sha).toBe('abc');
    const [url] = fetch.mock.calls[0];
    expect(url).toContain('/repos/alice/repo/contents/file.txt');
  });

  it('returns null on 404', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {}));
    const result = await getContents(TOKEN, 'alice', 'repo', 'missing.txt');
    expect(result).toBeNull();
  });

  it('throws AuthError on 401', async () => {
    vi.stubGlobal('fetch', mockFetch(401, {}));
    await expect(getContents(TOKEN, 'a', 'r', 'f')).rejects.toBeInstanceOf(AuthError);
  });
});

// ── createOrUpdateFile ────────────────────────────────────────────────

describe('createOrUpdateFile', () => {
  it('calls PUT /repos/{owner}/{repo}/contents/{path}', async () => {
    vi.stubGlobal('fetch', mockFetch(201, {}));
    await createOrUpdateFile(TOKEN, 'alice', 'repo', 'data/file.tsv', 'Y29udGVudA==', 'add file');
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain('/repos/alice/repo/contents/data/file.tsv');
    expect(opts.method).toBe('PUT');
  });

  it('includes content and message in body', async () => {
    vi.stubGlobal('fetch', mockFetch(201, {}));
    await createOrUpdateFile(TOKEN, 'a', 'r', 'f', 'Y29udGVudA==', 'my commit');
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.content).toBe('Y29udGVudA==');
    expect(body.message).toBe('my commit');
  });

  it('includes sha in body when updating', async () => {
    vi.stubGlobal('fetch', mockFetch(200, {}));
    await createOrUpdateFile(TOKEN, 'a', 'r', 'f', 'Y29udGVudA==', 'update', 'sha123');
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.sha).toBe('sha123');
  });

  it('omits sha in body when creating', async () => {
    vi.stubGlobal('fetch', mockFetch(201, {}));
    await createOrUpdateFile(TOKEN, 'a', 'r', 'f', 'Y29udGVudA==', 'create');
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).not.toHaveProperty('sha');
  });

  it('throws ConflictError on 422', async () => {
    vi.stubGlobal('fetch', mockFetch(422, {}));
    await expect(createOrUpdateFile(TOKEN, 'a', 'r', 'f', 'c', 'm')).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws AuthError on 401', async () => {
    vi.stubGlobal('fetch', mockFetch(401, {}));
    await expect(createOrUpdateFile(TOKEN, 'a', 'r', 'f', 'c', 'm')).rejects.toBeInstanceOf(AuthError);
  });

  it('throws ApiError on other errors', async () => {
    vi.stubGlobal('fetch', mockFetch(500, {}));
    await expect(createOrUpdateFile(TOKEN, 'a', 'r', 'f', 'c', 'm')).rejects.toBeInstanceOf(ApiError);
  });
});
