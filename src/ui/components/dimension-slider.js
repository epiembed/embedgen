/**
 * Dimension slider component.
 * Shown only for models that support Matryoshka dimension reduction.
 *
 * Two modes:
 *  - Discrete stops  (matryoshkaDimensions is an array) — slider snaps to legal values only.
 *  - Any value       (matryoshkaDimensions is null)     — free-range slider + numeric input.
 *
 * Hidden entirely for non-Matryoshka models.
 *
 * Usage:
 *   const el = createDimensionSlider({ modelId: 'openai/text-embedding-3-small', onChange: dim => {} });
 *   container.appendChild(el);
 *
 *   // Swap model without rebuilding the parent:
 *   updateDimensionSlider(el, 'voyage/voyage-4-large');
 */

import { getModelById } from '../../config/models.js';
import { getLegalDimensions } from '../../../src/embeddings/matryoshka.js';

/**
 * @param {{ modelId: string, onChange: (dim: number) => void }} options
 * @returns {HTMLElement}
 */
export function createDimensionSlider({ modelId, onChange }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'dimension-slider';
  wrapper._onChange = onChange;
  renderSlider(wrapper, modelId);
  return wrapper;
}

/**
 * Re-render the slider for a new model (call when the model selection changes).
 * @param {HTMLElement} el   Element from createDimensionSlider
 * @param {string} modelId
 */
export function updateDimensionSlider(el, modelId) {
  renderSlider(el, modelId);
}

/**
 * Read the currently selected dimension from a rendered slider element.
 * Returns null if the slider is hidden (model doesn't support Matryoshka).
 * @param {HTMLElement} el
 * @returns {number|null}
 */
export function getSelectedDimension(el) {
  if (el.hidden) return null;
  const val = el.dataset.currentDim;
  return val != null ? Number(val) : null;
}

// ── Internal ──────────────────────────────────────────────────────────

function renderSlider(wrapper, modelId) {
  wrapper.innerHTML = '';
  const model = getModelById(modelId);

  if (!model || !model.supportsMatryoshka) {
    wrapper.hidden = true;
    return;
  }

  wrapper.hidden = false;
  const stops = getLegalDimensions(modelId); // array | null

  const heading = document.createElement('div');
  heading.className = 'dimension-slider__heading';

  const labelEl = document.createElement('span');
  labelEl.className = 'dimension-slider__label';
  labelEl.textContent = 'Output dimensions';

  const valueEl = document.createElement('span');
  valueEl.className = 'dimension-slider__value';

  heading.appendChild(labelEl);
  heading.appendChild(valueEl);
  wrapper.appendChild(heading);

  if (stops !== null) {
    // ── Discrete stops mode ──────────────────────────────────────
    // Slider index maps to stops[index]; stops are typically descending
    // (e.g. [2048, 1024, 512, 256]), so index 0 = max dim.
    const ascending = [...stops].sort((a, b) => a - b); // sort asc for slider
    const initialIndex = ascending.length - 1;           // default: largest dim

    const range = document.createElement('input');
    range.type = 'range';
    range.className = 'dimension-slider__range';
    range.min = 0;
    range.max = ascending.length - 1;
    range.step = 1;
    range.value = initialIndex;

    const tickRow = buildTickRow(ascending);

    const update = () => {
      const dim = ascending[Number(range.value)];
      valueEl.textContent = dim.toLocaleString();
      wrapper.dataset.currentDim = dim;
      wrapper._onChange?.(dim);
    };

    range.addEventListener('input', update);
    wrapper.appendChild(range);
    wrapper.appendChild(tickRow);
    update();

  } else {
    // ── Any-value mode ───────────────────────────────────────────
    const min = 64;
    const max = model.dimensions;
    const initial = max;

    const row = document.createElement('div');
    row.className = 'dimension-slider__free-row';

    const range = document.createElement('input');
    range.type = 'range';
    range.className = 'dimension-slider__range';
    range.min = min;
    range.max = max;
    range.step = 64;
    range.value = initial;

    const numInput = document.createElement('input');
    numInput.type = 'number';
    numInput.className = 'dimension-slider__number';
    numInput.min = 1;
    numInput.max = max;
    numInput.value = initial;

    const update = dim => {
      const clamped = Math.max(1, Math.min(max, Math.round(dim)));
      range.value = clamped;
      numInput.value = clamped;
      valueEl.textContent = clamped.toLocaleString();
      wrapper.dataset.currentDim = clamped;
      wrapper._onChange?.(clamped);
    };

    range.addEventListener('input', () => update(Number(range.value)));
    numInput.addEventListener('change', () => update(Number(numInput.value)));

    const hint = document.createElement('span');
    hint.className = 'dimension-slider__hint';
    hint.textContent = `1–${max.toLocaleString()}`;

    row.appendChild(range);
    row.appendChild(numInput);
    wrapper.appendChild(row);
    wrapper.appendChild(hint);
    update(initial);
  }
}

function buildTickRow(ascendingStops) {
  const row = document.createElement('div');
  row.className = 'dimension-slider__ticks';
  for (const stop of ascendingStops) {
    const tick = document.createElement('span');
    tick.className = 'dimension-slider__tick';
    tick.textContent = stop >= 1000 ? `${stop / 1000}k` : String(stop);
    row.appendChild(tick);
  }
  return row;
}
