/**
 * Embed view.
 * Orchestrates: batch creation → API calls → accumulate vectors → transition to export.
 * Supports cancel and exponential backoff on rate-limit errors.
 * For HuggingFace models, shows model download progress before embedding begins.
 */

import { createProgressBar } from '../components/progress-bar.js';
import { createDownloadProgress } from '../components/download-progress.js';
import { createBatches } from '../../embeddings/batcher.js';
import { getModelById } from '../../config/models.js';
import { adapter as openaiAdapter } from '../../embeddings/openai.js';
import { adapter as voyageAdapter } from '../../embeddings/voyage.js';
import { adapter as geminiAdapter } from '../../embeddings/gemini.js';
import { adapter as huggingfaceAdapter } from '../../embeddings/huggingface.js';
import { RateLimitError } from '../../embeddings/provider.js';

const ADAPTERS = {
  openai:      openaiAdapter,
  voyage:      voyageAdapter,
  gemini:      geminiAdapter,
  huggingface: huggingfaceAdapter,
};

const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 2000;

/**
 * @param {HTMLElement} container
 * @param {object} state
 * @param {object} store
 */
export function renderEmbed(container, state, store) {
  const { data, selectedColumn, modelId, apiKey, dimensions, metaColumns } = state;
  const model = getModelById(modelId);
  const adapter = model ? ADAPTERS[model.provider] : null;
  const isHuggingFace = model?.provider === 'huggingface';

  const el = document.createElement('div');
  el.className = 'embed-view';

  const heading = document.createElement('h1');
  heading.className = 'embed-view__heading';
  heading.textContent = isHuggingFace ? 'Loading model…' : 'Generating embeddings';

  const sub = document.createElement('p');
  sub.className = 'embed-view__sub';
  sub.textContent = `Model: ${model?.displayName ?? modelId}`;

  el.appendChild(heading);
  el.appendChild(sub);

  // ── Download progress (HF only) ──────────────────────────────────
  let downloadProgress = null;
  if (isHuggingFace) {
    downloadProgress = createDownloadProgress();
    el.appendChild(downloadProgress.el);
  }

  // ── Cancel signal ────────────────────────────────────────────────
  let cancelled = false;

  const bar = createProgressBar({
    onCancel: () => {
      cancelled = true;
      store.setState({ step: 'configure' });
    },
  });
  bar.el.hidden = isHuggingFace; // shown after download completes for HF
  el.appendChild(bar.el);

  // ── Retry button ─────────────────────────────────────────────────
  const retryBtn = document.createElement('button');
  retryBtn.className = 'embed-view__retry';
  retryBtn.textContent = 'Retry';
  retryBtn.hidden = true;
  retryBtn.addEventListener('click', () => {
    retryBtn.hidden = true;
    bar.clearError();
    run();
  });
  el.appendChild(retryBtn);

  container.appendChild(el);

  // ── Orchestration ────────────────────────────────────────────────
  async function run() {
    if (!model || !adapter) {
      bar.el.hidden = false;
      bar.setError(`No adapter available for provider "${model?.provider}".`);
      return;
    }

    const colIndex = data.headers.indexOf(selectedColumn);
    const texts = data.rows
      .map(row => row[colIndex])
      .map(v => (v === null || v === undefined) ? '' : String(v));

    const batches = createBatches(
      texts,
      model.maxBatchSize,
      model.maxTokens ? model.maxTokens * model.maxBatchSize : Infinity,
    );

    const totalBatches = batches.length;
    const allVectors = [];

    for (let i = 0; i < totalBatches; i++) {
      if (cancelled) return;

      bar.update({
        pct: i / totalBatches,
        label: `Batch ${i + 1} of ${totalBatches} — ${allVectors.length} of ${texts.length} embedded`,
      });

      const batch = batches[i];
      let vectors = null;
      let attempt = 0;

      while (vectors === null) {
        if (cancelled) return;
        try {
          const options = {};

          if (isHuggingFace) {
            // Pass download progress handler on the first batch only
            if (i === 0) {
              options.onProgress = info => {
                downloadProgress?.onProgress(info);
              };
            }
          } else if (dimensions != null) {
            if (model.provider === 'openai') options.dimensions = dimensions;
            if (model.provider === 'voyage') options.output_dimension = dimensions;
            if (model.provider === 'gemini') options.outputDimensionality = dimensions;
          }

          vectors = await adapter.embed(batch, model.name, apiKey, options);

          // After first HF batch succeeds, hide download UI and show progress bar
          if (isHuggingFace && i === 0) {
            downloadProgress?.complete();
            bar.el.hidden = false;
            heading.textContent = 'Generating embeddings';
          }
        } catch (err) {
          if (err instanceof RateLimitError && attempt < MAX_RETRIES) {
            const waitMs = err.retryAfter
              ? err.retryAfter * 1000
              : BASE_BACKOFF_MS * Math.pow(2, attempt);
            const waitSec = Math.round(waitMs / 1000);
            bar.el.hidden = false;
            bar.setError(`Rate limited — retrying in ${waitSec} s… (attempt ${attempt + 1}/${MAX_RETRIES})`);
            await sleep(waitMs);
            bar.clearError();
            attempt++;
          } else {
            downloadProgress?.complete();
            bar.el.hidden = false;
            bar.setError(`Error: ${err.message}`);
            retryBtn.hidden = false;
            return;
          }
        }
      }

      allVectors.push(...vectors);
    }

    if (cancelled) return;

    bar.update({ pct: 1, label: `Done — ${allVectors.length} vectors generated` });

    const metaHeaders = (metaColumns ?? []).filter(c => c !== selectedColumn);
    const metaRows = data.rows.map(row =>
      metaHeaders.map(h => row[data.headers.indexOf(h)] ?? '')
    );

    store.setState({
      step: 'export',
      embeddings: {
        vectors: allVectors,
        metadata: { headers: metaHeaders, rows: metaRows },
        modelId,
        dimensions: allVectors[0]?.length ?? null,
      },
    });
  }

  run();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
