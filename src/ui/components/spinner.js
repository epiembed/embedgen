/**
 * Reusable loading spinner.
 *
 * Usage:
 *   const s = createSpinner('Loading model…');
 *   container.appendChild(s.el);
 *   s.setText('Downloading weights…');
 *   s.el.hidden = true; // hide when done
 */

/**
 * @param {string} [text]
 * @returns {{ el: HTMLElement, setText: (t: string) => void }}
 */
export function createSpinner(text = 'Loading…') {
  const el = document.createElement('div');
  el.className = 'spinner';
  el.setAttribute('role', 'status');

  const ring = document.createElement('span');
  ring.className = 'spinner__ring';
  ring.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.className = 'spinner__label';
  label.textContent = text;

  el.appendChild(ring);
  el.appendChild(label);

  return {
    el,
    setText(t) { label.textContent = t; },
  };
}
