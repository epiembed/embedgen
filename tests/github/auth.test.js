// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateState,
  initiateLogin,
  handleCallback,
  getToken,
  logout,
} from '../../src/github/auth.js';

// ── generateState ─────────────────────────────────────────────────────

describe('generateState', () => {
  it('returns a non-empty string', () => {
    expect(generateState().length).toBeGreaterThan(0);
  });

  it('returns different values each call', () => {
    expect(generateState()).not.toBe(generateState());
  });

  it('contains only base64url characters', () => {
    expect(generateState()).toMatch(/^[A-Za-z0-9\-_]+$/);
  });
});

// ── initiateLogin ─────────────────────────────────────────────────────

describe('initiateLogin', () => {
  let capturedHref;

  beforeEach(() => {
    sessionStorage.clear();
    capturedHref = null;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        href: '',
        search: '',
        set href(v) { capturedHref = v; },
        get href() { return capturedHref ?? ''; },
      },
    });
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('stores state in sessionStorage', async () => {
    await initiateLogin('client123', 'https://example.com/callback');
    expect(sessionStorage.getItem('gh_oauth_state')).toBeTruthy();
  });

  it('redirects to GitHub authorize endpoint', async () => {
    await initiateLogin('client123', 'https://example.com/callback');
    expect(capturedHref).toContain('github.com/login/oauth/authorize');
  });

  it('includes required OAuth params in redirect URL', async () => {
    await initiateLogin('my-client', 'https://app.example.com/cb');
    const url = new URL(capturedHref);
    expect(url.searchParams.get('client_id')).toBe('my-client');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/cb');
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  it('does not include PKCE parameters', async () => {
    await initiateLogin('my-client', 'https://app.example.com/cb');
    const url = new URL(capturedHref);
    expect(url.searchParams.get('code_challenge')).toBeNull();
    expect(url.searchParams.get('code_challenge_method')).toBeNull();
  });
});

// ── handleCallback ────────────────────────────────────────────────────

describe('handleCallback', () => {
  const WORKER_URL = 'https://worker.example.com/token';
  const CLIENT_ID  = 'test-client-id';

  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        href: 'https://app.example.com/?code=abc123&state=mystate',
        search: '?code=abc123&state=mystate',
        assign: vi.fn(),
      },
    });
    window.history.replaceState = vi.fn();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns null when no code/state params', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'https://app.example.com/', search: '' },
    });
    const result = await handleCallback(WORKER_URL, CLIENT_ID);
    expect(result).toBeNull();
  });

  it('throws on state mismatch', async () => {
    sessionStorage.setItem('gh_oauth_state', 'different-state');
    await expect(handleCallback(WORKER_URL, CLIENT_ID)).rejects.toThrow('state mismatch');
  });

  it('exchanges code via POST to workerUrl', async () => {
    sessionStorage.setItem('gh_oauth_state', 'mystate');
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'ghp_token' }),
    });

    await handleCallback(WORKER_URL, CLIENT_ID);

    expect(fetch).toHaveBeenCalledWith(
      WORKER_URL,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ code: 'abc123', client_id: 'test-client-id' }),
      }),
    );
  });

  it('stores token in sessionStorage on success', async () => {
    sessionStorage.setItem('gh_oauth_state', 'mystate');
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'ghp_token' }),
    });

    const token = await handleCallback(WORKER_URL, CLIENT_ID);
    expect(token).toBe('ghp_token');
    expect(sessionStorage.getItem('gh_access_token')).toBe('ghp_token');
  });

  it('throws when worker returns non-ok response', async () => {
    sessionStorage.setItem('gh_oauth_state', 'mystate');
    fetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });
    await expect(handleCallback(WORKER_URL, CLIENT_ID)).rejects.toThrow('Token exchange failed');
  });
});

// ── getToken / logout ─────────────────────────────────────────────────

describe('getToken', () => {
  afterEach(() => sessionStorage.clear());

  it('returns null when no token stored', () => {
    expect(getToken()).toBeNull();
  });

  it('returns the stored token', () => {
    sessionStorage.setItem('gh_access_token', 'ghp_abc');
    expect(getToken()).toBe('ghp_abc');
  });
});

describe('logout', () => {
  afterEach(() => sessionStorage.clear());

  it('clears token and state from sessionStorage', () => {
    sessionStorage.setItem('gh_access_token', 'tok');
    sessionStorage.setItem('gh_oauth_state',  'st');
    logout();
    expect(sessionStorage.getItem('gh_access_token')).toBeNull();
    expect(sessionStorage.getItem('gh_oauth_state')).toBeNull();
  });
});
