import { describe, it, expect } from 'vitest';
import { formatEmbedError, formatDownloadError, formatParseError, formatGitHubError } from '../../src/ui/errors.js';
import { ApiKeyError, RateLimitError, QuotaError, EmbeddingError } from '../../src/embeddings/provider.js';
import { AuthError, NotFoundError, ConflictError, ApiError } from '../../src/github/api.js';

// ── formatEmbedError ──────────────────────────────────────────────────

describe('formatEmbedError', () => {
  it('ApiKeyError — names the provider and mentions permissions', () => {
    const msg = formatEmbedError(new ApiKeyError(), { provider: 'openai' });
    expect(msg).toContain('OpenAI');
    expect(msg.toLowerCase()).toContain('api key');
  });

  it('QuotaError — mentions quota and billing', () => {
    const msg = formatEmbedError(new QuotaError(), { provider: 'voyage' });
    expect(msg).toContain('Voyage AI');
    expect(msg.toLowerCase()).toContain('quota');
    expect(msg.toLowerCase()).toContain('billing');
  });

  it('RateLimitError with retryAfter — includes wait time', () => {
    const msg = formatEmbedError(new RateLimitError('hit', 30), { provider: 'gemini' });
    expect(msg).toContain('30');
    expect(msg).toContain('Google Gemini');
  });

  it('RateLimitError with attempt context', () => {
    const msg = formatEmbedError(new RateLimitError('hit', 5), { provider: 'openai', attempt: 2, maxRetries: 4 });
    expect(msg).toContain('2/4');
  });

  it('EmbeddingError 400 — mentions input data', () => {
    const msg = formatEmbedError(new EmbeddingError('bad', 400), { provider: 'openai' });
    expect(msg).toContain('400');
    expect(msg.toLowerCase()).toContain('input');
  });

  it('EmbeddingError 503 — mentions unavailable', () => {
    const msg = formatEmbedError(new EmbeddingError('down', 503), { provider: 'voyage' });
    expect(msg).toContain('503');
    expect(msg.toLowerCase()).toContain('unavailable');
  });

  it('network TypeError — suggests checking connection', () => {
    const msg = formatEmbedError(new TypeError('Failed to fetch'), { provider: 'gemini' });
    expect(msg.toLowerCase()).toContain('network');
    expect(msg.toLowerCase()).toContain('internet');
  });

  it('unknown error — falls back gracefully', () => {
    const msg = formatEmbedError(new Error('something weird'));
    expect(msg).toContain('something weird');
  });
});

// ── formatDownloadError ───────────────────────────────────────────────

describe('formatDownloadError', () => {
  it('network error — suggests internet connection', () => {
    const msg = formatDownloadError(new TypeError('Failed to fetch'), 'all-MiniLM-L6-v2');
    expect(msg.toLowerCase()).toContain('internet');
    expect(msg).toContain('all-MiniLM-L6-v2');
  });

  it('404 error — says model not found', () => {
    const msg = formatDownloadError(new Error('404 not found'), 'my-model');
    expect(msg.toLowerCase()).toContain('not found');
  });

  it('falls back to message for unknown errors', () => {
    const msg = formatDownloadError(new Error('out of memory'));
    expect(msg).toContain('out of memory');
  });
});

// ── formatParseError ──────────────────────────────────────────────────

describe('formatParseError', () => {
  it('unterminated quote — includes helpful hint', () => {
    const msg = formatParseError(new Error('unterminated quoted field on line 12'), 'csv');
    expect(msg.toUpperCase()).toContain('CSV');
    expect(msg).toContain('12');
    expect(msg.toLowerCase()).toContain('quotes');
  });

  it('JSON parse error — mentions JSON', () => {
    const msg = formatParseError(new SyntaxError('Unexpected token < in JSON'), 'json');
    expect(msg.toLowerCase()).toContain('json');
  });

  it('empty file error', () => {
    const msg = formatParseError(new Error('empty file, no rows'), 'csv');
    expect(msg.toLowerCase()).toContain('empty');
  });

  it('generic error — includes raw message', () => {
    const msg = formatParseError(new Error('some weird thing'), 'tsv');
    expect(msg).toContain('some weird thing');
  });
});

// ── formatGitHubError ─────────────────────────────────────────────────

describe('formatGitHubError', () => {
  it('AuthError — prompts re-login', () => {
    const msg = formatGitHubError(new AuthError());
    expect(msg.toLowerCase()).toContain('log in');
  });

  it('NotFoundError — mentions repo access', () => {
    const msg = formatGitHubError(new NotFoundError());
    expect(msg.toLowerCase()).toContain('not found');
  });

  it('ConflictError — suggests retry', () => {
    const msg = formatGitHubError(new ConflictError());
    expect(msg.toLowerCase()).toContain('conflict');
  });

  it('ApiError 403 — mentions permissions and token scope', () => {
    const msg = formatGitHubError(new ApiError(403, 'Forbidden'));
    expect(msg).toContain('403');
    expect(msg.toLowerCase()).toContain('permission');
  });

  it('ApiError 422 — mentions repo name', () => {
    const msg = formatGitHubError(new ApiError(422, 'Unprocessable'));
    expect(msg).toContain('422');
    expect(msg.toLowerCase()).toContain('repo name');
  });

  it('network TypeError — suggests connection check', () => {
    const msg = formatGitHubError(new TypeError('Failed to fetch'));
    expect(msg.toLowerCase()).toContain('network');
  });

  it('unknown error — falls back gracefully', () => {
    const msg = formatGitHubError(new Error('something'));
    expect(msg).toContain('something');
  });
});
