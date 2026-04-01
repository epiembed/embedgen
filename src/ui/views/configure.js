/**
 * Configure view.
 * Lets the user pick: the column to embed, metadata columns, embedding model,
 * API key, and output dimensions. Transitions to the embed view on submit.
 */

import { MODELS, getModelById } from '../../config/models.js';
import { createModelSelector, getSelectedModelId } from '../components/model-selector.js';
import { createApiKeyInput, getApiKey } from '../components/api-key-input.js';
import { createDimensionSlider, updateDimensionSlider, getSelectedDimension } from '../components/dimension-slider.js';
import { createDataPreview, updateDataPreview } from '../components/data-preview.js';
import { adapter as openaiAdapter } from '../../embeddings/openai.js';
import { adapter as voyageAdapter } from '../../embeddings/voyage.js';
import { adapter as geminiAdapter } from '../../embeddings/gemini.js';
import { adapter as huggingfaceAdapter } from '../../embeddings/huggingface.js';

const ADAPTERS = {
  openai:      openaiAdapter,
  voyage:      voyageAdapter,
  gemini:      geminiAdapter,
  huggingface: huggingfaceAdapter,
};

/**
 * @param {HTMLElement} container
 * @param {object} state
 * @param {object} store
 */
export function renderConfigure(container, state, store) {
  const { data, selectedColumn } = state;
  const el = document.createElement('div');
  el.className = 'configure';

  // ── Back link ───────────────────────────────────────────────────
  const back = document.createElement('button');
  back.className = 'configure__back';
  back.textContent = '← Back';
  back.setAttribute('aria-label', 'Back to upload');
  back.addEventListener('click', () => store.setState({ step: 'landing' }));
  el.appendChild(back);

  const heading = document.createElement('h1');
  heading.className = 'configure__heading';
  heading.textContent = 'Configure embeddings';
  el.appendChild(heading);

  // ── Image column detection ──────────────────────────────────────
  const imageColumns = detectImageColumns(data);
  const isImageColumn = col => col !== null && imageColumns.has(col);

  // ── Preview ─────────────────────────────────────────────────────
  const previewEl = createDataPreview({ data, selectedColumn, maxRows: 5, imageColumns });
  previewEl.className += ' configure__preview';

  // ── Section: Column selection ───────────────────────────────────
  el.appendChild(buildSection('Embedding column', buildColumnSelector(data, selectedColumn, store, previewEl, onColumnChange)));

  // ── Section: Metadata columns ───────────────────────────────────
  el.appendChild(buildSection('Metadata columns', buildMetaSelector(data, selectedColumn, state.metaColumns, store)));

  el.appendChild(buildSection('Data preview', previewEl));

  // ── Section: Model ──────────────────────────────────────────────
  const defaultModelId = MODELS[0].id;
  let currentModelId = state.modelId ?? defaultModelId;

  const dimSlider = createDimensionSlider({
    modelId: currentModelId,
    onChange: dim => store.setState({ dimensions: dim }),
  });

  const apiKeyWrapper = document.createElement('div');
  renderApiKeyInput(apiKeyWrapper, currentModelId);

  // Privacy banner — shown only for HuggingFace models
  const privacyBanner = buildPrivacyBanner();
  privacyBanner.hidden = getModelById(currentModelId)?.provider !== 'huggingface';

  // API key section — title adapts for HF
  const apiKeySection = buildSection('API key', apiKeyWrapper);

  // Model selector lives in a wrapper so it can be rebuilt on column change
  const modelSelectorWrapper = document.createElement('div');
  let modelSelector;

  function buildModelSelector(allowedInputTypes) {
    modelSelectorWrapper.innerHTML = '';
    const sel = createModelSelector({
      selectedId: currentModelId,
      allowedInputTypes,
      onChange: modelId => {
        currentModelId = modelId;
        const model = getModelById(modelId);
        const isHF = model?.provider === 'huggingface';
        store.setState({ modelId, apiKey: '', dimensions: null });
        updateDimensionSlider(dimSlider, modelId);
        renderApiKeyInput(apiKeyWrapper, modelId);
        privacyBanner.hidden = !isHF;
        apiKeySection.querySelector('.configure__section-title').textContent =
          isHF ? 'Runtime' : 'API key';
      },
    });
    modelSelectorWrapper.appendChild(sel);
    modelSelector = sel;
    return sel;
  }

  buildModelSelector(isImageColumn(selectedColumn) ? ['multimodal'] : null);

  // Set initial section title
  if (getModelById(currentModelId)?.provider === 'huggingface') {
    apiKeySection.querySelector('.configure__section-title').textContent = 'Runtime';
  }

  // Image mode notice
  const imageModeNotice = document.createElement('p');
  imageModeNotice.className = 'configure__image-mode-notice';
  imageModeNotice.textContent = 'Image column detected — showing multimodal models only. OpenAI models are text-only and are hidden.';
  imageModeNotice.hidden = !isImageColumn(selectedColumn);
  imageModeNotice.setAttribute('aria-live', 'polite');

  el.appendChild(buildSection('Model', modelSelectorWrapper));
  el.appendChild(imageModeNotice);
  el.appendChild(privacyBanner);
  el.appendChild(apiKeySection);
  el.appendChild(buildSection('Output dimensions', dimSlider));

  // ── Column change handler ───────────────────────────────────────
  function onColumnChange(col) {
    const imgMode = isImageColumn(col);
    updateDataPreview(previewEl, { selectedColumn: col, imageColumns });
    buildModelSelector(imgMode ? ['multimodal'] : null);
    imageModeNotice.hidden = !imgMode;
  }

  // ── Submit ──────────────────────────────────────────────────────
  const errorEl = document.createElement('p');
  errorEl.className = 'configure__error';

  const submitBtn = document.createElement('button');
  submitBtn.className = 'configure__submit';
  submitBtn.textContent = 'Generate Embeddings';

  submitBtn.addEventListener('click', () => {
    errorEl.textContent = '';
    const modelId = getSelectedModelId(modelSelector);
    const model = getModelById(modelId);
    const apiKey = getApiKey(apiKeyWrapper);
    const dimensions = getSelectedDimension(dimSlider);
    const embedColumn = store.getState().selectedColumn;
    const metaCols = store.getState().metaColumns ?? [];

    if (!model) { errorEl.textContent = 'Select a model.'; return; }
    if (model.provider !== 'huggingface' && !apiKey.trim()) {
      errorEl.textContent = 'Enter an API key.'; return;
    }
    if (!embedColumn) { errorEl.textContent = 'Select a column to embed.'; return; }

    store.setState({
      step: 'embed',
      modelId,
      apiKey,
      dimensions,
      metaColumns: metaCols,
    });
  });

  el.appendChild(errorEl);
  el.appendChild(submitBtn);
  container.appendChild(el);
}

// ── Image column detection ────────────────────────────────────────────

/**
 * Return the set of column names whose values are mostly http/https URLs.
 * A column qualifies if ≥50% of non-null values parse as http/https URLs.
 * @param {{ headers: string[], rows: (string|null)[][] }} data
 * @returns {Set<string>}
 */
export function detectImageColumns(data) {
  const result = new Set();
  data.headers.forEach((h, i) => {
    const vals = data.rows.map(r => r[i]).filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    if (vals.length === 0) return;
    const urlCount = vals.filter(v => {
      try { const u = new URL(String(v).trim()); return u.protocol === 'http:' || u.protocol === 'https:'; }
      catch { return false; }
    }).length;
    if (urlCount / vals.length >= 0.5) result.add(h);
  });
  return result;
}

// ── Builders ──────────────────────────────────────────────────────────

function buildSection(title, content) {
  const section = document.createElement('div');
  section.className = 'configure__section';
  const h2 = document.createElement('h2');
  h2.className = 'configure__section-title';
  h2.textContent = title;
  section.appendChild(h2);
  section.appendChild(content);
  return section;
}

function buildColumnSelector(data, selectedColumn, store, previewEl, onColumnChange) {
  const wrapper = document.createElement('div');
  wrapper.className = 'configure__col-select-wrap';

  const label = document.createElement('label');
  label.className = 'configure__col-label';
  label.textContent = 'Column to embed';
  label.htmlFor = 'configure-embed-col';

  const select = document.createElement('select');
  select.id = 'configure-embed-col';
  select.className = 'configure__col-select';

  data.headers.forEach(h => {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = h;
    if (h === selectedColumn) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener('change', () => {
    store.setState({ selectedColumn: select.value });
    if (previewEl) updateDataPreview(previewEl, { selectedColumn: select.value });
    onColumnChange?.(select.value);
  });

  wrapper.appendChild(label);
  wrapper.appendChild(select);
  return wrapper;
}

function buildMetaSelector(data, selectedColumn, initialMetaColumns, store) {
  const wrapper = document.createElement('div');
  wrapper.className = 'configure__meta-wrap';
  wrapper.setAttribute('role', 'group');
  wrapper.setAttribute('aria-label', 'Metadata columns');

  const hint = document.createElement('p');
  hint.className = 'configure__meta-hint';
  hint.textContent = 'Select which columns to include as metadata labels in the visualizer.';
  wrapper.appendChild(hint);

  const metaSet = new Set(initialMetaColumns ?? data.headers.filter(h => h !== selectedColumn));
  const checkboxes = [];
  data.headers.forEach(h => {
    const row = document.createElement('label');
    row.className = 'configure__meta-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = h;
    cb.checked = metaSet.has(h);
    checkboxes.push(cb);

    const span = document.createElement('span');
    span.textContent = h;

    row.appendChild(cb);
    row.appendChild(span);
    wrapper.appendChild(row);
  });

  // Update store only on user interaction, never during render
  wrapper.addEventListener('change', () => {
    store.setState({ metaColumns: checkboxes.filter(cb => cb.checked).map(cb => cb.value) });
  });

  return wrapper;
}

function buildPrivacyBanner() {
  const banner = document.createElement('div');
  banner.className = 'configure__privacy-banner';

  const icon = document.createElement('span');
  icon.className = 'configure__privacy-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '🔒';

  const text = document.createElement('div');
  text.className = 'configure__privacy-text';

  const strong = document.createElement('strong');
  strong.textContent = 'Your data stays in your browser.';

  const p = document.createElement('p');
  p.textContent = 'This model runs entirely on your device using WebAssembly (or WebGPU if available). No text is sent to any server.';

  text.appendChild(strong);
  text.appendChild(p);
  banner.appendChild(icon);
  banner.appendChild(text);
  return banner;
}

function renderApiKeyInput(container, modelId) {
  container.innerHTML = '';
  const model = getModelById(modelId);
  if (!model) return;

  const adapter = ADAPTERS[model.provider] ?? null;

  // onChange is omitted — the key is read from the DOM at submit time via getApiKey()
  // Calling store.setState here on every keystroke would re-render the whole view.
  const input = createApiKeyInput({
    provider: model.provider,
    onValidate: adapter ? key => adapter.validateApiKey(key) : null,
  });
  container.appendChild(input);
}
