/**
 * Matryoshka dimension handler.
 *
 * For cloud providers (OpenAI, Voyage, Gemini) dimension reduction is handled
 * server-side via an API parameter — this module only handles client-side
 * truncation needed for HuggingFace models.
 *
 * After slicing, vectors must be L2-normalized so cosine similarity still works.
 */

import { getModelById } from '../config/models.js';

/**
 * Return the legal Matryoshka dimension values for a model.
 * - If the model does not support Matryoshka, returns [model.dimensions] (full dims only).
 * - If matryoshkaDimensions is null (any value ≤ max), returns null to signal
 *   "accept any integer" (callers should apply their own validation).
 * - Otherwise returns the explicit discrete stops from the registry.
 *
 * @param {string} modelId
 * @returns {number[]|null}
 */
export function getLegalDimensions(modelId) {
  const model = getModelById(modelId);
  if (!model) throw new Error(`Unknown model: "${modelId}"`);
  if (!model.supportsMatryoshka) return [model.dimensions];
  return model.matryoshkaDimensions; // null means any value ≤ model.dimensions
}

/**
 * Slice each vector to targetDim dimensions.
 * Does not normalize — call normalizeEmbeddings afterwards if needed.
 *
 * @param {number[][]} vectors
 * @param {number} targetDim
 * @returns {number[][]}
 */
export function truncateEmbeddings(vectors, targetDim) {
  if (!Number.isInteger(targetDim) || targetDim < 1) {
    throw new Error(`targetDim must be a positive integer, got: ${targetDim}`);
  }
  return vectors.map(v => {
    if (targetDim >= v.length) return v;
    return v.slice(0, targetDim);
  });
}

/**
 * L2-normalize each vector in place (returns new arrays).
 * A zero vector is returned unchanged.
 *
 * @param {number[][]} vectors
 * @returns {number[][]}
 */
export function normalizeEmbeddings(vectors) {
  return vectors.map(v => {
    const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    if (norm === 0) return v;
    return v.map(x => x / norm);
  });
}
