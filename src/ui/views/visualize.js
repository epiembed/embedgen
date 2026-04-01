/**
 * Visualize view — the final step in the EmbedGen flow.
 *
 * - If a configUrl is in state (saved to GitHub): embeds the TF Projector iframe
 *   and shows a shareable link.
 * - If no configUrl (local download only): shows the fallback with manual upload
 *   instructions and a "Save to GitHub" shortcut back to the export view.
 */

import { getModelById } from '../../config/models.js';
import { createProjectorEmbed } from '../../visualizer/projector.js';
import { buildShareableLink } from '../../visualizer/link.js';

/**
 * @param {HTMLElement} container
 * @param {object} state
 * @param {object} store
 */
export function renderVisualize(container, state, store) {
  const { embeddings, modelId, configUrl } = state;
  const model = getModelById(modelId);

  const n = embeddings?.vectors?.length ?? 0;
  const d = embeddings?.vectors?.[0]?.length ?? 0;

  const el = document.createElement('div');
  el.className = 'visualize-view';

  // ── Heading ──────────────────────────────────────────────────────
  const heading = document.createElement('h1');
  heading.className = 'visualize-view__heading';
  heading.textContent = 'Visualize embeddings';
  el.appendChild(heading);

  // ── Summary ───────────────────────────────────────────────────────
  const summary = document.createElement('p');
  summary.className = 'visualize-view__summary';
  summary.textContent = `${n.toLocaleString()} points · ${d.toLocaleString()} dimensions · ${model?.displayName ?? modelId ?? '—'}`;
  el.appendChild(summary);

  // ── Shareable link (GitHub mode only) ─────────────────────────────
  if (configUrl) {
    const shareSection = document.createElement('div');
    shareSection.className = 'visualize-view__share';

    const shareLabel = document.createElement('p');
    shareLabel.className = 'visualize-view__share-label';
    shareLabel.textContent = 'Shareable link:';
    shareSection.appendChild(shareLabel);

    const linkRow = document.createElement('div');
    linkRow.className = 'visualize-view__link-row';

    const linkInput = document.createElement('input');
    linkInput.type = 'text';
    linkInput.readOnly = true;
    linkInput.className = 'visualize-view__link-input';
    linkInput.value = buildShareableLink(configUrl);
    linkInput.setAttribute('aria-label', 'Shareable visualization link');

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn--secondary';
    copyBtn.textContent = 'Copy';
    copyBtn.setAttribute('aria-label', 'Copy shareable link to clipboard');
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(linkInput.value).then(() => {
        copyBtn.textContent = 'Copied!';
        copyBtn.setAttribute('aria-label', 'Link copied to clipboard');
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
          copyBtn.setAttribute('aria-label', 'Copy shareable link to clipboard');
        }, 2000);
      });
    });

    linkRow.appendChild(linkInput);
    linkRow.appendChild(copyBtn);
    shareSection.appendChild(linkRow);
    el.appendChild(shareSection);
  }

  // ── Projector embed ───────────────────────────────────────────────
  const embed = createProjectorEmbed({
    configUrl: configUrl ?? null,
    onSaveToGitHub: () => store.setState({ step: 'export' }),
  });
  el.appendChild(embed.el);

  // ── Footer actions ────────────────────────────────────────────────
  const footer = document.createElement('div');
  footer.className = 'visualize-view__footer';

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'btn btn--secondary';
  backBtn.textContent = '← Back to export';
  backBtn.addEventListener('click', () => store.setState({ step: 'export' }));
  footer.appendChild(backBtn);

  const startOverBtn = document.createElement('button');
  startOverBtn.type = 'button';
  startOverBtn.className = 'btn btn--ghost';
  startOverBtn.textContent = 'Start over';
  startOverBtn.addEventListener('click', () => {
    store.setState({
      step: 'landing',
      data: null, selectedColumn: null, projectorData: null,
      modelId: null, apiKey: '', dimensions: null,
      metaColumns: [], embeddings: null, configUrl: null,
    });
  });
  footer.appendChild(startOverBtn);

  el.appendChild(footer);
  container.appendChild(el);
}
