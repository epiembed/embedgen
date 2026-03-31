/**
 * TF Projector iframe integration.
 *
 * For GitHub-saved data: embeds the projector via ?config= URL parameter.
 * For local-only data: shows manual upload instructions + "Save to GitHub" shortcut.
 *
 * Usage:
 *   const proj = createProjectorEmbed({ configUrl, onSaveToGitHub });
 *   container.appendChild(proj.el);
 */

const PROJECTOR_BASE = 'https://projector.tensorflow.org/';

/**
 * Build the full TF Projector URL for a given config URL.
 * @param {string} configUrl  raw.githubusercontent.com URL to config.json
 * @returns {string}
 */
export function buildProjectorUrl(configUrl) {
  return `${PROJECTOR_BASE}?config=${encodeURIComponent(configUrl)}`;
}

/**
 * Create the projector embed component.
 *
 * @param {object}   opts
 * @param {string|null} opts.configUrl       raw GitHub config URL, or null for local-only
 * @param {Function} [opts.onSaveToGitHub]   called when user clicks "Save to GitHub" in fallback
 * @returns {{ el: HTMLElement }}
 */
export function createProjectorEmbed({ configUrl, onSaveToGitHub }) {
  const el = document.createElement('div');
  el.className = 'projector-embed';

  if (configUrl) {
    _buildIframeMode(el, configUrl);
  } else {
    _buildFallbackMode(el, onSaveToGitHub);
  }

  return { el };
}

// ── iframe mode ───────────────────────────────────────────────────────

function _buildIframeMode(el, configUrl) {
  const projectorUrl = buildProjectorUrl(configUrl);

  // "Open in new tab" button
  const toolbar = document.createElement('div');
  toolbar.className = 'projector-embed__toolbar';

  const openBtn = document.createElement('a');
  openBtn.className = 'projector-embed__open-btn btn btn--secondary';
  openBtn.href = projectorUrl;
  openBtn.target = '_blank';
  openBtn.rel = 'noopener noreferrer';
  openBtn.textContent = 'Open in new tab ↗';
  toolbar.appendChild(openBtn);

  el.appendChild(toolbar);

  // iframe
  const iframe = document.createElement('iframe');
  iframe.className = 'projector-embed__iframe';
  iframe.src = projectorUrl;
  iframe.title = 'TensorFlow Embedding Projector';
  iframe.allow = 'accelerometer; webgl';
  // No sandbox — projector needs scripts, popups, and same-origin storage
  iframe.setAttribute('loading', 'lazy');

  el.appendChild(iframe);
}

// ── fallback mode (local-only / no GitHub) ────────────────────────────

function _buildFallbackMode(el, onSaveToGitHub) {
  el.classList.add('projector-embed--fallback');

  const icon = document.createElement('div');
  icon.className = 'projector-embed__fallback-icon';
  icon.textContent = '📊';
  el.appendChild(icon);

  const heading = document.createElement('h3');
  heading.className = 'projector-embed__fallback-heading';
  heading.textContent = 'Visualization requires public data';
  el.appendChild(heading);

  const body = document.createElement('p');
  body.className = 'projector-embed__fallback-body';
  body.textContent =
    'The TF Projector loads data from public URLs. ' +
    'Save your embeddings to a public GitHub repo to enable in-app visualization.';
  el.appendChild(body);

  if (onSaveToGitHub) {
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'projector-embed__save-btn btn btn--primary';
    saveBtn.textContent = 'Save to GitHub';
    saveBtn.addEventListener('click', onSaveToGitHub);
    el.appendChild(saveBtn);
  }

  // Manual upload instructions
  const details = document.createElement('details');
  details.className = 'projector-embed__manual';

  const summary = document.createElement('summary');
  summary.textContent = 'Upload manually instead';
  details.appendChild(summary);

  const steps = document.createElement('ol');
  steps.className = 'projector-embed__manual-steps';
  [
    'Download your ZIP from the export view.',
    'Unzip it — you\'ll find tensors.tsv and metadata.tsv.',
    'Visit projector.tensorflow.org.',
    'Click "Load data" in the left panel.',
    'Upload tensors.tsv as the tensor file and metadata.tsv as the metadata file.',
  ].forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    steps.appendChild(li);
  });
  details.appendChild(steps);

  const link = document.createElement('a');
  link.href = 'https://projector.tensorflow.org/';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'projector-embed__manual-link btn btn--secondary';
  link.textContent = 'Open TF Projector ↗';
  details.appendChild(link);

  el.appendChild(details);
}
