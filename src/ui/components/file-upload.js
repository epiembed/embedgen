/**
 * File upload component — drag-and-drop + click-to-browse.
 *
 * Usage:
 *   const el = createFileUpload({ onFile: ({ fileName, content, type }) => {} });
 *   document.getElementById('app').appendChild(el);
 */

const ACCEPTED_EXTENSIONS = ['csv', 'tsv', 'json', 'txt'];
const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.map(e => `.${e}`).join(',');

/**
 * Derive file type from filename extension.
 * @param {string} fileName
 * @returns {'csv'|'tsv'|'json'|'txt'|'unknown'}
 */
function detectType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext) ? ext : 'unknown';
}

/**
 * Read a File object as UTF-8 text.
 * @param {File} file
 * @returns {Promise<string>}
 */
function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * Process a File: read it and invoke the onFile callback.
 * @param {File} file
 * @param {function} onFile
 * @param {function} onError
 */
async function handleFile(file, onFile, onError) {
  try {
    const content = await readAsText(file);
    onFile({ fileName: file.name, content, type: detectType(file.name) });
  } catch (err) {
    onError(err.message);
  }
}

/**
 * Create the file upload drop zone element.
 * @param {{ onFile: function, onError?: function, label?: string }} options
 * @returns {HTMLElement}
 */
export function createFileUpload({ onFile, onError = () => {}, label = 'Drop a file here or click to browse' }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'file-upload';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = ACCEPT_ATTR;
  input.className = 'file-upload__input';
  input.setAttribute('aria-hidden', 'true');
  input.tabIndex = -1;

  const zone = document.createElement('div');
  zone.className = 'file-upload__zone';
  zone.setAttribute('role', 'button');
  zone.setAttribute('tabindex', '0');
  zone.setAttribute('aria-label', label);

  const icon = document.createElement('span');
  icon.className = 'file-upload__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '↑';

  const text = document.createElement('span');
  text.className = 'file-upload__label';
  text.textContent = label;

  const hint = document.createElement('span');
  hint.className = 'file-upload__hint';
  hint.textContent = 'CSV, TSV, JSON, TXT';

  zone.appendChild(icon);
  zone.appendChild(text);
  zone.appendChild(hint);
  wrapper.appendChild(zone);
  wrapper.appendChild(input);

  // Click / keyboard open
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });

  // Native file picker selection
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (file) handleFile(file, onFile, onError);
    input.value = '';
  });

  // Drag events
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('file-upload__zone--drag-over');
  });

  zone.addEventListener('dragleave', e => {
    if (!zone.contains(e.relatedTarget)) {
      zone.classList.remove('file-upload__zone--drag-over');
    }
  });

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('file-upload__zone--drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file, onFile, onError);
  });

  return wrapper;
}
