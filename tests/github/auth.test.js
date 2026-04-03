// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateState,
  generateCodeVerifier,
  computeCodeChallenge,
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

// ── generateCodeVerifier ──────────────────────────────────────────────

describe('generateCodeVerifier', () => {
  it('returns a 64-character string', () => {
    expect(generateCodeVerifier()).toHaveLength(64);
  });

  it('contains only base64url characters', () => {
    expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('returns different values each call', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });
});

// ── computeCodeChallenge ──────────────────────────────────────────────

describe('computeCodeChallenge', () => {
  it('returns a non-empty base64url string', async () => {
    const challenge = await computeCodeChallenge('test_verifier');
    expect(challenge.length).toBeGreaterThan(0);
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('returns a consistent hash for the same input', async () => {
    const a = await computeCodeChallenge('hello');
    const b = await computeCodeChallenge('hello');
    expect(a).toBe(b);
  });

  it('returns different hashes for different inputs', async () => {
    const a = await computeCodeChallenge('input_a');
    const b = await computeCodeChallenge('input_b');
    expect(a).not.toBe(b);
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

  it('stores state and code verifier in sessionStorage', async () => {
    await initiateLogin();
    expect(sessionStorage.getItem('oauth_state')).toBeTruthy();
    expect(sessionStorage.getItem('oauth_code_verifier')).toBeTruthy();
  });

  it('redirects to GitHub authorize endpoint', async () => {
    await initiateLogin();
    expect(capturedHref).toContain('github.com/login/oauth/authorize');
  });

  it('includes PKCE parameters in redirect URL', async () => {
    await initiateLogin();
    const url = new URL(capturedHref);
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('includes client_id, redirect_uri, scope, and state', async () => {
    await initiateLogin();
    const url = new URL(capturedHref);
    expect(url.searchParams.get('client_id')).toBe('Ov23li8SzBtP3dGD2O5y');
    expect(url.searchParams.get('redirect_uri')).toBe('https://epiembed.github.io/embedgen/');
    expect(url.searchParams.get('scope')).toBe('repo');
    expect(url.searchParams.get('state')).toBeTruthy();
  });
});

// ── handleCallback ────────────────────────────────────────────────────

describe('handleCallback', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        href: 'https://epiembed.github.io/embedgen/?code=abc123&state=mystate',
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
      value: { href: 'https://epiembed.github.io/embedgen/', search: '' },
    });
    const result = await handleCallback();
    expect(result).toBeNull();
  });

  it('throws on state mismatch', async () => {
    sessionStorage.setItem('oauth_state', 'different-state');
    sessionStorage.setItem('oauth_code_verifier', 'verifier123');
    await expect(handleCallback()).rejects.toThrow('state mismatch');
  });

  it('throws when code verifier is missing', async () => {
    sessionStorage.setItem('oauth_state', 'mystate');
    await expect(handleCallback()).rejects.toThrow('Code verifier not found');
  });

  it('sends code, client_id, code_verifier, and redirect_uri to worker', async () => {
    sessionStorage.setItem('oauth_state', 'mystate');
    sessionStorage.setItem('oauth_code_verifier', 'test_verifier');
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'ghp_token' }),
    });

    await handleCallback();

    expect(fetch).toHaveBeenCalledWith(
      'https://github-oauth-proxy.jeyabbalas.workers.dev/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          code: 'abc123',
          client_id: 'Ov23li8SzBtP3dGD2O5y',
          code_verifier: 'test_verifier',
          redirect_uri: 'https://epiembed.github.io/embedgen/',
        }),
      }),
    );
  });

  it('stores token in sessionStorage on success', async () => {
    sessionStorage.setItem('oauth_state', 'mystate');
    sessionStorage.setItem('oauth_code_verifier', 'test_verifier');
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'ghp_token' }),
    });

    const token = await handleCallback();
    expect(token).toBe('ghp_token');
    expect(sessionStorage.getItem('github_access_token')).toBe('ghp_token');
  });

  it('cleans up verifier and state from sessionStorage after exchange', async () => {
    sessionStorage.setItem('oauth_state', 'mystate');
    sessionStorage.setItem('oauth_code_verifier', 'test_verifier');
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'ghp_token' }),
    });

    await handleCallback();
    expect(sessionStorage.getItem('oauth_state')).toBeNull();
    expect(sessionStorage.getItem('oauth_code_verifier')).toBeNull();
  });

  it('throws when worker returns non-ok response', async () => {
    sessionStorage.setItem('oauth_state', 'mystate');
    sessionStorage.setItem('oauth_code_verifier', 'test_verifier');
    fetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });
    await expect(handleCallback()).rejects.toThrow('Token exchange failed');
  });

  it('throws when worker returns an error payload', async () => {
    sessionStorage.setItem('oauth_state', 'mystate');
    sessionStorage.setItem('oauth_code_verifier', 'test_verifier');
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ error: 'bad_verification_code', error_description: 'The code has expired' }),
    });
    await expect(handleCallback()).rejects.toThrow('The code has expired');
  });
});

// ── getToken / logout ─────────────────────────────────────────────────

describe('getToken', () => {
  afterEach(() => sessionStorage.clear());

  it('returns null when no token stored', () => {
    expect(getToken()).toBeNull();
  });

  it('returns the stored token', () => {
    sessionStorage.setItem('github_access_token', 'ghp_abc');
    expect(getToken()).toBe('ghp_abc');
  });
});

describe('logout', () => {
  afterEach(() => sessionStorage.clear());

  it('clears token, state, and code verifier from sessionStorage', () => {
    sessionStorage.setItem('github_access_token', 'tok');
    sessionStorage.setItem('oauth_state', 'st');
    sessionStorage.setItem('oauth_code_verifier', 'cv');
    logout();
    expect(sessionStorage.getItem('github_access_token')).toBeNull();
    expect(sessionStorage.getItem('oauth_state')).toBeNull();
    expect(sessionStorage.getItem('oauth_code_verifier')).toBeNull();
  });
});
