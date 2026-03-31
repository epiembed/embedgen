/**
 * Embedding provider interface and shared error types.
 *
 * All provider adapters must export an object conforming to ProviderAdapter:
 *
 *   export const adapter = {
 *     name: 'openai',
 *     async embed(texts, modelName, apiKey, options) { ... },
 *     async validateApiKey(apiKey) { ... },
 *   };
 */

// ── Error types ───────────────────────────────────────────────────────

export class ApiKeyError extends Error {
  constructor(message = 'Invalid or missing API key') {
    super(message);
    this.name = 'ApiKeyError';
  }
}

export class RateLimitError extends Error {
  /** @param {number} [retryAfter]  Seconds to wait before retrying */
  constructor(message = 'Rate limit exceeded', retryAfter = null) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class QuotaError extends Error {
  constructor(message = 'Quota exceeded') {
    super(message);
    this.name = 'QuotaError';
  }
}

export class EmbeddingError extends Error {
  /** @param {string} message @param {number} [status] */
  constructor(message, status = null) {
    super(message);
    this.name = 'EmbeddingError';
    this.status = status;
  }
}

// ── Interface validation ──────────────────────────────────────────────

/**
 * Validate that an object conforms to the ProviderAdapter interface.
 * Throws if any required property is missing or the wrong type.
 *
 * Expected shape:
 *   {
 *     name: string,
 *     embed(texts: string[], modelName: string, apiKey: string, options?: object): Promise<number[][]>,
 *     validateApiKey(apiKey: string): Promise<boolean>,
 *   }
 *
 * @param {object} adapter
 * @returns {true}
 */
export function validateAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') {
    throw new TypeError('Adapter must be an object');
  }
  if (typeof adapter.name !== 'string' || adapter.name.trim() === '') {
    throw new TypeError('Adapter must have a non-empty string "name"');
  }
  if (typeof adapter.embed !== 'function') {
    throw new TypeError('Adapter must implement embed(texts, modelName, apiKey, options?)');
  }
  if (typeof adapter.validateApiKey !== 'function') {
    throw new TypeError('Adapter must implement validateApiKey(apiKey)');
  }
  return true;
}
