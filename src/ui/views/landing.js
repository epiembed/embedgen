/**
 * Landing view.
 * Two upload cards: "Upload Raw Data" and "Upload TF Projector Data".
 * Parses the file, validates, shows a data preview, then navigates.
 */

import { parse as parseCsv } from '../../data/parsers/csv.js';
import { parse as parseJson } from '../../data/parsers/json.js';
import { parse as parseProjector } from '../../data/parsers/projector.js';
import { run as validate } from '../../data/validators.js';
import { createFileUpload } from '../components/file-upload.js';
import { createDataPreview } from '../components/data-preview.js';
import { createSpinner } from '../components/spinner.js';
import { formatParseError } from '../errors.js';

/**
 * Auto-detect and parse raw data (CSV/TSV or JSON).
 * @param {{ fileName: string, content: string, type: string }} file
 * @returns {{ headers: string[], rows: (string|null)[][] }}
 */
function parseRaw({ content, type }) {
  if (type === 'json') return parseJson(content);
  // csv, tsv, txt — all go through the CSV parser
  return parseCsv(content);
}

/**
 * Render the landing view into `container`.
 * @param {HTMLElement} container
 * @param {object} _state
 * @param {object} store  App store (passed from main.js via partial application)
 */
export function renderLanding(container, _state, store) {
  const el = document.createElement('div');
  el.className = 'landing';

  // ── Heading ────────────────────────────────────────────────────
  const heading = document.createElement('h1');
  heading.className = 'landing__heading';
  heading.textContent = 'Generate embeddings for TensorFlow Projector';

  const sub = document.createElement('p');
  sub.className = 'landing__sub';
  sub.textContent = 'Upload your data, choose an embedding model, and export visualizable vectors.';

  el.appendChild(heading);
  el.appendChild(sub);

  // ── Cards ──────────────────────────────────────────────────────
  const cards = document.createElement('div');
  cards.className = 'landing__cards';

  cards.appendChild(buildCard({
    title: 'Upload Raw Data',
    description: "CSV, TSV, or JSON \u2014 we'll generate embeddings for you.",
    label: 'Drop a CSV, TSV, or JSON file here, or click to browse',
    onFile: file => handleRaw(file, feedbackEl, store, spinner.el),
  }));

  cards.appendChild(buildCard({
    title: 'Upload TF Projector Data',
    description: 'Already have tensors? Load a tensor TSV (and optional metadata TSV).',
    label: 'Drop a tensor TSV file here, or click to browse',
    onFile: file => handleProjector(file, feedbackEl, store, spinner.el),
  }));

  el.appendChild(cards);

  // ── Feedback (errors / warnings) ───────────────────────────────
  const feedbackEl = document.createElement('div');
  feedbackEl.className = 'landing__feedback';
  feedbackEl.setAttribute('aria-live', 'polite');
  feedbackEl.setAttribute('aria-atomic', 'true');
  el.appendChild(feedbackEl);

  // ── Parse loading spinner ──────────────────────────────────────
  const spinner = createSpinner('Parsing file…');
  spinner.el.className += ' landing__spinner';
  spinner.el.hidden = true;
  el.appendChild(spinner.el);

  // ── Data preview (shown after successful raw parse) ────────────
  const previewEl = document.createElement('div');
  previewEl.className = 'landing__preview';
  el.appendChild(previewEl);

  container.appendChild(el);
}

// ── Handlers ────────────────────────────────────────────────────────

function handleRaw(file, feedbackEl, store, spinnerEl) {
  console.log(`[embedgen:landing] handleRaw — file: "${file.fileName}", type: "${file.type}"`);
  clearFeedback(feedbackEl);
  if (spinnerEl) spinnerEl.hidden = false;
  let data;
  try {
    data = parseRaw(file);
    console.log(`[embedgen:landing] parsed — ${data.rows.length} rows × ${data.headers.length} columns`, data.headers);
  } catch (err) {
    console.error('[embedgen:landing] parse error', err);
    if (spinnerEl) spinnerEl.hidden = true;
    showError(feedbackEl, formatParseError(err, file.type));
    return;
  } finally {
    if (spinnerEl) spinnerEl.hidden = true;
  }

  // Default: embed the second column if it exists, else the first
  const defaultColumn = data.headers[1] ?? data.headers[0] ?? null;
  console.log(`[embedgen:landing] default column: "${defaultColumn}"`);
  const result = validate(data, defaultColumn);
  console.log('[embedgen:landing] validation result', result);

  if (!result.valid) {
    showError(feedbackEl, result.errors.join(' · '));
    return;
  }

  result.warnings.forEach(w => showWarning(feedbackEl, w));

  // Show data preview inline before navigating
  const preview = document.querySelector('.landing__preview');
  if (preview) {
    preview.innerHTML = '';
    preview.appendChild(createDataPreview({ data, selectedColumn: defaultColumn }));
  }

  // Pre-compute default metadata columns so configure.js doesn't need to
  // call store.setState during its render phase (which would cause infinite recursion).
  const metaColumns = data.headers.filter(h => h !== defaultColumn);

  console.log('[embedgen:landing] navigating to configure');
  store.setState({ step: 'configure', data, selectedColumn: defaultColumn, metaColumns });
}

function handleProjector(file, feedbackEl, store, spinnerEl) {
  console.log(`[embedgen:landing] handleProjector — file: "${file.fileName}"`);
  clearFeedback(feedbackEl);
  if (spinnerEl) spinnerEl.hidden = false;
  let result;
  try {
    result = parseProjector(file.content);
    console.log('[embedgen:landing] projector parsed', result);
  } catch (err) {
    console.error('[embedgen:landing] projector parse error', err);
    showError(feedbackEl, formatParseError(err, 'projector'));
    return;
  } finally {
    if (spinnerEl) spinnerEl.hidden = true;
  }
  console.log('[embedgen:landing] navigating to export (projector mode)');
  store.setState({ step: 'export', projectorData: result });
}

// ── Builders ────────────────────────────────────────────────────────

function buildCard({ title, description, label, onFile }) {
  const card = document.createElement('div');
  card.className = 'landing__card';

  const h2 = document.createElement('h2');
  h2.className = 'landing__card-title';
  h2.textContent = title;

  const p = document.createElement('p');
  p.className = 'landing__card-desc';
  p.textContent = description;

  const upload = createFileUpload({
    label,
    onFile,
    onError: msg => console.error(msg),
  });

  card.appendChild(h2);
  card.appendChild(p);
  card.appendChild(upload);
  return card;
}

// ── Feedback helpers ─────────────────────────────────────────────────

function clearFeedback(el) { el.innerHTML = ''; }

function showError(el, msg) {
  const p = document.createElement('p');
  p.className = 'landing__message landing__message--error';
  p.textContent = msg;
  el.appendChild(p);
}

function showWarning(el, msg) {
  const p = document.createElement('p');
  p.className = 'landing__message landing__message--warning';
  p.textContent = msg;
  el.appendChild(p);
}
