/**
 * Metadata TSV encoder.
 *
 * TF Projector metadata format:
 *   - Multi-column: first line is a tab-separated header, subsequent lines are values.
 *   - Single-column: no header row — just one value per line.
 *
 * null/undefined values are written as empty strings.
 */

/**
 * Encode metadata to TSV.
 * @param {string[]} headers
 * @param {(string|null)[][]} rows
 * @returns {string}
 */
export function toTSV(headers, rows) {
  const sanitize = v => (v === null || v === undefined) ? '' : String(v).replace(/\t/g, ' ').replace(/\r?\n/g, ' ');

  if (headers.length === 1) {
    // Single-column: no header row
    return rows.map(row => sanitize(row[0])).join('\n');
  }

  const headerLine = headers.map(h => sanitize(h)).join('\t');
  const dataLines = rows.map(row => headers.map((_, i) => sanitize(row[i])).join('\t'));
  return [headerLine, ...dataLines].join('\n');
}
