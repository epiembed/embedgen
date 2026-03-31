/**
 * OpenAI embedding adapter.
 *
 * Supported models: text-embedding-3-large, text-embedding-3-small, text-embedding-ada-002
 * Endpoint: POST https://api.openai.com/v1/embeddings
 * Auth: Bearer token
 */

import { ApiKeyError, RateLimitError, QuotaError, EmbeddingError } from './provider.js';

const ENDPOINT = 'https://api.openai.com/v1/embeddings';

/**
 * Parse an error response from the OpenAI API.
 * @param {Response} response
 * @param {object} body
 */
function parseError(response, body) {
  const message = body?.error?.message ?? `OpenAI API error (${response.status})`;
  switch (response.status) {
    case 401: throw new ApiKeyError(message);
    case 429: {
      const retryAfter = Number(response.headers.get('retry-after')) || null;
      if (body?.error?.code === 'insufficient_quota') throw new QuotaError(message);
      throw new RateLimitError(message, retryAfter);
    }
    case 400: throw new EmbeddingError(message, 400);
    default:  throw new EmbeddingError(message, response.status);
  }
}

/**
 * Embed an array of texts using the OpenAI embeddings API.
 *
 * @param {string[]} texts
 * @param {string} modelName  e.g. 'text-embedding-3-small'
 * @param {string} apiKey
 * @param {{ dimensions?: number }} [options]
 * @returns {Promise<number[][]>}
 */
async function embed(texts, modelName, apiKey, options = {}) {
  const body = { model: modelName, input: texts };

  // Pass dimensions only for Matryoshka-capable models (text-embedding-3-*)
  if (options.dimensions != null && modelName.startsWith('text-embedding-3')) {
    body.dimensions = options.dimensions;
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const json = await response.json();
  if (!response.ok) parseError(response, json);

  // Sort by index to guarantee order matches input
  return json.data
    .sort((a, b) => a.index - b.index)
    .map(item => item.embedding);
}

/**
 * Validate an API key by making a minimal embedding request.
 * @param {string} apiKey
 * @returns {Promise<boolean>}
 */
async function validateApiKey(apiKey) {
  try {
    await embed([' '], 'text-embedding-3-small', apiKey);
    return true;
  } catch (err) {
    if (err instanceof ApiKeyError) return false;
    throw err;
  }
}

export const adapter = { name: 'openai', embed, validateApiKey };
