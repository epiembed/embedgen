/**
 * HuggingFace embedding Web Worker.
 *
 * Message protocol (main → worker):
 *   { type: 'init',   modelId: string }
 *   { type: 'embed',  texts: string[], batchIndex: number }
 *   { type: 'cancel' }
 *
 * Message protocol (worker → main):
 *   { type: 'ready' }
 *   { type: 'progress', file: string, loaded: number, total: number }
 *   { type: 'result',   vectors: number[][], batchIndex: number }
 *   { type: 'error',    message: string }
 */

import { pipeline, env } from '@huggingface/transformers';

// Allow remote model downloads; cache in browser Cache API
env.allowRemoteModels = true;
env.useBrowserCache = true;

let pipe = null;
let cancelled = false;

// Models that require mean pooling + L2 normalization as post-processing.
// (Some models, e.g. nomic, handle normalization internally via pooling config.)
const NEEDS_POOLING = new Set([
  'Xenova/all-MiniLM-L6-v2',
  'Xenova/bge-small-en-v1.5',
  'Xenova/gte-small',
  'mixedbread-ai/mxbai-embed-xsmall-v1',
]);

/**
 * Mean-pool a [seq_len, hidden] tensor output into a [hidden] vector.
 * Transformers.js returns a Tensor with .data (Float32Array) and .dims.
 * @param {object} output  Tensor from pipeline
 * @returns {number[]}
 */
function meanPool(output) {
  const [, seqLen, hidden] = output.dims;
  const data = output.data;
  const pooled = new Array(hidden).fill(0);
  for (let t = 0; t < seqLen; t++) {
    for (let h = 0; h < hidden; h++) {
      pooled[h] += data[t * hidden + h];
    }
  }
  for (let h = 0; h < hidden; h++) pooled[h] /= seqLen;
  return pooled;
}

/**
 * L2-normalize a vector.
 * @param {number[]} vec
 * @returns {number[]}
 */
function l2Normalize(vec) {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
  if (norm === 0) return vec;
  return vec.map(x => x / norm);
}

/**
 * Extract embedding vectors from the pipeline output.
 * The output shape varies by model; Transformers.js returns either:
 *   - A Tensor directly (single text)
 *   - An object with .last_hidden_state or .pooler_output
 * We always get a batch, so output is [batch, seq_len, hidden] or [batch, hidden].
 */
function extractVectors(output, modelId, batchSize) {
  const needsPooling = NEEDS_POOLING.has(modelId);
  const vectors = [];

  for (let i = 0; i < batchSize; i++) {
    // output[i] is a Tensor of shape [seq_len, hidden] or [hidden]
    const item = output[i];
    let vec;

    if (item.dims.length === 2 && needsPooling) {
      // [seq_len, hidden] — mean pool then normalize
      vec = l2Normalize(meanPool(item));
    } else if (item.dims.length === 2) {
      // [seq_len, hidden] — some models already pool via config; take first token (CLS)
      const hidden = item.dims[1];
      vec = l2Normalize(Array.from(item.data.slice(0, hidden)));
    } else {
      // [hidden] — already pooled
      vec = l2Normalize(Array.from(item.data));
    }

    vectors.push(vec);
  }
  return vectors;
}

self.addEventListener('message', async ({ data }) => {
  if (data.type === 'cancel') {
    cancelled = true;
    return;
  }

  if (data.type === 'init') {
    cancelled = false;
    const { modelId } = data;

    try {
      // Attempt WebGPU; fall back to WASM if unavailable
      const device = (typeof navigator !== 'undefined' && navigator.gpu)
        ? 'webgpu'
        : 'wasm';

      pipe = await pipeline('feature-extraction', modelId, {
        device,
        progress_callback: progress => {
          if (progress.status === 'progress') {
            self.postMessage({
              type: 'progress',
              file: progress.file,
              loaded: progress.loaded,
              total: progress.total,
            });
          }
        },
      });

      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
    return;
  }

  if (data.type === 'embed') {
    if (cancelled) return;
    const { texts, batchIndex, modelId } = data;

    try {
      const output = await pipe(texts, { pooling: 'none', normalize: false });
      const vectors = extractVectors(output, modelId, texts.length);
      self.postMessage({ type: 'result', vectors, batchIndex });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }
});
