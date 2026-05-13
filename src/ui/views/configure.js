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
  let currentSelectedColumn = selectedColumn;
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
  let currentEmbeddingType = normalizeEmbeddingType(state.embeddingType)
    ?? getDefaultEmbeddingType(data, currentSelectedColumn, imageColumns);

  // ── Preview ─────────────────────────────────────────────────────
  const previewEl = createDataPreview({
    data,
    selectedColumn: currentSelectedColumn,
    maxRows: 5,
    imageColumns: getPreviewImageColumns(currentSelectedColumn, currentEmbeddingType, imageColumns),
  });
  previewEl.className += ' configure__preview';

  // ── Section: Column selection ───────────────────────────────────
  el.appendChild(buildSection('Embedding column', buildColumnSelector(data, selectedColumn, store, previewEl, onColumnChange)));

  // ── Section: Embedding type ─────────────────────────────────────
  const embeddingTypeSelector = buildEmbeddingTypeSelector(currentEmbeddingType, onEmbeddingTypeChange);
  el.appendChild(buildSection('Embedding type', embeddingTypeSelector));

  // ── Section: Metadata columns ───────────────────────────────────
  el.appendChild(buildSection('Metadata columns', buildMetaSelector(data, selectedColumn, state.metaColumns, store)));

  el.appendChild(buildSection('Data preview', previewEl));

  // ── Section: Model ──────────────────────────────────────────────
  const defaultModelId = MODELS[0].id;
  let currentModelId = getCompatibleModelId(state.modelId ?? defaultModelId, currentEmbeddingType);

  const dimSlider = createDimensionSlider({
    modelId: currentModelId,
    onChange: dim => store.setState({ dimensions: dim }),
  });

  const apiKeyWrapper = document.createElement('div');
  renderApiKeyInput(apiKeyWrapper, currentModelId);

  // API key section — title adapts for HF
  const apiKeySection = buildSection('API key', apiKeyWrapper);

  // Model selector lives in a wrapper so it can be rebuilt on column change
  const modelSelectorWrapper = document.createElement('div');
  let modelSelector;
  let dimSection; // set after buildSection call below

  function buildModelSelector() {
    modelSelectorWrapper.innerHTML = '';
    currentModelId = getCompatibleModelId(currentModelId, currentEmbeddingType);
    const sel = createModelSelector({
      selectedId: currentModelId,
      allowedInputTypes: getAllowedInputTypes(currentEmbeddingType),
      onChange: modelId => {
        currentModelId = modelId;
        const model = getModelById(modelId);
        const isHF = model?.provider === 'huggingface';
        store.setState({ modelId, apiKey: '', dimensions: null });
        updateDimensionSlider(dimSlider, modelId);
        if (dimSection) dimSection.hidden = !model?.supportsMatryoshka;
        renderApiKeyInput(apiKeyWrapper, modelId);
        apiKeySection.querySelector('.configure__section-title').textContent =
          isHF ? 'Runtime' : 'API key';
      },
    });
    modelSelectorWrapper.appendChild(sel);
    modelSelector = sel;
    return sel;
  }

  buildModelSelector();

  // Set initial section title
  if (getModelById(currentModelId)?.provider === 'huggingface') {
    apiKeySection.querySelector('.configure__section-title').textContent = 'Runtime';
  }

  // Image mode notice
  const imageModeNotice = document.createElement('p');
  imageModeNotice.className = 'configure__image-mode-notice';
  imageModeNotice.textContent = 'Image embedding selected - showing image-capable models only. OpenAI models are text-only and are hidden.';
  imageModeNotice.hidden = currentEmbeddingType !== 'image';
  imageModeNotice.setAttribute('aria-live', 'polite');

  el.appendChild(buildSection('Model', modelSelectorWrapper));
  el.appendChild(imageModeNotice);
  el.appendChild(apiKeySection);
  dimSection = buildSection('Output dimensions', dimSlider);
  dimSection.hidden = !getModelById(currentModelId)?.supportsMatryoshka;
  el.appendChild(dimSection);

  // ── Column change handler ───────────────────────────────────────
  function onColumnChange(col) {
    currentSelectedColumn = col;
    const nextEmbeddingType = getDefaultEmbeddingType(data, col, imageColumns);
    applyEmbeddingType(nextEmbeddingType, { persist: false });
    store.setState({
      selectedColumn: col,
      embeddingType: nextEmbeddingType,
      modelId: currentModelId,
      dimensions: null,
    });
  }

  function onEmbeddingTypeChange(nextType) {
    applyEmbeddingType(nextType);
  }

  function applyEmbeddingType(nextType, { persist = true } = {}) {
    const normalized = normalizeEmbeddingType(nextType) ?? 'text';
    const previousModelId = currentModelId;
    currentEmbeddingType = normalized;
    currentModelId = getCompatibleModelId(currentModelId, currentEmbeddingType);

    updateEmbeddingTypeSelector(embeddingTypeSelector, currentEmbeddingType);
    updateDataPreview(previewEl, {
      selectedColumn: currentSelectedColumn,
      imageColumns: getPreviewImageColumns(currentSelectedColumn, currentEmbeddingType, imageColumns),
    });
    buildModelSelector();
    imageModeNotice.hidden = currentEmbeddingType !== 'image';

    const model = getModelById(currentModelId);
    updateDimensionSlider(dimSlider, currentModelId);
    if (dimSection) dimSection.hidden = !model?.supportsMatryoshka;
    if (previousModelId !== currentModelId) {
      renderApiKeyInput(apiKeyWrapper, currentModelId);
      apiKeySection.querySelector('.configure__section-title').textContent =
        model?.provider === 'huggingface' ? 'Runtime' : 'API key';
    }

    if (persist) {
      store.setState({
        embeddingType: currentEmbeddingType,
        modelId: currentModelId,
        apiKey: previousModelId !== currentModelId ? '' : store.getState().apiKey,
        dimensions: null,
      });
    }
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
      embeddingType: currentEmbeddingType,
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
 * A column qualifies if more than 50% of non-null values parse as http/https URLs.
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
    if (urlCount / vals.length > 0.5) result.add(h);
  });
  return result;
}

/**
 * Pick the default embedding type for a column.
 * @param {{ headers: string[], rows: (string|null)[][] }} data
 * @param {string|null} selectedColumn
 * @param {Set<string>} [imageColumns]
 * @returns {'text'|'image'}
 */
export function getDefaultEmbeddingType(data, selectedColumn, imageColumns = detectImageColumns(data)) {
  return selectedColumn !== null && imageColumns.has(selectedColumn) ? 'image' : 'text';
}

function normalizeEmbeddingType(type) {
  return type === 'image' || type === 'text' ? type : null;
}

function getAllowedInputTypes(embeddingType) {
  return embeddingType === 'image'
    ? ['image', 'multimodal']
    : ['text', 'multimodal'];
}

function getCompatibleModelId(modelId, embeddingType) {
  const allowedInputTypes = getAllowedInputTypes(embeddingType);
  const model = getModelById(modelId);
  if (model && allowedInputTypes.includes(model.inputType)) return modelId;
  return MODELS.find(m => allowedInputTypes.includes(m.inputType))?.id ?? MODELS[0]?.id ?? null;
}

function getPreviewImageColumns(selectedColumn, embeddingType, detectedImageColumns) {
  const columns = new Set(detectedImageColumns);
  if (selectedColumn !== null) {
    if (embeddingType === 'image') columns.add(selectedColumn);
    else columns.delete(selectedColumn);
  }
  return columns;
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

function buildEmbeddingTypeSelector(selectedType, onChange) {
  const wrapper = document.createElement('div');
  wrapper.className = 'configure__type-toggle';
  wrapper.setAttribute('role', 'radiogroup');
  wrapper.setAttribute('aria-label', 'Embedding type');

  [
    { value: 'text', label: 'Text' },
    { value: 'image', label: 'Image' },
  ].forEach(({ value, label }) => {
    const option = document.createElement('label');
    option.className = 'configure__type-option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'configure-embedding-type';
    input.value = value;
    input.checked = value === selectedType;

    const text = document.createElement('span');
    text.textContent = label;

    input.addEventListener('change', () => {
      if (input.checked) onChange(value);
    });

    option.appendChild(input);
    option.appendChild(text);
    wrapper.appendChild(option);
  });

  return wrapper;
}

function updateEmbeddingTypeSelector(wrapper, selectedType) {
  wrapper.querySelectorAll('input[name="configure-embedding-type"]').forEach(input => {
    input.checked = input.value === selectedType;
  });
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
    if (onColumnChange) {
      onColumnChange(select.value);
      return;
    }
    store.setState({ selectedColumn: select.value });
    if (previewEl) updateDataPreview(previewEl, { selectedColumn: select.value });
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
