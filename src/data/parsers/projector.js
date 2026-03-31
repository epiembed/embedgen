/**
 * TensorFlow Projector format parser.
 *
 * Accepts a tensor TSV string and an optional metadata TSV string.
 * Returns { vectors: number[][], metadata: { headers: string[], rows: string[][] } | null }.
 *
 * Tensor TSV format: each line is a tab-separated list of numbers.
 * TF Projector also allows an optional non-numeric first column (a label);
 * if the first token of the first data row is not a finite number, that
 * column is treated as a label and stripped from the vectors.
 *
 * Metadata TSV format: if the first line contains a tab it is treated as a
 * header row; otherwise there is no header.
 */

/**
 * Parse a tensor TSV string.
 * @param {string} text
 * @returns {number[][]}
 */
function parseTensorTsv(text) {
  const lines = text.trim().split('\n').map(l => l.trimEnd());
  const nonEmpty = lines.filter(l => l.length > 0);

  if (nonEmpty.length === 0) {
    throw new Error('Tensor TSV is empty');
  }

  // Detect optional label column: if the first token of the first row is
  // not a finite number, assume it is a label and skip the first column.
  const firstTokens = nonEmpty[0].split('\t');
  const firstVal = Number(firstTokens[0]);
  const hasLabelColumn = !isFinite(firstVal) || isNaN(firstVal);
  const startCol = hasLabelColumn ? 1 : 0;

  const vectors = nonEmpty.map((line, i) => {
    const tokens = line.split('\t').slice(startCol);
    const nums = tokens.map((t, j) => {
      const n = Number(t);
      if (!isFinite(n)) {
        throw new Error(`Non-numeric value at row ${i + 1}, col ${startCol + j + 1}: "${t}"`);
      }
      return n;
    });
    return nums;
  });

  // Validate uniform dimensionality
  const dim = vectors[0].length;
  if (dim < 2) {
    throw new Error(`Vectors must have at least 2 dimensions, got ${dim}`);
  }
  for (let i = 1; i < vectors.length; i++) {
    if (vectors[i].length !== dim) {
      throw new Error(
        `Non-uniform dimensionality: row 1 has ${dim} dims, row ${i + 1} has ${vectors[i].length}`
      );
    }
  }

  return vectors;
}

/**
 * Parse a metadata TSV string.
 * If the first line contains a tab it is treated as a header row.
 * @param {string} text
 * @returns {{ headers: string[], rows: string[][] }}
 */
function parseMetadataTsv(text) {
  const lines = text.trim().split('\n').map(l => l.trimEnd());
  const nonEmpty = lines.filter(l => l.length > 0);

  if (nonEmpty.length === 0) {
    throw new Error('Metadata TSV is empty');
  }

  const hasHeader = nonEmpty[0].includes('\t');

  if (hasHeader) {
    const headers = nonEmpty[0].split('\t');
    const rows = nonEmpty.slice(1).map(l => l.split('\t'));
    return { headers, rows };
  }

  // Single-column metadata with no header
  const rows = nonEmpty.map(l => [l]);
  return { headers: [], rows };
}

/**
 * Parse TF Projector tensor + optional metadata files.
 * @param {string} tensorText
 * @param {string|null} [metadataText]
 * @returns {{ vectors: number[][], metadata: { headers: string[], rows: string[][] } | null }}
 */
export function parse(tensorText, metadataText = null) {
  const vectors = parseTensorTsv(tensorText);

  let metadata = null;
  if (metadataText != null) {
    metadata = parseMetadataTsv(metadataText);
    if (metadata.rows.length !== vectors.length) {
      throw new Error(
        `Row count mismatch: tensor has ${vectors.length} rows, metadata has ${metadata.rows.length}`
      );
    }
  }

  return { vectors, metadata };
}
