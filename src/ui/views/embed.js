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
import { formatEmbedError, formatDownloadError } from '../errors.js';

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
export function renderEmbed(container, state, store, toaster = null) {
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
    console.log(`[embedgen:embed] run — model: "${modelId}", column: "${selectedColumn}", dimensions: ${dimensions}`);

    if (!model || !adapter) {
      console.error(`[embedgen:embed] no adapter for provider "${model?.provider}"`);
      bar.el.hidden = false;
      bar.setError(`No adapter available for provider "${model?.provider}".`);
      return;
    }

    const colIndex = data.headers.indexOf(selectedColumn);

    // Truncate texts that exceed the model's per-text token limit.
    // Uses the same chars/4 heuristic as the batcher's estimateTokens.
    const maxChars = model.maxTokens ? model.maxTokens * 4 : null;
    let truncatedCount = 0;

    const texts = data.rows
      .map(row => row[colIndex])
      .map(v => (v === null || v === undefined) ? '' : String(v))
      .map(text => {
        if (maxChars && text.length > maxChars) {
          truncatedCount++;
          return text.slice(0, maxChars);
        }
        return text;
      });

    if (truncatedCount > 0) {
      const msg = `${truncatedCount} row${truncatedCount > 1 ? 's' : ''} exceeded the ${model.maxTokens}-token limit and were truncated to fit.`;
      console.warn(`[embedgen:embed] ${msg}`);
      toaster?.show(msg, { type: 'warning', timeout: 10000 });
    }

    console.log(`[embedgen:embed] ${texts.length} texts extracted from column "${selectedColumn}"${truncatedCount > 0 ? ` (${truncatedCount} truncated)` : ''}`);

    const batches = createBatches(
      texts,
      model.maxBatchSize,
      model.maxTokens ? model.maxTokens * model.maxBatchSize : Infinity,
    );

    const totalBatches = batches.length;
    console.log(`[embedgen:embed] ${totalBatches} batch(es) created (maxBatchSize: ${model.maxBatchSize})`);
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
                console.log('[embedgen:embed] HF model download progress', info);
                downloadProgress?.onProgress(info);
              };
            }
          } else if (dimensions != null) {
            if (model.provider === 'openai') options.dimensions = dimensions;
            if (model.provider === 'voyage') options.output_dimension = dimensions;
            if (model.provider === 'gemini') options.outputDimensionality = dimensions;
          }

          console.log(`[embedgen:embed] batch ${i + 1}/${totalBatches} — sending ${batch.length} items (attempt ${attempt + 1})`);
          vectors = await adapter.embed(batch, model.name, apiKey, options);
          console.log(`[embedgen:embed] batch ${i + 1} done — got ${vectors.length} vectors, dim: ${vectors[0]?.length}`);

          if (vectors.length !== batch.length) {
            throw new Error(
              `Embedding count mismatch in batch ${i + 1}: sent ${batch.length} texts but received ${vectors.length} embeddings. ` +
              `One or more inputs may exceed the model's ${model.maxTokens ? `${model.maxTokens}-token` : 'token'} limit.`
            );
          }

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
            console.warn(`[embedgen:embed] rate limit — waiting ${waitMs}ms before retry (attempt ${attempt + 1}/${MAX_RETRIES})`);
            const msg = formatEmbedError(err, { provider: model.provider, attempt: attempt + 1, maxRetries: MAX_RETRIES });
            bar.el.hidden = false;
            bar.setError(msg);
            toaster?.show(msg, { type: 'warning', timeout: waitMs });
            await sleep(waitMs);
            bar.clearError();
            attempt++;
          } else {
            console.error('[embedgen:embed] fatal error', err);
            downloadProgress?.complete();
            bar.el.hidden = false;
            const isDownloadErr = isHuggingFace && i === 0;
            const msg = isDownloadErr
              ? formatDownloadError(err, model.name)
              : formatEmbedError(err, { provider: model.provider });
            bar.setError(msg);
            toaster?.show(msg, { type: 'error', timeout: 0 });
            retryBtn.hidden = false;
            return;
          }
        }
      }

      allVectors.push(...vectors);
    }

    if (cancelled) return;

    console.log(`[embedgen:embed] complete — ${allVectors.length} vectors, dim: ${allVectors[0]?.length}`);
    bar.update({ pct: 1, label: `Done — ${allVectors.length} vectors generated` });

    const metaHeaders = metaColumns ?? [];
    const metaRows = data.rows.map(row =>
      metaHeaders.map(h => row[data.headers.indexOf(h)] ?? '')
    );

    console.log(`[embedgen:embed] metadata columns: [${metaHeaders.join(', ')}] — navigating to export`);
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
