/**
 * Intelligent batcher.
 * Splits an array of texts into batches that respect both a max item count
 * and a max token budget per batch.
 *
 * Token estimation: characters / 4 (standard heuristic for Latin-script text).
 */

/**
 * Estimate the number of tokens in a string.
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Split texts into batches respecting maxBatchSize and maxTokensPerBatch.
 *
 * Rules:
 * - A batch never exceeds maxBatchSize items.
 * - A batch never exceeds maxTokensPerBatch tokens in total.
 * - A single text that alone exceeds maxTokensPerBatch gets its own batch
 *   (we cannot split individual texts).
 *
 * @param {string[]} texts
 * @param {number} maxBatchSize        Max number of items per batch
 * @param {number} [maxTokensPerBatch] Max total tokens per batch (omit or Infinity to disable)
 * @returns {string[][]}
 */
export function createBatches(texts, maxBatchSize, maxTokensPerBatch = Infinity) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const batches = [];
  let current = [];
  let currentTokens = 0;

  for (const text of texts) {
    const tokens = estimateTokens(text);

    const wouldExceedSize   = current.length >= maxBatchSize;
    const wouldExceedTokens = currentTokens + tokens > maxTokensPerBatch;

    if (current.length > 0 && (wouldExceedSize || wouldExceedTokens)) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }

    current.push(text);
    currentTokens += tokens;
  }

  if (current.length > 0) batches.push(current);

  return batches;
}
