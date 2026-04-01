/**
 * Model download progress component.
 * Shown only for HuggingFace models during their first use.
 * Each model file gets its own row that fills as bytes arrive.
 * Hidden automatically once all files are complete.
 *
 * Usage:
 *   const dp = createDownloadProgress();
 *   container.appendChild(dp.el);
 *   dp.onProgress({ file: 'model.onnx', loaded: 512000, total: 23000000 });
 *   dp.complete(); // hides the component
 */

/**
 * @returns {{
 *   el: HTMLElement,
 *   onProgress: (info: { file: string, loaded: number, total: number }) => void,
 *   complete: () => void,
 * }}
 */
export function createDownloadProgress() {
  const el = document.createElement('div');
  el.className = 'download-progress';

  const heading = document.createElement('p');
  heading.className = 'download-progress__heading';
  heading.textContent = 'Downloading model…';
  el.appendChild(heading);

  const hint = document.createElement('p');
  hint.className = 'download-progress__hint';
  hint.textContent = 'This only happens once — files are cached in your browser.';
  el.appendChild(hint);

  const fileList = document.createElement('div');
  fileList.className = 'download-progress__files';
  fileList.setAttribute('aria-live', 'polite');
  fileList.setAttribute('aria-atomic', 'false');
  el.appendChild(fileList);

  // Track per-file state
  const files = new Map(); // fileName → { rowEl, fillEl, labelEl }

  function onProgress({ file, loaded, total }) {
    const name = file.split('/').pop(); // show only the filename

    if (!files.has(name)) {
      // First progress event for this file — create a row
      const row = document.createElement('div');
      row.className = 'download-progress__file';

      const nameEl = document.createElement('span');
      nameEl.className = 'download-progress__file-name';
      nameEl.textContent = name;

      const track = document.createElement('div');
      track.className = 'download-progress__track';

      const fill = document.createElement('div');
      fill.className = 'download-progress__fill';
      fill.style.width = '0%';
      track.appendChild(fill);

      const sizeEl = document.createElement('span');
      sizeEl.className = 'download-progress__size';

      row.appendChild(nameEl);
      row.appendChild(track);
      row.appendChild(sizeEl);
      fileList.appendChild(row);

      files.set(name, { row, fill, sizeEl });
    }

    const { fill, sizeEl } = files.get(name);
    const pct = total > 0 ? (loaded / total) * 100 : 0;
    fill.style.width = `${pct.toFixed(1)}%`;
    sizeEl.textContent = total > 0
      ? `${formatBytes(loaded)} / ${formatBytes(total)}`
      : formatBytes(loaded);
  }

  function complete() {
    el.hidden = true;
  }

  return { el, onProgress, complete };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
