/**
 * HuggingFace in-browser embedding adapter.
 * Runs inference in a Web Worker via Transformers.js + ONNX Runtime.
 * No API key required. Model files are cached in the browser after first download.
 */

import { EmbeddingError } from './provider.js';

/**
 * Create a Worker and return a promise-based message interface.
 * @returns {{ worker: Worker, send: (msg) => Promise<any>, terminate: () => void }}
 */
function createWorker() {
  const worker = new Worker(
    new URL('../workers/embedding-worker.js', import.meta.url),
    { type: 'module' }
  );

  // Pending promise map keyed by a correlation id
  let pending = null;

  worker.addEventListener('message', ({ data }) => {
    if (pending && (data.type === 'ready' || data.type === 'result' || data.type === 'error')) {
      const { resolve, reject } = pending;
      pending = null;
      if (data.type === 'error') reject(new EmbeddingError(data.message));
      else resolve(data);
    }
    // progress messages are handled by callers via onProgress
  });

  // Allow callers to tap progress without consuming the pending slot
  const progressListeners = new Set();
  worker.addEventListener('message', ({ data }) => {
    if (data.type === 'progress') {
      for (const fn of progressListeners) fn(data);
    }
  });

  function send(msg) {
    return new Promise((resolve, reject) => {
      pending = { resolve, reject };
      worker.postMessage(msg);
    });
  }

  function terminate() {
    worker.postMessage({ type: 'cancel' });
    worker.terminate();
  }

  return { worker, send, terminate, progressListeners };
}

// ── Public adapter ────────────────────────────────────────────────────

let activeWorkerHandle = null;

/**
 * Embed texts in-browser using a HuggingFace model.
 *
 * @param {string[]} texts
 * @param {string} modelName  HF Hub model ID, e.g. 'Xenova/all-MiniLM-L6-v2'
 * @param {string} _apiKey    Ignored — no key needed for in-browser models
 * @param {{
 *   onProgress?: (info: { file: string, loaded: number, total: number }) => void,
 * }} [options]
 * @returns {Promise<number[][]>}
 */
async function embed(texts, modelName, _apiKey, options = {}) {
  // Terminate any previous worker (model switch or retry)
  if (activeWorkerHandle) {
    activeWorkerHandle.terminate();
    activeWorkerHandle = null;
  }

  const handle = createWorker();
  activeWorkerHandle = handle;

  if (options.onProgress) {
    handle.progressListeners.add(options.onProgress);
  }

  // Init — downloads model if not cached
  await handle.send({ type: 'init', modelId: modelName });

  // Embed in a single call (caller's batcher handles chunking)
  const result = await handle.send({ type: 'embed', texts, batchIndex: 0, modelId: modelName });

  handle.terminate();
  activeWorkerHandle = null;

  return result.vectors;
}

/**
 * HuggingFace models need no API key — always returns true.
 * @returns {Promise<boolean>}
 */
async function validateApiKey() {
  return true;
}

export const adapter = { name: 'huggingface', embed, validateApiKey };
