/**
 * GitHub OAuth flow with PKCE (Proof Key for Code Exchange).
 *
 * Flow:
 *   1. initiateLogin()  — generate PKCE values + state, redirect to GitHub.
 *   2. handleCallback() — verify state, exchange code + code_verifier for token via Worker.
 *   3. getToken()       — read stored token.
 *   4. logout()         — clear stored token and PKCE values.
 */

import { GITHUB_CONFIG } from '../config/github.js';

const { STORAGE_KEYS } = GITHUB_CONFIG;

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Base64url-encode a Uint8Array.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function base64url(bytes) {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generate a random CSRF state token.
 * @returns {string}
 */
export function generateState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/**
 * Generate a PKCE code verifier (48 random bytes -> 64 base64url chars).
 * @returns {string}
 */
export function generateCodeVerifier() {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/**
 * Compute the PKCE code challenge (SHA-256 hash of the verifier, base64url-encoded).
 * @param {string} verifier
 * @returns {Promise<string>}
 */
export async function computeCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64url(new Uint8Array(digest));
}

// ── OAuth flow ────────────────────────────────────────────────────────

/**
 * Start the GitHub OAuth login.
 * Generates PKCE values + CSRF state, stores them in sessionStorage,
 * then redirects to GitHub's authorization page.
 */
export async function initiateLogin() {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await computeCodeChallenge(codeVerifier);

  sessionStorage.setItem(STORAGE_KEYS.OAUTH_STATE, state);
  sessionStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, codeVerifier);

  const params = new URLSearchParams({
    client_id:             GITHUB_CONFIG.CLIENT_ID,
    redirect_uri:          GITHUB_CONFIG.REDIRECT_URI,
    scope:                 GITHUB_CONFIG.OAUTH_SCOPE,
    state,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `https://github.com/login/oauth/authorize?${params}`;
}

/**
 * Handle the OAuth callback.
 * Reads ?code= and ?state= from the URL, verifies state, retrieves
 * the stored code_verifier, exchanges code + verifier for a token
 * via the Cloudflare Worker, stores the token, and cleans the URL.
 *
 * @returns {Promise<string|null>}  The access token, or null if no callback params.
 * @throws {Error} On state mismatch, missing verifier, or network/server errors.
 */
export async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get('code');
  const state  = params.get('state');

  if (!code || !state) return null;

  // Verify CSRF state
  const storedState = sessionStorage.getItem(STORAGE_KEYS.OAUTH_STATE);
  if (state !== storedState) {
    throw new Error('OAuth state mismatch — possible CSRF attack.');
  }

  // Retrieve PKCE code verifier
  const codeVerifier = sessionStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
  if (!codeVerifier) {
    throw new Error('Code verifier not found — please try logging in again.');
  }

  // Clean up temporary OAuth values
  sessionStorage.removeItem(STORAGE_KEYS.OAUTH_STATE);
  sessionStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);

  // Exchange code for token via the Cloudflare Worker
  const response = await fetch(GITHUB_CONFIG.WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id:     GITHUB_CONFIG.CLIENT_ID,
      code_verifier: codeVerifier,
      redirect_uri:  GITHUB_CONFIG.REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }
  if (!data.access_token) {
    throw new Error('Worker response missing access_token.');
  }

  sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);

  // Clean up the URL
  const clean = window.location.href.split('?')[0];
  window.history.replaceState({}, '', clean);

  return data.access_token;
}

/**
 * Retrieve the stored access token.
 * @returns {string|null}
 */
export function getToken() {
  return sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Clear all auth state from sessionStorage.
 */
export function logout() {
  sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  sessionStorage.removeItem(STORAGE_KEYS.OAUTH_STATE);
  sessionStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
}
