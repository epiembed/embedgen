// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  initiateLogin,
  handleCallback,
  getToken,
  logout,
} from '../../src/github/auth.js';

// ── generateCodeVerifier ──────────────────────────────────────────────

describe('generateCodeVerifier', () => {
  it('returns a 64-character string', () => {
    expect(generateCodeVerifier()).toHaveLength(64);
  });

  it('returns different values each call', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });

  it('contains only base64url characters', () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9\-_]+$/);
  });
});

// ── generateCodeChallenge ─────────────────────────────────────────────

describe('generateCodeChallenge', () => {
  it('returns a non-empty base64url string', async () => {
    const challenge = await generateCodeChallenge('test-verifier');
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(challenge.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same verifier', async () => {
    const a = await generateCodeChallenge('same');
    const b = await generateCodeChallenge('same');
    expect(a).toBe(b);
  });

  it('differs for different verifiers', async () => {
    const a = await generateCodeChallenge('verifier-a');
    const b = await generateCodeChallenge('verifier-b');
    expect(a).not.toBe(b);
  });

  it('produces a valid SHA-256 base64url (43 chars for 32 bytes)', async () => {
    const challenge = await generateCodeChallenge('hello');
    // SHA-256 = 32 bytes → 43 base64url chars (no padding)
    expect(challenge).toHaveLength(43);
  });
});

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

  it('stores verifier and state in sessionStorage', async () => {
    await initiateLogin('client123', 'https://example.com/callback');
    expect(sessionStorage.getItem('gh_pkce_verifier')).toBeTruthy();
    expect(sessionStorage.getItem('gh_pkce_state')).toBeTruthy();
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
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('state')).toBeTruthy();
  });
});

// ── handleCallback ────────────────────────────────────────────────────

describe('handleCallback', () => {
  const WORKER_URL = 'https://worker.example.com/token';

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
    const result = await handleCallback(WORKER_URL);
    expect(result).toBeNull();
  });

  it('throws on state mismatch', async () => {
    sessionStorage.setItem('gh_pkce_state',    'different-state');
    sessionStorage.setItem('gh_pkce_verifier', 'verifier');
    await expect(handleCallback(WORKER_URL)).rejects.toThrow('state mismatch');
  });

  it('exchanges code via POST to workerUrl', async () => {
    sessionStorage.setItem('gh_pkce_state',    'mystate');
    sessionStorage.setItem('gh_pkce_verifier', 'verifier123');
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'ghp_token' }),
    });

    await handleCallback(WORKER_URL);

    expect(fetch).toHaveBeenCalledWith(
      WORKER_URL,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"code":"abc123"'),
      }),
    );
  });

  it('stores token in sessionStorage on success', async () => {
    sessionStorage.setItem('gh_pkce_state',    'mystate');
    sessionStorage.setItem('gh_pkce_verifier', 'verifier123');
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'ghp_token' }),
    });

    const token = await handleCallback(WORKER_URL);
    expect(token).toBe('ghp_token');
    expect(sessionStorage.getItem('gh_access_token')).toBe('ghp_token');
  });

  it('throws when worker returns non-ok response', async () => {
    sessionStorage.setItem('gh_pkce_state',    'mystate');
    sessionStorage.setItem('gh_pkce_verifier', 'verifier123');
    fetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });
    await expect(handleCallback(WORKER_URL)).rejects.toThrow('Token exchange failed');
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

  it('clears token and PKCE state from sessionStorage', () => {
    sessionStorage.setItem('gh_access_token',  'tok');
    sessionStorage.setItem('gh_pkce_verifier', 'ver');
    sessionStorage.setItem('gh_pkce_state',    'st');
    logout();
    expect(sessionStorage.getItem('gh_access_token')).toBeNull();
    expect(sessionStorage.getItem('gh_pkce_verifier')).toBeNull();
    expect(sessionStorage.getItem('gh_pkce_state')).toBeNull();
  });
});
