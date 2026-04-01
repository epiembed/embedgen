/**
 * User-friendly error message formatter.
 *
 * Translates internal error types into actionable messages, with
 * provider-specific guidance where relevant.
 */

import {
  ApiKeyError,
  RateLimitError,
  QuotaError,
  EmbeddingError,
} from '../embeddings/provider.js';

import { AuthError, NotFoundError, ConflictError, ApiError } from '../github/api.js';

const PROVIDER_NAMES = {
  openai:      'OpenAI',
  voyage:      'Voyage AI',
  gemini:      'Google Gemini',
  huggingface: 'HuggingFace',
};

// ── Embedding errors ──────────────────────────────────────────────────

/**
 * Format an embedding error into a user-facing message.
 * @param {Error} err
 * @param {{ provider?: string, attempt?: number, maxRetries?: number }} [ctx]
 * @returns {string}
 */
export function formatEmbedError(err, { provider = null, attempt = null, maxRetries = null } = {}) {
  const providerName = PROVIDER_NAMES[provider] ?? provider ?? 'the API';

  if (err instanceof ApiKeyError) {
    return `Invalid API key for ${providerName}. Check that your key is correct and has embedding permissions.`;
  }

  if (err instanceof QuotaError) {
    return `${providerName} quota exceeded. You've used your monthly allowance — check your billing dashboard.`;
  }

  if (err instanceof RateLimitError) {
    const waitSec = err.retryAfter ?? null;
    const retryMsg = attempt !== null && maxRetries !== null
      ? ` (attempt ${attempt}/${maxRetries})`
      : '';
    return waitSec
      ? `${providerName} rate limit hit — retrying in ${waitSec} s…${retryMsg}`
      : `${providerName} rate limit hit — retrying…${retryMsg}`;
  }

  if (err instanceof EmbeddingError) {
    if (err.status === 400) {
      return `${providerName} rejected the request (400). Check your input data for unsupported characters or oversized inputs.`;
    }
    if (err.status === 503 || err.status === 529) {
      return `${providerName} is temporarily unavailable (${err.status}). Try again in a few seconds.`;
    }
    return `${providerName} error: ${err.message}`;
  }

  if (err instanceof TypeError && err.message.includes('fetch')) {
    return `Network error — could not reach ${providerName}. Check your internet connection.`;
  }

  return `Unexpected error: ${err.message}`;
}

/**
 * Format a HuggingFace model download error.
 * @param {Error} err
 * @param {string} [modelName]
 * @returns {string}
 */
export function formatDownloadError(err, modelName = null) {
  const model = modelName ? `"${modelName}"` : 'the model';
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return `Could not download ${model}. Check your internet connection and try again.`;
  }
  if (err.message?.includes('404') || err.message?.includes('not found')) {
    return `Model ${model} was not found on HuggingFace Hub. It may have been removed or renamed.`;
  }
  return `Failed to load ${model}: ${err.message}`;
}

// ── File parsing errors ───────────────────────────────────────────────

/**
 * Format a file parse error into a user-facing message.
 * @param {Error} err
 * @param {'csv'|'tsv'|'json'|'projector'} [fileType]
 * @returns {string}
 */
export function formatParseError(err, fileType = null) {
  const typeName = fileType ? fileType.toUpperCase() : 'file';
  const msg = err.message ?? String(err);

  // Surface line numbers when present
  const lineMatch = msg.match(/line\s+(\d+)/i);
  const lineHint = lineMatch ? ` on line ${lineMatch[1]}` : '';

  if (msg.toLowerCase().includes('unterminated')) {
    return `Invalid ${typeName}: unterminated quoted field${lineHint}. Make sure all quotes are properly closed.`;
  }
  if (msg.toLowerCase().includes('unexpected token') || msg.toLowerCase().includes('json')) {
    return `Invalid JSON${lineHint}. The file is not valid JSON — check for trailing commas or missing brackets.`;
  }
  if (msg.toLowerCase().includes('empty') || msg.toLowerCase().includes('no rows')) {
    return `The ${typeName} file appears to be empty or has no data rows.`;
  }
  return `Could not parse ${typeName}${lineHint}: ${msg}`;
}

// ── GitHub errors ─────────────────────────────────────────────────────

/**
 * Format a GitHub API error into a user-facing message.
 * @param {Error} err
 * @returns {string}
 */
export function formatGitHubError(err) {
  if (err instanceof AuthError) {
    return 'GitHub session expired. Please log in again.';
  }
  if (err instanceof NotFoundError) {
    return 'GitHub resource not found. The repo may have been deleted or you may lack access.';
  }
  if (err instanceof ConflictError) {
    return 'GitHub conflict — the file was modified by another process. Please try again.';
  }
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return 'GitHub permission denied (403). Make sure the repo is public and your token has repo scope.';
    }
    if (err.status === 422) {
      return 'GitHub rejected the request (422). The repo name may be invalid or already exist.';
    }
    return `GitHub error (${err.status}): ${err.message}`;
  }
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return 'Network error — could not reach GitHub. Check your internet connection.';
  }
  return `GitHub error: ${err.message}`;
}
