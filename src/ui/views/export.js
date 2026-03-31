/**
 * Export view.
 * Offers two actions:
 *   1. Download to Disk — builds a ZIP and saves it locally.
 *   2. Save to GitHub   — full OAuth + repo picker + atomic commit flow.
 */

import { getModelById } from '../../config/models.js';
import { toTSV as tensorToTSV } from '../../export/tensor.js';
import { toTSV as metaToTSV } from '../../export/metadata.js';
import { buildConfig } from '../../export/config.js';
import { buildZip, triggerDownload } from '../../export/download.js';
import { saveToGitHub } from '../../export/github.js';
import { initiateLogin, getToken, logout, handleCallback } from '../../github/auth.js';
import { getUser, listRepos, createRepo } from '../../github/api.js';
import { createGitHubLogin } from '../components/github-login.js';
import { createRepoPicker } from '../components/repo-picker.js';

const CLIENT_ID  = import.meta.env.VITE_GITHUB_CLIENT_ID  ?? '';
const WORKER_URL = import.meta.env.VITE_GITHUB_WORKER_URL ?? '';
const REDIRECT_URI = window.location.origin + window.location.pathname;

const STATE_KEY = 'embedgen_pre_oauth_state';

/**
 * Call on app start to handle the OAuth redirect callback.
 * Returns the restored pre-redirect state, or null.
 * @param {object} store
 */
export async function handleOAuthCallback(store) {
  // Restore state that was saved before the OAuth redirect
  const saved = sessionStorage.getItem(STATE_KEY);
  if (saved) {
    sessionStorage.removeItem(STATE_KEY);
    try { store.setState(JSON.parse(saved)); } catch { /* ignore */ }
  }

  if (!window.location.search.includes('code=')) return;

  try {
    await handleCallback(WORKER_URL);
    // Ensure user lands on export step after login
    if (store.getState().embeddings) {
      store.setState({ step: 'export' });
    }
  } catch (err) {
    console.error('OAuth callback error:', err);
  }
}

/**
 * @param {HTMLElement} container
 * @param {object} state
 * @param {object} store
 */
export function renderExport(container, state, store) {
  const { embeddings, modelId } = state;
  const { vectors, metadata } = embeddings ?? {};
  const model = getModelById(modelId);

  const n = vectors?.length ?? 0;
  const d = vectors?.[0]?.length ?? 0;

  const el = document.createElement('div');
  el.className = 'export-view';

  // ── Heading ──────────────────────────────────────────────────────
  const heading = document.createElement('h1');
  heading.className = 'export-view__heading';
  heading.textContent = 'Embeddings ready';
  el.appendChild(heading);

  // ── Summary card ─────────────────────────────────────────────────
  const summary = document.createElement('dl');
  summary.className = 'export-view__summary';

  const addRow = (label, value) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    summary.appendChild(dt);
    summary.appendChild(dd);
  };

  addRow('Points', n.toLocaleString());
  addRow('Dimensions', d.toLocaleString());
  addRow('Model', model?.displayName ?? modelId ?? '—');
  if (metadata?.headers?.length) {
    addRow('Metadata columns', metadata.headers.join(', '));
  }

  el.appendChild(summary);

  // ── Download to Disk ──────────────────────────────────────────────
  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'export-view__download-btn btn btn--primary';
  downloadBtn.textContent = 'Download to Disk';
  downloadBtn.addEventListener('click', () => {
    const tensorsTSV  = tensorToTSV(vectors);
    const metadataTSV = metaToTSV(metadata.headers, metadata.rows);
    const config = buildConfig({
      tensorName:   model?.displayName ?? modelId ?? 'embeddings',
      tensorShape:  [n, d],
      tensorPath:   'tensors.tsv',
      metadataPath: metadata.headers.length ? 'metadata.tsv' : undefined,
    });
    const zipBytes = buildZip({ tensorsTSV, metadataTSV, config });
    triggerDownload(new Blob([zipBytes], { type: 'application/zip' }), 'embedgen-export.zip');
  });
  el.appendChild(downloadBtn);

  // ── Save to GitHub section ────────────────────────────────────────
  const ghSection = document.createElement('div');
  ghSection.className = 'export-view__github-section';

  const ghHeading = document.createElement('h2');
  ghHeading.className = 'export-view__github-heading';
  ghHeading.textContent = 'Save to GitHub';
  ghSection.appendChild(ghHeading);

  // Login component
  const loginComponent = createGitHubLogin({
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    getUser,
    initiateLogin: async (clientId, redirectUri) => {
      // Persist state so it survives the OAuth redirect
      try {
        sessionStorage.setItem(STATE_KEY, JSON.stringify(store.getState()));
      } catch { /* storage quota exceeded — proceed anyway */ }
      await initiateLogin(clientId, redirectUri);
    },
    getToken,
    logout,
    onLogin:  (user) => showRepoPicker(user),
    onLogout: ()     => hideRepoPicker(),
  });
  ghSection.appendChild(loginComponent.el);

  // Repo picker (hidden until logged in)
  const pickerWrapper = document.createElement('div');
  pickerWrapper.className = 'export-view__repo-picker-wrapper';
  pickerWrapper.hidden = true;
  ghSection.appendChild(pickerWrapper);

  // Save status
  const saveStatus = document.createElement('div');
  saveStatus.className = 'export-view__save-status';
  saveStatus.hidden = true;
  ghSection.appendChild(saveStatus);

  // Save button
  const saveBtn = document.createElement('button');
  saveBtn.className = 'export-view__save-btn btn btn--primary';
  saveBtn.textContent = 'Save to GitHub';
  saveBtn.hidden = true;
  ghSection.appendChild(saveBtn);

  el.appendChild(ghSection);

  // ── Start over ────────────────────────────────────────────────────
  const startOver = document.createElement('button');
  startOver.className = 'export-view__start-over';
  startOver.textContent = '← Start over';
  startOver.addEventListener('click', () => {
    store.setState({
      step: 'landing',
      data: null, selectedColumn: null, projectorData: null,
      modelId: null, apiKey: '', dimensions: null, metaColumns: [], embeddings: null,
    });
  });
  el.appendChild(startOver);

  container.appendChild(el);

  // ── GitHub flow helpers ───────────────────────────────────────────
  let picker = null;

  function showRepoPicker(_user) {
    pickerWrapper.innerHTML = '';
    pickerWrapper.hidden = false;
    saveStatus.hidden = true;
    saveBtn.hidden = false;

    picker = createRepoPicker({
      token: getToken(),
      listRepos,
      createRepo,
      onChange: (selection) => {
        saveBtn.disabled = !selection;
      },
    });
    pickerWrapper.appendChild(picker.el);
    picker.load();
    saveBtn.disabled = true;
  }

  function hideRepoPicker() {
    picker = null;
    pickerWrapper.hidden = true;
    pickerWrapper.innerHTML = '';
    saveBtn.hidden = true;
    saveStatus.hidden = true;
  }

  saveBtn.addEventListener('click', async () => {
    const selection = picker?.getSelected();
    if (!selection) return;

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    saveStatus.hidden = false;
    saveStatus.className = 'export-view__save-status export-view__save-status--progress';
    saveStatus.textContent = 'Uploading files to GitHub…';

    try {
      const { configUrl } = await saveToGitHub({
        token:     getToken(),
        owner:     selection.owner,
        repo:      selection.repo,
        vectors,
        metadata,
        modelId,
        modelName: model?.displayName ?? modelId,
      });

      store.setState({ configUrl, step: 'visualize' });
    } catch (err) {
      saveStatus.className = 'export-view__save-status export-view__save-status--error';
      saveStatus.textContent = `Save failed: ${err.message}`;
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save to GitHub';
    }
  });

  // Hydrate login state if token already exists
  loginComponent.init();
}
