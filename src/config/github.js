/**
 * GitHub OAuth configuration for EmbedGen.
 *
 * Uses the same OAuth App and Cloudflare Worker as github-backend.
 * The worker at WORKER_URL holds the CLIENT_SECRET securely.
 *
 * Prerequisites:
 *   1. Add REDIRECT_URI as a callback URL in the OAuth App settings.
 *   2. Add the origin (https://epiembed.github.io) to the worker's ALLOWED_ORIGINS.
 */

export const GITHUB_CONFIG = {
  CLIENT_ID: 'Ov23li8SzBtP3dGD2O5y',
  WORKER_URL: 'https://github-oauth-proxy.jeyabbalas.workers.dev/',
  REDIRECT_URI: 'https://epiembed.github.io/embedgen/',
  OAUTH_SCOPE: 'repo',

  STORAGE_KEYS: {
    ACCESS_TOKEN: 'github_access_token',
    CODE_VERIFIER: 'oauth_code_verifier',
    OAUTH_STATE: 'oauth_state',
  },
};

Object.freeze(GITHUB_CONFIG);
Object.freeze(GITHUB_CONFIG.STORAGE_KEYS);
