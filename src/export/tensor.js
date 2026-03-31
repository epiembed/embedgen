/**
 * Tensor encoder/decoder.
 * Converts number[][] embeddings to/from TF Projector-compatible formats.
 *
 * TSV format:    each row is tab-separated numbers, rows separated by \n. No header.
 * Binary format: flat Float32Array in row-major order (N × D × 4 bytes).
 */

/**
 * Encode vectors to TSV string.
 * @param {number[][]} vectors
 * @returns {string}
 */
export function toTSV(vectors) {
  return vectors.map(v => v.join('\t')).join('\n');
}

/**
 * Encode vectors to a binary ArrayBuffer (Float32, row-major).
 * @param {number[][]} vectors
 * @returns {ArrayBuffer}
 */
export function toBinary(vectors) {
  const n = vectors.length;
  const d = vectors[0]?.length ?? 0;
  const buffer = new ArrayBuffer(n * d * 4);
  const view = new Float32Array(buffer);
  let offset = 0;
  for (const vec of vectors) {
    for (const val of vec) {
      view[offset++] = val;
    }
  }
  return buffer;
}

/**
 * Decode TSV string back to vectors.
 * @param {string} tsvString
 * @returns {number[][]}
 */
export function fromTSV(tsvString) {
  return tsvString
    .trim()
    .split('\n')
    .filter(line => line.length > 0)
    .map(line => line.split('\t').map(Number));
}

/**
 * Decode a binary ArrayBuffer back to vectors.
 * @param {ArrayBuffer} buffer
 * @param {[number, number]} shape  [N, D]
 * @returns {number[][]}
 */
export function fromBinary(buffer, [n, d]) {
  const view = new Float32Array(buffer);
  const vectors = [];
  for (let i = 0; i < n; i++) {
    vectors.push(Array.from(view.subarray(i * d, (i + 1) * d)));
  }
  return vectors;
}
