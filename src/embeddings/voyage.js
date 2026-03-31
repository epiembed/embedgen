/**
 * Voyage AI embedding adapter.
 *
 * Supported models: voyage-4-large, voyage-4, voyage-4-lite, voyage-3.5,
 *   voyage-3.5-lite, voyage-3-large, voyage-code-3, voyage-finance-2,
 *   voyage-law-2, voyage-multimodal-3.5, voyage-multimodal-3
 * Endpoint: POST https://api.voyageai.com/v1/embeddings
 * Auth: Bearer token
 */

import { ApiKeyError, RateLimitError, QuotaError, EmbeddingError } from './provider.js';

const ENDPOINT = 'https://api.voyageai.com/v1/embeddings';

// Models that support output_dtype quantization (Voyage 4 and 3.5 series)
const DTYPE_MODELS = new Set([
  'voyage-4-large', 'voyage-4', 'voyage-4-lite',
  'voyage-3.5', 'voyage-3.5-lite', 'voyage-3-large',
]);

// Models that support output_dimension (Matryoshka) via API parameter
const MATRYOSHKA_MODELS = new Set([
  'voyage-4-large', 'voyage-4', 'voyage-4-lite',
  'voyage-3.5', 'voyage-3.5-lite', 'voyage-3-large',
  'voyage-code-3',
]);

/**
 * @param {Response} response
 * @param {object} body
 */
function parseError(response, body) {
  const message = body?.detail ?? `Voyage AI API error (${response.status})`;
  switch (response.status) {
    case 401: throw new ApiKeyError(message);
    case 429: {
      const retryAfter = Number(response.headers.get('retry-after')) || null;
      if (message.toLowerCase().includes('quota')) throw new QuotaError(message);
      throw new RateLimitError(message, retryAfter);
    }
    case 400: throw new EmbeddingError(message, 400);
    default:  throw new EmbeddingError(message, response.status);
  }
}

/**
 * Embed texts using the Voyage AI embeddings API.
 *
 * @param {string[]} texts
 * @param {string} modelName  e.g. 'voyage-3.5'
 * @param {string} apiKey
 * @param {{
 *   input_type?: 'query'|'document'|null,
 *   output_dimension?: number,
 *   output_dtype?: 'float'|'int8'|'uint8'|'binary'|'ubinary',
 * }} [options]
 * @returns {Promise<number[][]>}
 */
async function embed(texts, modelName, apiKey, options = {}) {
  const body = { model: modelName, input: texts };

  if (options.input_type != null) {
    body.input_type = options.input_type;
  }

  if (options.output_dimension != null && MATRYOSHKA_MODELS.has(modelName)) {
    body.output_dimension = options.output_dimension;
  }

  if (options.output_dtype != null && DTYPE_MODELS.has(modelName)) {
    body.output_dtype = options.output_dtype;
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
    await embed([' '], 'voyage-3.5-lite', apiKey);
    return true;
  } catch (err) {
    if (err instanceof ApiKeyError) return false;
    throw err;
  }
}

export const adapter = { name: 'voyage', embed, validateApiKey };
