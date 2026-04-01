/**
 * API key input component.
 * Password field with show/hide toggle and an optional Validate button.
 * The key is never persisted — lives only in memory via the onChange callback.
 *
 * Usage:
 *   const el = createApiKeyInput({
 *     provider: 'openai',
 *     onChange: key => {},
 *     onValidate: async key => boolean,   // optional
 *   });
 *   container.appendChild(el);
 */

const PROVIDER_PLACEHOLDERS = {
  openai:      'sk-…',
  voyage:      'pa-…',
  gemini:      'AIza…',
  huggingface: null, // no key needed
};

const PROVIDER_LABELS = {
  openai:      'OpenAI API key',
  voyage:      'Voyage AI API key',
  gemini:      'Google AI API key',
  huggingface: null,
};

/**
 * @param {{
 *   provider: string,
 *   onChange?: (key: string) => void,
 *   onValidate?: (key: string) => Promise<boolean>,
 * }} options
 * @returns {HTMLElement}
 */
export function createApiKeyInput({ provider, onChange = () => {}, onValidate = null }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'api-key-input';

  // HuggingFace models run in-browser — no key needed
  if (provider === 'huggingface') {
    const note = document.createElement('p');
    note.className = 'api-key-input__no-key';
    note.textContent = 'No API key required — this model runs entirely in your browser.';
    wrapper.appendChild(note);
    return wrapper;
  }

  const labelText = PROVIDER_LABELS[provider] ?? 'API key';
  const placeholder = PROVIDER_PLACEHOLDERS[provider] ?? '';

  const label = document.createElement('label');
  label.className = 'api-key-input__label';
  label.textContent = labelText;
  label.htmlFor = `api-key-input-${provider}`;

  // Input row: password field + toggle button
  const row = document.createElement('div');
  row.className = 'api-key-input__row';

  const input = document.createElement('input');
  input.type = 'password';
  input.id = `api-key-input-${provider}`;
  input.className = 'api-key-input__field';
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.spellcheck = false;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'api-key-input__toggle';
  toggle.setAttribute('aria-label', 'Show API key');
  toggle.textContent = 'Show';

  toggle.addEventListener('click', () => {
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    toggle.textContent = isHidden ? 'Hide' : 'Show';
    toggle.setAttribute('aria-label', isHidden ? 'Hide API key' : 'Show API key');
  });

  input.addEventListener('input', () => {
    onChange(input.value);
    clearStatus(statusEl);
  });

  row.appendChild(input);
  row.appendChild(toggle);

  // Status message
  const statusEl = document.createElement('p');
  statusEl.className = 'api-key-input__status';
  statusEl.setAttribute('aria-live', 'polite');
  statusEl.setAttribute('aria-atomic', 'true');

  wrapper.appendChild(label);
  wrapper.appendChild(row);

  // Optional validate button
  if (onValidate) {
    const validateBtn = document.createElement('button');
    validateBtn.type = 'button';
    validateBtn.className = 'api-key-input__validate';
    validateBtn.textContent = 'Validate';

    validateBtn.addEventListener('click', async () => {
      const key = input.value.trim();
      if (!key) {
        showStatus(statusEl, 'Enter an API key first.', 'error');
        return;
      }
      validateBtn.disabled = true;
      validateBtn.textContent = 'Validating…';
      clearStatus(statusEl);
      try {
        const valid = await onValidate(key);
        showStatus(statusEl, valid ? 'API key is valid.' : 'API key is invalid.', valid ? 'success' : 'error');
      } catch {
        showStatus(statusEl, 'Validation failed — check your network connection.', 'error');
      } finally {
        validateBtn.disabled = false;
        validateBtn.textContent = 'Validate';
      }
    });

    wrapper.appendChild(validateBtn);
  }

  wrapper.appendChild(statusEl);
  return wrapper;
}

/**
 * Programmatically read the current key value from a rendered component.
 * @param {HTMLElement} el
 * @returns {string}
 */
export function getApiKey(el) {
  return el.querySelector('.api-key-input__field')?.value ?? '';
}

// ── Helpers ───────────────────────────────────────────────────────────

function showStatus(el, message, type) {
  el.textContent = message;
  el.className = `api-key-input__status api-key-input__status--${type}`;
}

function clearStatus(el) {
  el.textContent = '';
  el.className = 'api-key-input__status';
}
