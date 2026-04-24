/**
 * File upload component — drag-and-drop + click-to-browse.
 * After a file is read, the drop zone is replaced by a success row
 * showing the filename and a checkmark, with a "Change" button.
 */

const ACCEPTED_EXTENSIONS = ['csv', 'tsv', 'json', 'txt'];
const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.map(e => `.${e}`).join(',');

function detectType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext) ? ext : 'unknown';
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file, 'utf-8');
  });
}

export function createFileUpload({ onFile, onError = () => {}, label = 'Drop a file here or click to browse' }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'file-upload';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = ACCEPT_ATTR;
  input.className = 'file-upload__input';
  input.setAttribute('aria-hidden', 'true');
  input.tabIndex = -1;

  // ── Drop zone ──────────────────────────────────────────────────────
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

  // ── Success state ──────────────────────────────────────────────────
  const successEl = document.createElement('div');
  successEl.className = 'file-upload__success';
  successEl.hidden = true;

  const successName = document.createElement('span');
  successName.className = 'file-upload__success-name';

  successEl.appendChild(successName);

  wrapper.appendChild(zone);
  wrapper.appendChild(successEl);
  wrapper.appendChild(input);

  function showLoading() {
    successEl.hidden = true;
    zone.hidden = false;
    wrapper.classList.add('file-upload--loading');
    zone.setAttribute('aria-busy', 'true');
    text.textContent = 'Reading file…';
    icon.textContent = '…';
  }

  function showZone() {
    wrapper.classList.remove('file-upload--loading');
    zone.setAttribute('aria-busy', 'false');
    text.textContent = label;
    icon.textContent = '↑';
    zone.hidden = false;
    successEl.hidden = true;
  }

  async function handleFile(file) {
    showLoading();
    try {
      const content = await readAsText(file);
      successName.textContent = file.name;
      zone.hidden = true;
      wrapper.classList.remove('file-upload--loading');
      successEl.hidden = false;
      onFile({ fileName: file.name, content, type: detectType(file.name) });
    } catch (err) {
      showZone();
      onError(err.message);
    }
  }

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (file) handleFile(file);
    input.value = '';
  });

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('file-upload__zone--drag-over');
  });

  zone.addEventListener('dragleave', e => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove('file-upload__zone--drag-over');
  });

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('file-upload__zone--drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  return wrapper;
}
