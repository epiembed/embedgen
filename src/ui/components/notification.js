/**
 * Toast notification system.
 *
 * Usage:
 *   const toaster = createToaster();
 *   document.body.appendChild(toaster.el);
 *
 *   toaster.show('File uploaded.', { type: 'success' });
 *   toaster.show('Rate limited — retrying…', { type: 'warning', timeout: 0 });
 *   toaster.show('Invalid API key.', { type: 'error' });
 *
 * Options:
 *   type    — 'success' | 'warning' | 'error' | 'info'  (default: 'info')
 *   timeout — ms before auto-dismiss; 0 = never auto-dismiss (default: 4000)
 *
 * Each toast can be manually dismissed via its close button.
 * Returns a dismiss() function from show() for programmatic removal.
 */

const DEFAULT_TIMEOUT = 4000;

/**
 * Create a toaster container. Mount its `.el` once at the app root.
 * @returns {{ el: HTMLElement, show: (message: string, opts?: {type?: string, timeout?: number}) => () => void }}
 */
export function createToaster() {
  const el = document.createElement('div');
  el.className = 'toaster';
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'false');

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {{ type?: 'success'|'warning'|'error'|'info', timeout?: number }} [opts]
   * @returns {() => void}  dismiss function
   */
  function show(message, { type = 'info', timeout = DEFAULT_TIMEOUT } = {}) {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const icon = document.createElement('span');
    icon.className = 'toast__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = { success: '✓', warning: '⚠', error: '✕', info: 'ℹ' }[type] ?? 'ℹ';

    const text = document.createElement('span');
    text.className = 'toast__message';
    text.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'toast__close';
    closeBtn.setAttribute('aria-label', 'Dismiss');
    closeBtn.textContent = '×';

    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(closeBtn);
    el.appendChild(toast);

    // Trigger enter animation on next frame
    requestAnimationFrame(() => toast.classList.add('toast--visible'));

    function dismiss() {
      if (!toast.isConnected) return;
      toast.classList.remove('toast--visible');
      toast.classList.add('toast--leaving');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      // Fallback if transitions aren't supported
      setTimeout(() => toast.remove(), 400);
    }

    closeBtn.addEventListener('click', dismiss);

    let timerId = null;
    if (timeout > 0) {
      timerId = setTimeout(dismiss, timeout);
    }

    // Pause auto-dismiss on hover
    toast.addEventListener('mouseenter', () => {
      if (timerId !== null) { clearTimeout(timerId); timerId = null; }
    });
    toast.addEventListener('mouseleave', () => {
      if (timeout > 0 && timerId === null) {
        timerId = setTimeout(dismiss, timeout);
      }
    });

    return dismiss;
  }

  return { el, show };
}
