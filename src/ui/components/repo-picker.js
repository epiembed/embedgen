/**
 * Repository picker/creator component.
 *
 * Shows a <select> populated with the user's GitHub repos plus a
 * "Create new repo…" sentinel option. Selecting the sentinel reveals
 * an inline form to create a new repo; on success the new repo is
 * added to the list and selected.
 *
 * Usage:
 *   const picker = createRepoPicker({ token, listRepos, createRepo, onChange });
 *   container.appendChild(picker.el);
 *   picker.load();           // fetch repos and populate select
 *   picker.getSelected();    // → { owner, repo } | null
 */

const CREATE_VALUE = '__create__';

/**
 * @param {object} opts
 * @param {string}   opts.token
 * @param {Function} opts.listRepos    — (token) → Promise<repo[]>
 * @param {Function} opts.createRepo   — (token, name, desc, isPublic) → Promise<repo>
 * @param {Function} opts.onChange     — ({ owner, repo }) => void
 * @returns {{ el: HTMLElement, load: () => Promise<void>, getSelected: () => {owner,repo}|null }}
 */
export function createRepoPicker({ token, listRepos, createRepo, onChange }) {
  const el = document.createElement('div');
  el.className = 'repo-picker';

  // ── Select ────────────────────────────────────────────────────────
  const label = document.createElement('label');
  label.className = 'repo-picker__label';
  label.textContent = 'GitHub repository';
  label.htmlFor = 'repo-picker-select';

  const select = document.createElement('select');
  select.className = 'repo-picker__select';
  select.id = 'repo-picker-select';
  select.disabled = true;

  const loadingOpt = document.createElement('option');
  loadingOpt.textContent = 'Loading repos…';
  select.appendChild(loadingOpt);

  // ── Create-new form (hidden until sentinel selected) ──────────────
  const form = document.createElement('div');
  form.className = 'repo-picker__create-form';
  form.hidden = true;

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'repo-picker__name-input';
  nameInput.placeholder = 'Repository name';
  nameInput.autocomplete = 'off';

  const descInput = document.createElement('input');
  descInput.type = 'text';
  descInput.className = 'repo-picker__desc-input';
  descInput.placeholder = 'Description (optional)';

  const createBtn = document.createElement('button');
  createBtn.type = 'button';
  createBtn.className = 'repo-picker__create-btn btn btn--primary';
  createBtn.textContent = 'Create repo';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'repo-picker__cancel-btn btn btn--secondary';
  cancelBtn.textContent = 'Cancel';

  const formError = document.createElement('p');
  formError.className = 'repo-picker__form-error';
  formError.hidden = true;

  const formRow = document.createElement('div');
  formRow.className = 'repo-picker__form-row';
  formRow.appendChild(createBtn);
  formRow.appendChild(cancelBtn);

  form.appendChild(nameInput);
  form.appendChild(descInput);
  form.appendChild(formRow);
  form.appendChild(formError);

  // ── Error area ────────────────────────────────────────────────────
  const errorEl = document.createElement('p');
  errorEl.className = 'repo-picker__error';
  errorEl.hidden = true;

  el.appendChild(label);
  el.appendChild(select);
  el.appendChild(form);
  el.appendChild(errorEl);

  // ── Internal state ────────────────────────────────────────────────
  let repos = [];

  function populateSelect(repoList, selectedFullName = null) {
    select.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Select a repo —';
    placeholder.disabled = true;
    placeholder.selected = !selectedFullName;
    select.appendChild(placeholder);

    for (const repo of repoList) {
      const opt = document.createElement('option');
      opt.value = repo.full_name;
      opt.textContent = repo.full_name;
      if (repo.full_name === selectedFullName) opt.selected = true;
      select.appendChild(opt);
    }

    const createOpt = document.createElement('option');
    createOpt.value = CREATE_VALUE;
    createOpt.textContent = '＋ Create new repo…';
    select.appendChild(createOpt);

    select.disabled = false;
  }

  function showForm() {
    form.hidden = false;
    nameInput.value = '';
    descInput.value = '';
    formError.hidden = true;
    nameInput.focus();
  }

  function hideForm() {
    form.hidden = true;
    formError.hidden = true;
  }

  select.addEventListener('change', () => {
    if (select.value === CREATE_VALUE) {
      showForm();
      onChange(null);
    } else {
      hideForm();
      if (select.value) {
        const [owner, repo] = select.value.split('/');
        onChange({ owner, repo });
      } else {
        onChange(null);
      }
    }
  });

  cancelBtn.addEventListener('click', () => {
    hideForm();
    // Revert select to placeholder
    select.value = '';
    onChange(null);
  });

  createBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      formError.textContent = 'Repository name is required.';
      formError.hidden = false;
      return;
    }

    createBtn.disabled = true;
    createBtn.textContent = 'Creating…';
    formError.hidden = true;

    try {
      const newRepo = await createRepo(token, name, descInput.value.trim(), true);
      repos = [newRepo, ...repos];
      populateSelect(repos, newRepo.full_name);
      hideForm();
      const [owner, repo] = newRepo.full_name.split('/');
      onChange({ owner, repo });
    } catch (err) {
      formError.textContent = `Failed to create repo: ${err.message}`;
      formError.hidden = false;
    } finally {
      createBtn.disabled = false;
      createBtn.textContent = 'Create repo';
    }
  });

  // ── Public API ────────────────────────────────────────────────────
  async function load() {
    errorEl.hidden = true;
    select.disabled = true;
    try {
      repos = await listRepos(token);
      populateSelect(repos);
    } catch (err) {
      select.innerHTML = '';
      errorEl.textContent = `Could not load repos: ${err.message}`;
      errorEl.hidden = false;
    }
  }

  function getSelected() {
    const val = select.value;
    if (!val || val === CREATE_VALUE || val === '') return null;
    const [owner, repo] = val.split('/');
    return { owner, repo };
  }

  return { el, load, getSelected };
}
