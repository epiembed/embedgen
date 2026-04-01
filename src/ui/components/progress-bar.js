/**
 * Progress bar component.
 * Shows a filled bar, a text label, and an optional cancel button.
 *
 * Usage:
 *   const bar = createProgressBar({ onCancel: () => {} });
 *   container.appendChild(bar.el);
 *   bar.update({ pct: 0.4, label: 'Batch 2 / 5' });
 *   bar.setError('Rate limit hit — retrying in 5 s…');
 */

/**
 * @param {{ onCancel?: () => void }} options
 * @returns {{ el: HTMLElement, update: (opts: { pct: number, label?: string }) => void, setError: (msg: string) => void, clearError: () => void }}
 */
export function createProgressBar({ onCancel } = {}) {
  const el = document.createElement('div');
  el.className = 'progress-bar';

  const track = document.createElement('div');
  track.className = 'progress-bar__track';
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  track.setAttribute('aria-valuenow', '0');

  const fill = document.createElement('div');
  fill.className = 'progress-bar__fill';
  fill.style.width = '0%';
  track.appendChild(fill);

  const label = document.createElement('p');
  label.className = 'progress-bar__label';
  label.setAttribute('aria-live', 'polite');
  label.setAttribute('aria-atomic', 'true');

  const errorEl = document.createElement('p');
  errorEl.className = 'progress-bar__error';
  errorEl.hidden = true;
  errorEl.setAttribute('aria-live', 'assertive');
  errorEl.setAttribute('aria-atomic', 'true');

  el.appendChild(track);
  el.appendChild(label);
  el.appendChild(errorEl);

  if (onCancel) {
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'progress-bar__cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', onCancel);
    el.appendChild(cancelBtn);
  }

  function update({ pct, label: text = '' }) {
    const clamped = Math.max(0, Math.min(1, pct));
    fill.style.width = `${(clamped * 100).toFixed(1)}%`;
    track.setAttribute('aria-valuenow', Math.round(clamped * 100));
    label.textContent = text;
  }

  function setError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function clearError() {
    errorEl.textContent = '';
    errorEl.hidden = true;
  }

  return { el, update, setError, clearError };
}
