/**
 * Download handler.
 *
 * - Single-file mode: TSV with optional label column prepended (drag-and-drop into TF Projector).
 * - Full export mode: ZIP containing tensors.tsv, metadata.tsv, config.json.
 */

import { zipSync, strToU8 } from 'fflate';

/**
 * Trigger a browser download for any Blob or string content.
 * @param {Blob|string} content
 * @param {string} filename
 * @param {string} [mimeType]
 */
export function triggerDownload(content, filename, mimeType = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Build a single combined TSV for drag-and-drop into TF Projector.
 * If labels are provided, each row is: label\tv1\tv2\t...
 * Otherwise each row is just the tab-separated vector values.
 *
 * @param {number[][]} vectors
 * @param {string[]}   [labels]  - Optional first-column labels (one per vector).
 * @returns {string}
 */
export function buildSingleFileTSV(vectors, labels) {
  return vectors
    .map((vec, i) => {
      const values = vec.join('\t');
      return labels ? `${labels[i] ?? ''}\t${values}` : values;
    })
    .join('\n');
}

/**
 * Build a ZIP archive containing tensors.tsv, metadata.tsv, and config.json.
 *
 * @param {Object} opts
 * @param {string} opts.tensorsTSV   - Tensor TSV string.
 * @param {string} opts.metadataTSV  - Metadata TSV string.
 * @param {object} opts.config       - ProjectorConfig object (will be JSON-stringified).
 * @returns {Uint8Array}  ZIP bytes.
 */
export function buildZip({ tensorsTSV, metadataTSV, config }) {
  return zipSync({
    'tensors.tsv': strToU8(tensorsTSV),
    'metadata.tsv': strToU8(metadataTSV),
    'config.json': strToU8(JSON.stringify(config, null, 2)),
  });
}
