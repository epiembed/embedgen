/**
 * Model selector component.
 * Renders a grouped <select> of all embedding models.
 * Shows model metadata (dimensions, input type, preview flag) alongside the select.
 *
 * Usage:
 *   const el = createModelSelector({ selectedId: 'openai/text-embedding-3-small', onChange: id => {} });
 *   container.appendChild(el);
 */

import { MODELS, getModelById, getProviders } from '../../config/models.js';

const PROVIDER_LABELS = {
  voyage:       'Voyage AI',
  openai:       'OpenAI',
  gemini:       'Google Gemini',
  huggingface:  'HuggingFace (in-browser)',
};

const INPUT_TYPE_LABELS = {
  text:        'Text',
  image:       'Image',
  multimodal:  'Multimodal',
};

/**
 * @param {{
 *   selectedId?: string,
 *   onChange: (modelId: string) => void,
 *   allowedInputTypes?: ('text'|'image'|'multimodal')[]
 * }} options
 * @returns {HTMLElement}
 */
export function createModelSelector({ selectedId = null, onChange, allowedInputTypes = null }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'model-selector';

  const label = document.createElement('label');
  label.className = 'model-selector__label';
  label.textContent = 'Embedding model';
  label.htmlFor = 'model-selector-select';

  const select = document.createElement('select');
  select.className = 'model-selector__select';
  select.id = 'model-selector-select';

  // Build grouped options
  for (const provider of getProviders()) {
    const providerModels = MODELS.filter(m =>
      m.provider === provider &&
      (allowedInputTypes === null || allowedInputTypes.includes(m.inputType))
    );
    if (providerModels.length === 0) continue;

    const group = document.createElement('optgroup');
    group.label = PROVIDER_LABELS[provider] ?? provider;

    for (const model of providerModels) {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.preview
        ? `${model.displayName} (Preview)`
        : model.displayName;
      if (model.id === selectedId) option.selected = true;
      group.appendChild(option);
    }

    select.appendChild(group);
  }

  // Default selection
  if (!selectedId && MODELS.length > 0) {
    select.value = MODELS[0].id;
  }

  // Metadata panel — updates on change
  const meta = document.createElement('div');
  meta.className = 'model-selector__meta';
  renderMeta(meta, select.value);

  select.addEventListener('change', () => {
    renderMeta(meta, select.value);
    onChange(select.value);
  });

  wrapper.appendChild(label);
  wrapper.appendChild(select);
  wrapper.appendChild(meta);

  return wrapper;
}

/**
 * Return the currently selected model ID from a model selector element.
 * @param {HTMLElement} el
 * @returns {string}
 */
export function getSelectedModelId(el) {
  return el.querySelector('.model-selector__select')?.value ?? null;
}

// ── Internal ──────────────────────────────────────────────────────────

function renderMeta(container, modelId) {
  container.innerHTML = '';
  const model = getModelById(modelId);
  if (!model) return;

  const chips = [
    { label: `${model.dimensions}d` },
    { label: INPUT_TYPE_LABELS[model.inputType] ?? model.inputType },
    model.supportsMatryoshka ? { label: 'Matryoshka', accent: true } : null,
    model.provider === 'huggingface' ? { label: 'In-browser', accent: true } : null,
    model.preview ? { label: 'Preview', warn: true } : null,
  ].filter(Boolean);

  const chipRow = document.createElement('div');
  chipRow.className = 'model-selector__chips';
  for (const chip of chips) {
    const span = document.createElement('span');
    span.className = 'model-selector__chip';
    if (chip.accent) span.classList.add('model-selector__chip--accent');
    if (chip.warn)   span.classList.add('model-selector__chip--warn');
    span.textContent = chip.label;
    chipRow.appendChild(span);
  }
  container.appendChild(chipRow);

  if (model.note) {
    const note = document.createElement('p');
    note.className = 'model-selector__note';
    note.textContent = model.note;
    container.appendChild(note);
  }
}
