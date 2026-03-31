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
  back.addEventListener('click', () => store.setState({ step: 'landing' }));
  el.appendChild(back);

  const heading = document.createElement('h1');
  heading.className = 'configure__heading';
  heading.textContent = 'Configure embeddings';
  el.appendChild(heading);

  // ── Section: Column selection ───────────────────────────────────
  el.appendChild(buildSection('Embedding column', buildColumnSelector(data, selectedColumn, store, previewEl)));

  // ── Section: Metadata columns ───────────────────────────────────
  el.appendChild(buildSection('Metadata columns', buildMetaSelector(data, selectedColumn, store)));

  // ── Preview ─────────────────────────────────────────────────────
  const previewEl = createDataPreview({ data, selectedColumn, maxRows: 5 });
  previewEl.className += ' configure__preview';
  el.appendChild(buildSection('Data preview', previewEl));

  // ── Section: Model ──────────────────────────────────────────────
  const defaultModelId = MODELS[0].id;
  let currentModelId = state.modelId ?? defaultModelId;

  const dimSlider = createDimensionSlider({
    modelId: currentModelId,
    onChange: dim => store.setState({ dimensions: dim }),
  });

  const apiKeyWrapper = document.createElement('div');
  renderApiKeyInput(apiKeyWrapper, currentModelId, store);

  // Privacy banner — shown only for HuggingFace models
  const privacyBanner = buildPrivacyBanner();
  privacyBanner.hidden = getModelById(currentModelId)?.provider !== 'huggingface';

  // API key section — title adapts for HF
  const apiKeySection = buildSection('API key', apiKeyWrapper);

  const modelSelector = createModelSelector({
    selectedId: currentModelId,
    onChange: modelId => {
      currentModelId = modelId;
      const model = getModelById(modelId);
      const isHF = model?.provider === 'huggingface';
      store.setState({ modelId, apiKey: '', dimensions: null });
      updateDimensionSlider(dimSlider, modelId);
      renderApiKeyInput(apiKeyWrapper, modelId, store);
      privacyBanner.hidden = !isHF;
      apiKeySection.querySelector('.configure__section-title').textContent =
        isHF ? 'Runtime' : 'API key';
    },
  });

  // Set initial section title
  if (getModelById(currentModelId)?.provider === 'huggingface') {
    apiKeySection.querySelector('.configure__section-title').textContent = 'Runtime';
  }

  el.appendChild(buildSection('Model', modelSelector));
  el.appendChild(privacyBanner);
  el.appendChild(apiKeySection);
  el.appendChild(buildSection('Output dimensions', dimSlider));

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

function buildColumnSelector(data, selectedColumn, store, previewEl) {
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
  });

  wrapper.appendChild(label);
  wrapper.appendChild(select);
  return wrapper;
}

function buildMetaSelector(data, selectedColumn, store) {
  const wrapper = document.createElement('div');
  wrapper.className = 'configure__meta-wrap';

  const hint = document.createElement('p');
  hint.className = 'configure__meta-hint';
  hint.textContent = 'Select which columns to include as metadata labels in the visualizer.';
  wrapper.appendChild(hint);

  const checkboxes = [];
  data.headers.forEach(h => {
    const row = document.createElement('label');
    row.className = 'configure__meta-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = h;
    cb.checked = h !== selectedColumn; // default: all non-embed cols
    checkboxes.push(cb);

    const span = document.createElement('span');
    span.textContent = h;

    row.appendChild(cb);
    row.appendChild(span);
    wrapper.appendChild(row);
  });

  // Initialise state with defaults
  store.setState({ metaColumns: checkboxes.filter(cb => cb.checked).map(cb => cb.value) });

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

function renderApiKeyInput(container, modelId, store) {
  container.innerHTML = '';
  const model = getModelById(modelId);
  if (!model) return;

  const adapter = ADAPTERS[model.provider] ?? null;

  const input = createApiKeyInput({
    provider: model.provider,
    onChange: key => store.setState({ apiKey: key }),
    onValidate: adapter ? key => adapter.validateApiKey(key) : null,
  });
  container.appendChild(input);
}
