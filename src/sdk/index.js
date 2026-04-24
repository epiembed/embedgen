/**
 * EmbedGen SDK
 *
 * Programmatic access to EmbedGen's embedding pipeline — no DOM required.
 * Supports OpenAI, Voyage AI, and Google Gemini. HuggingFace (in-browser)
 * models need a Web Worker and are not included in the EmbedGen class; their
 * adapter is still exported for direct use.
 *
 * Quick start:
 *   import { EmbedGen } from './src/sdk/index.js';
 *   const eg = new EmbedGen({ model: 'openai/text-embedding-3-small', apiKey: 'sk-...' });
 *   const vectors = await eg.embed(['hello', 'world']);
 */

import { adapter as openaiAdapter }      from '../embeddings/openai.js';
import { adapter as voyageAdapter }      from '../embeddings/voyage.js';
import { adapter as geminiAdapter }      from '../embeddings/gemini.js';
import { adapter as huggingfaceAdapter } from '../embeddings/huggingface.js';
import {
  RateLimitError,
  ApiKeyError,
  QuotaError,
  EmbeddingError,
} from '../embeddings/provider.js';
import { createBatches, estimateTokens }                      from '../embeddings/batcher.js';
import { truncateEmbeddings, normalizeEmbeddings, getLegalDimensions } from '../embeddings/matryoshka.js';
import { getModelById, getModelsByProvider, getModelsByInputType, getProviders, MODELS } from '../config/models.js';
import { parse as parseCSV }  from '../data/parsers/csv.js';
import { parse as parseJSON } from '../data/parsers/json.js';
import { toTSV, toBinary, fromTSV, fromBinary } from '../export/tensor.js';

// ── Internal constants ────────────────────────────────────────────────

const MAX_RETRIES    = 4;
const BASE_BACKOFF_MS = 2000;

const CLOUD_ADAPTERS = {
  openai:  openaiAdapter,
  voyage:  voyageAdapter,
  gemini:  geminiAdapter,
};

// ── Internal helpers ──────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Map a target dimension to the correct provider-specific option key.
 * @param {string} provider
 * @param {number|null} dimensions
 * @returns {object}
 */
function dimensionOptions(provider, dimensions) {
  if (dimensions == null) return {};
  switch (provider) {
    case 'openai':  return { dimensions };
    case 'voyage':  return { output_dimension: dimensions };
    case 'gemini':  return { outputDimensionality: dimensions };
    default:        return {};
  }
}

// ── EmbedGen class ────────────────────────────────────────────────────

export class EmbedGen {
  /**
   * @param {object} config
   * @param {string}      config.model      - Model ID e.g. 'openai/text-embedding-3-small'
   * @param {string}      [config.apiKey]   - API key (not needed for HuggingFace models)
   * @param {number|null} [config.dimensions] - Matryoshka target dimensions (optional)
   */
  constructor({ model, apiKey = '', dimensions = null } = {}) {
    const modelConfig = getModelById(model);
    if (!modelConfig) {
      throw new Error(
        `Unknown model: "${model}". ` +
        `Call models.list() to see all available model IDs.`
      );
    }

    const adapter = CLOUD_ADAPTERS[modelConfig.provider];
    if (!adapter) {
      throw new Error(
        `Provider "${modelConfig.provider}" requires a Web Worker and is not ` +
        `supported in the EmbedGen class. Use the huggingface adapter export directly.`
      );
    }

    this._model     = modelConfig;
    this._adapter   = adapter;
    this._apiKey    = apiKey;
    this._dimensions = dimensions;
  }

  /** The resolved ModelConfig for the configured model. */
  get modelConfig() { return this._model; }

  /**
   * Test whether the configured API key is valid.
   * @returns {Promise<boolean>}
   */
  validateApiKey() {
    return this._adapter.validateApiKey(this._apiKey);
  }

  /**
   * Embed an array of texts.
   *
   * Handles batching, per-text truncation, and automatic retry with exponential
   * backoff on rate-limit errors. Throws on API key errors, quota errors, or
   * unrecoverable failures.
   *
   * @param {string[]} texts
   * @param {object}   [options]
   * @param {(progress: {batch:number, total:number, embedded:number, count:number}) => void} [options.onProgress]
   *   Called after each batch completes.
   * @param {AbortSignal} [options.signal]
   *   Pass an AbortController signal to cancel a long-running embed call.
   * @returns {Promise<number[][]>} N × D matrix — one vector per input text.
   */
  async embed(texts, { onProgress, signal } = {}) {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new TypeError('texts must be a non-empty array of strings');
    }

    const { _model: model, _adapter: adapter, _apiKey: apiKey, _dimensions: dimensions } = this;

    // Truncate inputs that exceed the model's per-text token limit.
    const maxChars = model.maxTokens ? model.maxTokens * 4 : null;
    const prepared = texts.map(t => {
      const s = t == null ? '' : String(t);
      return maxChars && s.length > maxChars ? s.slice(0, maxChars) : s;
    });

    const batches = createBatches(
      prepared,
      model.maxBatchSize,
      model.maxTokens ? model.maxTokens * model.maxBatchSize : Infinity,
    );

    const dimOpts    = dimensionOptions(model.provider, dimensions);
    const allVectors = [];

    for (let i = 0; i < batches.length; i++) {
      if (signal?.aborted) throw new DOMException('Embedding cancelled', 'AbortError');

      const batch   = batches[i];
      let vectors   = null;
      let attempt   = 0;

      while (vectors === null) {
        if (signal?.aborted) throw new DOMException('Embedding cancelled', 'AbortError');

        try {
          vectors = await adapter.embed(batch, model.name, apiKey, dimOpts);

          if (vectors.length !== batch.length) {
            throw new EmbeddingError(
              `Embedding count mismatch in batch ${i + 1}: ` +
              `sent ${batch.length} but received ${vectors.length}.`
            );
          }
        } catch (err) {
          if (err instanceof RateLimitError && attempt < MAX_RETRIES) {
            const waitMs = err.retryAfter
              ? err.retryAfter * 1000
              : BASE_BACKOFF_MS * Math.pow(2, attempt);
            await sleep(waitMs);
            attempt++;
          } else {
            throw err;
          }
        }
      }

      allVectors.push(...vectors);
      onProgress?.({
        batch:    i + 1,
        total:    batches.length,
        embedded: allVectors.length,
        count:    texts.length,
      });
    }

    return allVectors;
  }
}

// ── Error classes ─────────────────────────────────────────────────────

export { ApiKeyError, RateLimitError, QuotaError, EmbeddingError };

// ── Parsers ───────────────────────────────────────────────────────────

/**
 * Data parsers.
 *
 * @example
 * import { parsers } from './src/sdk/index.js';
 * const { headers, rows } = parsers.csv(csvString);
 * const { headers, rows } = parsers.json(jsonString);
 */
export const parsers = {
  /** Parse CSV or TSV text → { headers: string[], rows: (string|null)[][] } */
  csv:  parseCSV,
  /** Parse a JSON array of objects → { headers: string[], rows: (string|null)[][] } */
  json: parseJSON,
};

// ── Model registry ────────────────────────────────────────────────────

/**
 * Model registry helpers.
 *
 * @example
 * import { models } from './src/sdk/index.js';
 * models.list();                          // all ModelConfig objects
 * models.getById('openai/text-embedding-3-small');
 * models.getByProvider('voyage');
 * models.getByInputType('multimodal');
 * models.providers();                     // ['voyage', 'openai', 'gemini', 'huggingface']
 */
export const models = {
  list:           () => MODELS,
  getById:        getModelById,
  getByProvider:  getModelsByProvider,
  getByInputType: getModelsByInputType,
  providers:      getProviders,
};

// ── Low-level adapters ────────────────────────────────────────────────

/**
 * Raw provider adapters. Each has the shape:
 *   { name, embed(texts, modelName, apiKey, options?), validateApiKey(apiKey) }
 *
 * Use these when you need full control over batching and options,
 * or to integrate the HuggingFace adapter in your own Web Worker setup.
 */
export const adapters = {
  openai:       openaiAdapter,
  voyage:       voyageAdapter,
  gemini:       geminiAdapter,
  huggingface:  huggingfaceAdapter,
};

// ── Tensor utilities ──────────────────────────────────────────────────

/**
 * Encode / decode embedding vectors to TF Projector-compatible formats.
 *
 * @example
 * import { tensor } from './src/sdk/index.js';
 * const tsvString  = tensor.toTSV(vectors);
 * const buffer     = tensor.toBinary(vectors);
 * const vectors2   = tensor.fromTSV(tsvString);
 * const vectors3   = tensor.fromBinary(buffer, [N, D]);
 */
export const tensor = { toTSV, toBinary, fromTSV, fromBinary };

// ── Batching utilities ────────────────────────────────────────────────

export { createBatches, estimateTokens };

// ── Matryoshka utilities ──────────────────────────────────────────────

export { truncateEmbeddings, normalizeEmbeddings, getLegalDimensions };
