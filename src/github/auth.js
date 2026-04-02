/**
 * GitHub OAuth flow (without PKCE — GitHub OAuth Apps do not support it).
 *
 * Security is provided by:
 *   - CSRF state token verified on callback
 *   - Client secret held securely on the Cloudflare Worker
 *
 * Flow:
 *   1. initiateLogin()  — generate state, redirect to GitHub.
 *   2. handleCallback() — on redirect back, verify state, exchange code for token via Worker.
 *   3. getToken()       — read stored token.
 *   4. logout()         — clear stored token.
 */

const SESSION_KEY_STATE = 'gh_oauth_state';
const SESSION_KEY_TOKEN = 'gh_access_token';

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Generate a random CSRF state token.
 * @returns {string}
 */
export function generateState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

// ── OAuth flow ────────────────────────────────────────────────────────

/**
 * Start the GitHub OAuth login.
 * Stores state in sessionStorage for CSRF protection, then redirects to GitHub.
 *
 * @param {string} clientId
 * @param {string} redirectUri
 */
export function initiateLogin(clientId, redirectUri) {
  const state = generateState();

  sessionStorage.setItem(SESSION_KEY_STATE, state);

  const params = new URLSearchParams({
    client_id:    clientId,
    redirect_uri: redirectUri,
    scope:        'repo',
    state,
  });

  window.location.href = `https://github.com/login/oauth/authorize?${params}`;
}

/**
 * Handle the OAuth callback.
 * Call this on page load. Reads `?code=` and `?state=` from the URL,
 * verifies state, exchanges code for a token via the Cloudflare Worker,
 * stores the token in sessionStorage, and cleans the URL.
 *
 * @param {string} workerUrl  — URL of the token-exchange Cloudflare Worker.
 * @returns {Promise<string|null>}  The access token, or null if no callback params.
 * @throws {Error} On state mismatch or network/server errors.
 */
export async function handleCallback(workerUrl) {
  const params   = new URLSearchParams(window.location.search);
  const code     = params.get('code');
  const state    = params.get('state');

  if (!code || !state) return null;

  const storedState = sessionStorage.getItem(SESSION_KEY_STATE);

  if (state !== storedState) {
    throw new Error('OAuth state mismatch — possible CSRF attack.');
  }

  sessionStorage.removeItem(SESSION_KEY_STATE);

  const response = await fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
  }

  const { access_token } = await response.json();
  if (!access_token) throw new Error('Worker response missing access_token.');

  sessionStorage.setItem(SESSION_KEY_TOKEN, access_token);

  // Clean up the URL
  const clean = window.location.href.split('?')[0];
  window.history.replaceState({}, '', clean);

  return access_token;
}

/**
 * Retrieve the stored access token.
 * @returns {string|null}
 */
export function getToken() {
  return sessionStorage.getItem(SESSION_KEY_TOKEN);
}

/**
 * Clear all auth state from sessionStorage.
 */
export function logout() {
  sessionStorage.removeItem(SESSION_KEY_TOKEN);
  sessionStorage.removeItem(SESSION_KEY_STATE);
}

// ── Internal ──────────────────────────────────────────────────────────

function base64url(bytes) {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
