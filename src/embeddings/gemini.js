/**
 * Google Gemini embedding adapter.
 *
 * Supported models: gemini-embedding-001, gemini-embedding-2-preview
 * Endpoint: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:batchEmbedContents
 * Auth: API key as query parameter
 *
 * The batchEmbedContents endpoint accepts an array of requests, each with a
 * single content object. Responses are returned in the same order as the input.
 */

import { ApiKeyError, RateLimitError, QuotaError, EmbeddingError } from './provider.js';

/**
 * @param {string} modelName
 * @returns {string}
 */
function endpoint(modelName) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:batchEmbedContents`;
}

/**
 * @param {Response} response
 * @param {object} body
 */
function parseError(response, body) {
  const message = body?.error?.message ?? `Gemini API error (${response.status})`;
  const status = body?.error?.status ?? '';
  switch (response.status) {
    case 400: throw new EmbeddingError(message, 400);
    case 401:
    case 403: throw new ApiKeyError(message);
    case 429: {
      const retryAfter = Number(response.headers.get('retry-after')) || null;
      if (status === 'RESOURCE_EXHAUSTED') throw new QuotaError(message);
      throw new RateLimitError(message, retryAfter);
    }
    default: throw new EmbeddingError(message, response.status);
  }
}

/**
 * Convert a single input value into Gemini content parts array.
 * @param {string|{type:string,[key:string]:any}} input
 * @returns {object[]}
 */
function toGeminiParts(input) {
  if (typeof input === 'string') {
    return [{ text: input }];
  }
  if (input.type === 'image_base64') {
    return [{ inlineData: { mimeType: input.mimeType, data: input.data } }];
  }
  throw new EmbeddingError(`Unsupported input type for Gemini: ${input.type}`);
}

/**
 * Embed inputs using the Gemini batchEmbedContents API.
 * Supports plain text strings and base64 image objects for multimodal models.
 *
 * @param {(string|{type:string,[key:string]:any})[]} inputs
 * @param {string} modelName  e.g. 'gemini-embedding-001'
 * @param {string} apiKey
 * @param {{
 *   taskType?: 'RETRIEVAL_DOCUMENT'|'RETRIEVAL_QUERY'|'SEMANTIC_SIMILARITY'|'CLASSIFICATION'|'CLUSTERING',
 *   outputDimensionality?: number,
 * }} [options]
 * @returns {Promise<number[][]>}
 */
async function embed(inputs, modelName, apiKey, options = {}) {
  const url = `${endpoint(modelName)}?key=${encodeURIComponent(apiKey)}`;

  const requests = inputs.map(input => {
    const req = {
      model: `models/${modelName}`,
      content: { parts: toGeminiParts(input) },
    };
    if (options.taskType != null) req.taskType = options.taskType;
    if (options.outputDimensionality != null) req.outputDimensionality = options.outputDimensionality;
    return req;
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });

  const json = await response.json();
  if (!response.ok) parseError(response, json);

  // Response: { embeddings: [{ values: number[] }, ...] } in input order
  return json.embeddings.map(e => e.values);
}

/**
 * Validate an API key by embedding a single space.
 * @param {string} apiKey
 * @returns {Promise<boolean>}
 */
async function validateApiKey(apiKey) {
  try {
    await embed([' '], 'gemini-embedding-001', apiKey);
    return true;
  } catch (err) {
    if (err instanceof ApiKeyError) return false;
    throw err;
  }
}

export const adapter = { name: 'gemini', embed, validateApiKey };
