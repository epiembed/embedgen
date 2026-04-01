# EmbedGen — Implementation Plan

## Project Overview

**EmbedGen** is a client-side JavaScript web application that converts user-input data into the format expected by [TensorFlow Projector](https://projector.tensorflow.org/). The app supports multiple embedding providers (Voyage AI, OpenAI, Google Gemini, and HuggingFace via Transformers.js for in-browser inference), formats outputs as TensorFlow Projector-compatible files, and persists results either via local download or to GitHub using an OAuth PKCE flow. The app also embeds TensorFlow Projector for in-app visualization.

### Key architectural decisions

- **Build tool**: Vite (dev server + production build for static hosting on GitHub Pages).
- **Testing**: Vitest for unit tests; manual UI verification at the end of each phase.
- **Code style**: ES6 modules. HTML, CSS, and JS in separate files. Highly modularized JS.
- **Hosting**: GitHub Pages (static files only). The only server-side components are the embedding provider APIs and the Cloudflare Worker for GitHub OAuth token exchange.
- **Design**: Elegant, minimalist, and clean CSS.

### Dependency versions (as of March 2026)

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | `^8.0.3` | Build tool. Vite 8 ships Rolldown as its unified Rust-based bundler (replacing the former esbuild + Rollup dual setup), delivering 10–30× faster builds. |
| `vitest` | `^4.1.1` | Unit testing. Vitest 4.x adds support for Vite 8, static test collection, async leak detection, and `mockThrow`/`mockThrowOnce`. |
| `@huggingface/transformers` | `^3.8.1` (stable) or `4.0.0-next.9` (preview via `@next` tag) | In-browser ONNX model inference. The stable v3 is production-ready. The v4 preview (published Feb 2026) features a rewritten C++ WebGPU runtime with ~4× speedup for BERT-based embedding models, full offline support via cached WASM files, and a separate `@huggingface/tokenizers` sub-package. **Recommendation**: Use v3.8.1 for stability. Migrate to v4 once it exits preview. |
| `fflate` | `^0.8.2` | Lightweight ZIP compression (~8 kB). Used for bundling tensor + metadata + config into a downloadable ZIP. |

**Dev-only dependencies** (not shipped to users):
| Package | Version | Purpose |
|---------|---------|---------|
| `jsdom` | latest | DOM simulation for Vitest UI component tests (if needed). |

**No other runtime dependencies.** The app is vanilla JS — no React, no Vue. The GitHub SDK (Octokit) is NOT used; we use raw `fetch` calls to the GitHub REST API, keeping the bundle small.

### Embedding model registry (as of March 2026)

#### Voyage AI (text)
Voyage AI was acquired by MongoDB in 2025. The Voyage 4 series (January 2026) introduces a shared embedding space across all Voyage 4 models, meaning you can embed with `voyage-4-large` and query with `voyage-4-lite` without re-indexing.

| Model ID | Dimensions (default) | Matryoshka dims | Max input tokens | Batch limit | Input types |
|----------|---------------------|-----------------|------------------|-------------|-------------|
| `voyage-4-large` | 1024 | 2048, 1024, 512, 256 | 32K | 120K tokens/request | text |
| `voyage-4` | 1024 | 2048, 1024, 512, 256 | 32K | 320K tokens/request | text |
| `voyage-4-lite` | 1024 | 2048, 1024, 512, 256 | 32K | 1M tokens/request | text |
| `voyage-3.5` | 1024 | 2048, 1024, 512, 256 | 32K | 320K tokens/request | text |
| `voyage-3.5-lite` | 1024 | 2048, 1024, 512, 256 | 32K | 1M tokens/request | text |
| `voyage-3-large` | 1024 | 2048, 1024, 512, 256 | 32K | 120K tokens/request | text |
| `voyage-code-3` | 1024 | 2048, 1024, 512, 256 | 32K | 120K tokens/request | text (code) |
| `voyage-finance-2` | 1024 | — | 32K | 120K tokens/request | text (finance) |
| `voyage-law-2` | 1024 | — | 32K | 120K tokens/request | text (legal) |

- **API endpoint**: `POST https://api.voyageai.com/v1/embeddings`
- **Auth**: Bearer token (API key)
- **Output dtype options** (v4 and v3.5 series): `float`, `int8`, `uint8`, `binary`, `ubinary`
- **`input_type` parameter**: `null`, `"query"`, `"document"`
- **`output_dimension` parameter**: controls Matryoshka truncation server-side

#### Voyage AI (multimodal)
| Model ID | Dimensions (default) | Matryoshka dims | Input types |
|----------|---------------------|-----------------|-------------|
| `voyage-multimodal-3.5` | 1024 | 2048, 1024, 512, 256 | text + images + video |
| `voyage-multimodal-3` | 1024 | — | text + images |

- **API endpoint**: `POST https://api.voyageai.com/v1/multimodalembeddings`

#### OpenAI
| Model ID | Dimensions (default) | Matryoshka dims | Max tokens | Max batch size |
|----------|---------------------|-----------------|------------|---------------|
| `text-embedding-3-large` | 3072 | Any value ≤ 3072 | 8191 | 2048 inputs |
| `text-embedding-3-small` | 1536 | Any value ≤ 1536 | 8191 | 2048 inputs |
| `text-embedding-ada-002` | 1536 | — (no Matryoshka) | 8191 | 2048 inputs |

- **API endpoint**: `POST https://api.openai.com/v1/embeddings`
- **Auth**: Bearer token (API key)
- **`dimensions` parameter**: controls Matryoshka truncation server-side (only for `text-embedding-3-*`)
- **Note**: OpenAI does NOT offer image/multimodal embedding via its embeddings endpoint.

#### Google Gemini
| Model ID | Dimensions (default) | Matryoshka dims | Max tokens | Input types | Notes |
|----------|---------------------|-----------------|------------|-------------|-------|
| `gemini-embedding-001` | 3072 | Any (recommend 768, 1536, 3072) | 2048 | text only | GA since July 2025. #1 on MTEB Multilingual leaderboard. |
| `gemini-embedding-2-preview` | 3072 | Any (recommend 768, 1536, 3072) | — | text, images, video, audio, PDFs | Released March 2026. First fully multimodal Gemini embedding. Preview status. |

- **API endpoint (Gemini API)**: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent?key={apiKey}`
- **Batch endpoint**: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:batchEmbedContents?key={apiKey}`
- **Auth**: API key as query parameter
- **`output_dimensionality` parameter**: controls Matryoshka truncation
- **`task_type` parameter**: `"RETRIEVAL_DOCUMENT"`, `"RETRIEVAL_QUERY"`, `"SEMANTIC_SIMILARITY"`, `"CLASSIFICATION"`, `"CLUSTERING"`
- **Note**: `text-embedding-004` was deprecated January 14, 2026. Use `gemini-embedding-001`.
- **Pricing**: $0.15/1M tokens for gemini-embedding-001; $0.20/1M tokens for gemini-embedding-2-preview; free tier available.

#### HuggingFace (in-browser via Transformers.js)
These models run entirely in the browser using ONNX Runtime (WASM or WebGPU). No API key needed. Full data privacy.

| Model ID (HF Hub) | Parameters | Dimensions | Quantized size | Notes |
|--------------------|-----------|------------|----------------|-------|
| `Xenova/all-MiniLM-L6-v2` | 22M | 384 | ~23 MB (q8) | Most popular. Well-tested. Sentence-transformers classic. |
| `Xenova/bge-small-en-v1.5` | 33M | 384 | ~33 MB (q8) | BAAI BGE. Strong English retrieval. Requires `query:` prefix for queries. |
| `Xenova/gte-small` | 33M | 384 | ~33 MB (q8) | Alibaba GTE. Good general purpose. |
| `mixedbread-ai/mxbai-embed-xsmall-v1` | 22M | 384 | ~23 MB (q8) | Mixedbread. Efficient and high quality. |
| `nomic-ai/nomic-embed-text-v1.5` | 137M | 768 | ~34 MB (q4) | Nomic. Larger but higher quality. Matryoshka support (768, 512, 256, 128, 64). |
| `onnx-community/embeddinggemma-300m-ONNX` | 300M | 768 | ~150 MB (q4) | Google EmbeddingGemma. High quality but large download. |

- **Library**: `@huggingface/transformers` (pipeline API, `feature-extraction` task)
- **Acceleration**: WebGPU (if available in browser, set `device: 'webgpu'`), otherwise WASM fallback
- **Post-processing**: Mean pooling + L2 normalization (model-dependent; some models handle this internally)
- **Caching**: Models are cached in the browser's Cache API after first download

### Repository structure (target)

```
embedgen/
├── index.html
├── vite.config.js
├── vitest.config.js
├── package.json
├── public/
│   └── (static assets: favicon, etc.)
├── src/
│   ├── main.js                     # App entry point
│   ├── css/
│   │   ├── main.css                # Global styles, CSS variables
│   │   ├── components.css          # Component-specific styles
│   │   └── layout.css              # Layout and responsive grid
│   ├── config/
│   │   ├── app.js                  # App-wide constants
│   │   ├── models.js               # Embedding model registry
│   │   └── github.js               # GitHub OAuth config
│   ├── core/
│   │   ├── state.js                # Simple reactive state manager
│   │   └── router.js               # Step/view navigation
│   ├── data/
│   │   ├── parsers/
│   │   │   ├── csv.js              # CSV/TSV parser
│   │   │   ├── json.js             # JSON parser (text + image)
│   │   │   └── projector.js        # TF Projector format parser
│   │   ├── validators.js           # QC and validation rules
│   │   └── transforms.js           # Column selection, batching
│   ├── embeddings/
│   │   ├── provider.js             # Provider interface/base
│   │   ├── openai.js               # OpenAI adapter
│   │   ├── gemini.js               # Google Gemini adapter
│   │   ├── voyage.js               # Voyage AI adapter
│   │   ├── huggingface.js          # HuggingFace/Transformers.js adapter
│   │   ├── batcher.js              # Intelligent batching logic
│   │   └── matryoshka.js           # Matryoshka dimension truncation
│   ├── export/
│   │   ├── tensor.js               # Tensor TSV + binary encoder
│   │   ├── metadata.js             # Metadata TSV encoder
│   │   ├── config.js               # Projector config JSON builder
│   │   ├── download.js             # ZIP/download handler
│   │   └── github.js               # GitHub API persistence
│   ├── github/
│   │   ├── auth.js                 # PKCE OAuth flow
│   │   ├── api.js                  # GitHub REST API wrapper
│   │   └── repo.js                 # Repo creation + file management
│   ├── visualizer/
│   │   ├── projector.js            # TF Projector iframe integration
│   │   └── link.js                 # External link builder
│   └── ui/
│       ├── components/
│       │   ├── file-upload.js      # Drag-and-drop file upload
│       │   ├── data-preview.js     # Tabular data preview
│       │   ├── model-selector.js   # Embedding model picker
│       │   ├── dimension-slider.js # Matryoshka dim slider
│       │   ├── progress-bar.js     # Embedding progress
│       │   ├── api-key-input.js    # API key secure input
│       │   ├── github-login.js     # GitHub auth button
│       │   ├── repo-picker.js      # Repo selector/creator
│       │   └── notification.js     # Toast notifications
│       ├── views/
│       │   ├── landing.js          # Landing/upload view
│       │   ├── configure.js        # Model + column config view
│       │   ├── embed.js            # Embedding progress view
│       │   ├── export.js           # Download/GitHub save view
│       │   └── visualize.js        # Projector visualization view
│       └── render.js               # DOM rendering helpers
└── tests/
    ├── data/
    │   ├── parsers/
    │   │   ├── csv.test.js
    │   │   ├── json.test.js
    │   │   └── projector.test.js
    │   ├── validators.test.js
    │   └── transforms.test.js
    ├── embeddings/
    │   ├── batcher.test.js
    │   ├── matryoshka.test.js
    │   ├── openai.test.js
    │   ├── gemini.test.js
    │   ├── voyage.test.js
    │   └── huggingface.test.js
    ├── export/
    │   ├── tensor.test.js
    │   ├── metadata.test.js
    │   ├── config.test.js
    │   └── download.test.js
    ├── github/
    │   ├── auth.test.js
    │   └── api.test.js
    └── fixtures/
        ├── sample.csv
        ├── sample.json
        ├── sample-images.json
        ├── sample-tensor.tsv
        └── sample-metadata.tsv
```

---

## Phase 0 — Project Scaffolding and Tooling

**Goal**: A runnable Vite project with testing infrastructure, linting, CI-ready scripts, and the full directory skeleton. No application logic yet.

### Task 0.1 — Initialize the Vite project

**What**: Run `npm create vite@latest` (vanilla JS template). This will scaffold a Vite 8 project. Configure `vite.config.js` for GitHub Pages deployment (set `base` to the repo name). Add the `index.html` entry point that loads `src/main.js` as a module.

**Sub-tasks**:
1. `npm init` + install `vite@^8.0.3` as a dev dependency.
2. Create `vite.config.js` with `base: '/embedgen/'` (or configurable), and any aliases.
3. Create `index.html` with `<script type="module" src="/src/main.js"></script>` and a `<link>` to the main CSS.
4. Create `src/main.js` with a simple `console.log('EmbedGen loaded')`.

**Verification**:
- `npm run dev` starts the dev server and the browser console shows the log message.
- `npm run build` produces a `dist/` folder with valid static files.
- `npm run preview` serves the build and the page loads.

### Task 0.2 — Configure Vitest

**What**: Install and configure Vitest. Create a sample test to verify the pipeline works.

**Sub-tasks**:
1. `npm install -D vitest@^4.1.1`.
2. Create `vitest.config.js` (or add `test` config to `vite.config.js`).
3. Create `tests/setup.test.js` with a trivial passing test.
4. Add `"test"` and `"test:watch"` scripts to `package.json`.

**Verification**:
- `npm test` runs and the trivial test passes.
- `npm run test:watch` enters watch mode.

### Task 0.3 — Create the directory skeleton

**What**: Create all directories and stub files as shown in the repository structure above. Each `.js` module file should export an empty function or a placeholder comment. Each CSS file should be empty or contain a comment.

**Verification**:
- All directories and files exist.
- `npm run dev` still starts without errors (no import resolution failures).

### Task 0.4 — CSS foundation and base HTML shell

**What**: Set up CSS variables for the design system (colors, fonts, spacing, radii, shadows). Create the HTML shell with a header, a `<main>` content area, and a footer. The header should display "EmbedGen" as the app name.

**Sub-tasks**:
1. In `src/css/main.css`: define CSS custom properties (`:root` block) — a neutral, elegant palette, a clean sans-serif font stack, spacing scale.
2. In `src/css/layout.css`: basic page layout (centered content, max-width, responsive padding).
3. In `src/css/components.css`: placeholder file.
4. In `index.html`: semantic structure — `<header>`, `<main id="app">`, `<footer>`.

**Verification**:
- The dev server shows a styled page with the "EmbedGen" header and footer.
- The layout is centered and responsive on mobile/desktop viewports.

### Task 0.5 — Create test fixture files

**What**: Create small, representative test fixture files.

**Sub-tasks**:
1. `tests/fixtures/sample.csv` — 5 rows, 3 columns (id, text, category).
2. `tests/fixtures/sample.json` — same data as JSON array of objects.
3. `tests/fixtures/sample-images.json` — 3 entries with `image_url` and `caption` fields.
4. `tests/fixtures/sample-tensor.tsv` — 5 rows × 4 dimensions (tab-separated numbers).
5. `tests/fixtures/sample-metadata.tsv` — 5 rows, 2 columns with header.

**Verification**:
- Files exist and can be read in tests using `fs` (Node) or Vite's `?raw` import.

---

## Phase 1 — Data Ingestion and Parsing

**Goal**: The user can upload files (CSV, TSV, JSON, or previously exported TF Projector files), and the app parses and validates them. A data preview table renders in the UI.

### Task 1.1 — CSV/TSV parser module (`src/data/parsers/csv.js`)

**What**: Implement a parser that accepts a string and returns `{ headers: string[], rows: string[][] }`. Auto-detect delimiter (comma vs tab). Handle quoted fields, escaped quotes, and newlines within quotes.

**Sub-tasks**:
1. Write delimiter detection logic (count commas vs tabs in the first line).
2. Implement RFC 4180-compliant parsing (handle quoted fields).
3. Return normalized output structure.

**Verification**:
- Unit tests: parse `sample.csv`, parse a TSV variant, parse edge cases (quoted commas, empty fields, trailing newline).
- `npm test -- tests/data/parsers/csv.test.js` — all pass.

### Task 1.2 — JSON parser module (`src/data/parsers/json.js`)

**What**: Parse JSON text. Validate that the result is an array of objects. Extract headers from union of all object keys. Normalize to `{ headers, rows }`. For image JSON, detect columns that contain URLs (simple URL pattern regex).

**Sub-tasks**:
1. Parse JSON, validate it is an array of objects.
2. Compute headers from the union of keys across all objects (maintain insertion order from first object, append missing keys).
3. Build rows, inserting `null` for missing keys.
4. Add a `detectUrlColumns(headers, rows)` helper that returns column indices whose values look like URLs.

**Verification**:
- Unit tests: parse `sample.json`, parse `sample-images.json`, error on non-array JSON, handle objects with inconsistent keys.

### Task 1.3 — TF Projector format parser (`src/data/parsers/projector.js`)

**What**: Parse previously exported TF Projector data. Accept a tensor TSV string and optional metadata TSV string. Return `{ vectors: number[][], metadata: { headers: string[], rows: string[][] } | null }`.

**Sub-tasks**:
1. Parse tensor TSV: split by newlines, split each line by tabs, parse numbers. Handle the optional first-column label (per TF Projector's `parseTensors()` logic described in the spec).
2. Validate uniform dimensionality (≥ 2).
3. Parse metadata TSV: detect header row (first line contains tab → it's a header), parse rows.
4. Validate that tensor row count matches metadata row count (if both present).

**Verification**:
- Unit tests: parse `sample-tensor.tsv` + `sample-metadata.tsv`, parse tensor-only, reject mismatched row counts, reject < 2 dimensions.

### Task 1.4 — Data validation module (`src/data/validators.js`)

**What**: Quality-control checks that run after parsing.

**Sub-tasks**:
1. `validateNotEmpty(data)` — rows exist.
2. `validateColumnExists(data, columnName)` — the column to embed exists.
3. `validateNoEmptyValues(data, columnName)` — the embedding column has no nulls/empty strings (or report how many).
4. `validateUrlsReachable(urls)` — optional async check for image URLs (just validate URL format, don't fetch).
5. Return a `{ valid: boolean, warnings: string[], errors: string[] }` structure.

**Verification**:
- Unit tests: each validator with valid and invalid inputs.

### Task 1.5 — File upload UI component (`src/ui/components/file-upload.js`)

**What**: A drag-and-drop + click-to-browse file upload component. Accepts `.csv`, `.tsv`, `.json`, `.txt` files. Reads the file as text using `FileReader`. Fires a callback with `{ fileName, content, type }`.

**Sub-tasks**:
1. Create the DOM structure (drop zone with icon, label, hidden `<input type="file">`).
2. Wire drag/drop events (`dragover`, `dragleave`, `drop`) and click-to-browse.
3. Read file via `FileReader.readAsText()`.
4. Detect file type from extension.
5. Style the drop zone in `components.css`.

**Verification**:
- Manual UI test: drag a CSV file into the drop zone → callback fires with file content.
- Manual UI test: click the zone → native file picker opens → selecting a file triggers the callback.
- Visual: the drop zone highlights on drag-over.

### Task 1.6 — Data preview UI component (`src/ui/components/data-preview.js`)

**What**: Render a scrollable HTML table showing the first N rows (default 10) of parsed data. Highlight the selected embedding column. Show row count and column count summary.

**Verification**:
- Manual UI test: after uploading `sample.csv`, a table appears with headers and 5 rows.
- The selected column (if any) is visually highlighted.

### Task 1.7 — Landing view (`src/ui/views/landing.js`)

**What**: The first view the user sees. Contains two cards/buttons: "Upload Raw Data" and "Upload TF Projector Data". Each triggers the file upload component with appropriate accepted file types. After successful parse, transition to the configure view.

**Sub-tasks**:
1. Render two option cards.
2. On raw data upload: parse with CSV or JSON parser (auto-detect), run validators, show data preview.
3. On projector data upload: parse with projector parser, skip embedding step (go straight to export/visualize).
4. Wire up simple view navigation (update `state`, re-render).

**Verification**:
- Manual UI test: landing page shows two options.
- Upload a CSV → data preview appears below.
- Upload a tensor TSV → parsed successfully and view changes.

### Task 1.8 — State management (`src/core/state.js`)

**What**: A simple reactive state store. Holds the current step, parsed data, selected model, embeddings, etc. Emits change events so views can re-render.

**Sub-tasks**:
1. Implement a `createStore(initialState)` function that returns `{ getState, setState, subscribe }`.
2. `subscribe(listener)` registers a callback; `setState(partial)` shallow-merges and notifies listeners.

**Verification**:
- Unit tests: subscribe → setState → listener called with new state. Multiple subscribers. Unsubscribe.

### Task 1.9 — View router (`src/core/router.js`)

**What**: A simple step-based router. The app has steps: `landing` → `configure` → `embed` → `export` → `visualize`. The router listens to `state.step` and renders the appropriate view into `<main id="app">`.

**Verification**:
- Unit test: changing `state.step` triggers the correct view render function.
- Manual UI test: navigation between landing and configure views works.

---

## Phase 2 — Embedding Provider Framework and Cloud Providers

**Goal**: The user selects an embedding model, enters an API key, selects the column to embed, and the app generates embeddings via cloud provider APIs. Covers Voyage AI, OpenAI, and Google Gemini.

### Task 2.1 — Model registry (`src/config/models.js`)

**What**: A declarative registry of all supported embedding models. Refer to the **Embedding model registry** table in the Project Overview above for the full list of models and their specs.

```js
// Example structure per model:
{
  id: 'openai/text-embedding-3-small',
  provider: 'openai',
  name: 'text-embedding-3-small',
  displayName: 'OpenAI text-embedding-3-small',
  dimensions: 1536,
  maxTokens: 8191,
  maxBatchSize: 2048,
  supportsMatryoshka: true,
  matryoshkaDimensions: [256, 512, 1024, 1536],   // any value ≤ 1536
  inputType: 'text',           // 'text' | 'image' | 'multimodal'
  apiEndpoint: 'https://api.openai.com/v1/embeddings',
}
```

Populate the registry with **all** current models listed in the Embedding model registry section:
- **Voyage AI (text)**: voyage-4-large, voyage-4, voyage-4-lite, voyage-3.5, voyage-3.5-lite, voyage-3-large, voyage-code-3, voyage-finance-2, voyage-law-2.
- **Voyage AI (multimodal)**: voyage-multimodal-3.5, voyage-multimodal-3.
- **OpenAI**: text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002.
- **Google Gemini**: gemini-embedding-001, gemini-embedding-2-preview.
- **HuggingFace (in-browser)**: all-MiniLM-L6-v2, bge-small-en-v1.5, gte-small, mxbai-embed-xsmall-v1, nomic-embed-text-v1.5, embeddinggemma-300m-ONNX.

**Important notes for the registry**:
- Voyage 4 models share an embedding space — document this in the model metadata so users know they can mix models within the series.
- Voyage v4 and v3.5 series support `output_dtype` options (`float`, `int8`, `uint8`, `binary`, `ubinary`). Include this in the registry.
- Google `text-embedding-004` is deprecated (Jan 2026) — do NOT include it.
- Google `gemini-embedding-2-preview` is still in preview — flag this in the UI.

**Verification**:
- Unit test: registry returns all models for a given provider. Lookup by ID works. Filter by `inputType` works.

### Task 2.2 — Provider interface (`src/embeddings/provider.js`)

**What**: Define the interface that all provider adapters must implement.

```js
// Each adapter exports:
{
  name: string,
  embed(texts: string[], model: string, apiKey: string, options?: object): Promise<number[][]>,
  validateApiKey(apiKey: string): Promise<boolean>,
}
```

Also define shared error types: `ApiKeyError`, `RateLimitError`, `QuotaError`.

**Verification**:
- Unit test: interface validation helper that checks an adapter object has the required shape.

### Task 2.3 — Intelligent batcher (`src/embeddings/batcher.js`)

**What**: Given an array of texts and model constraints (`maxBatchSize`, `maxTokens`), split into optimal batches. Use a simple token estimator (character count / 4 as a rough heuristic, or a proper tokenizer if available).

**Sub-tasks**:
1. `createBatches(texts, maxBatchSize, maxTokensPerBatch)` → returns `string[][]`.
2. Estimate token count per text.
3. Greedily fill batches up to both limits.

**Verification**:
- Unit tests: 10 texts with batch size 3 → 4 batches. Token limit splits long texts into smaller batches. Empty input returns empty. Single oversized text gets its own batch.

### Task 2.4 — Matryoshka dimension handler (`src/embeddings/matryoshka.js`)

**What**: For models that support Matryoshka Representation Learning, handle dimension selection and truncation. Note that dimension handling varies by provider:
- **OpenAI**: Server-side truncation via `dimensions` parameter; any value ≤ max is legal.
- **Voyage AI** (v4 and v3.5 series): Server-side truncation via `output_dimension` parameter; legal values are 2048, 1024, 512, 256.
- **Google Gemini**: Server-side truncation via `outputDimensionality`; recommended values are 768, 1536, 3072 (any value works).
- **HuggingFace** (nomic-embed-text-v1.5): Client-side truncation; legal values are 768, 512, 256, 128, 64.
- **HuggingFace** (other models): No Matryoshka support; use full dimensions only.

For cloud providers, the API handles truncation server-side (just pass the dimension parameter). For HuggingFace models, truncation + re-normalization must happen client-side.

**Sub-tasks**:
1. `getLegalDimensions(modelId)` — returns the array of allowed dimensions from the model registry.
2. `truncateEmbeddings(vectors, targetDim)` — slice each vector to the target dimension.
3. `normalizeEmbeddings(vectors)` — L2-normalize after truncation (important for Matryoshka).

**Verification**:
- Unit tests: truncate 1536-dim vectors to 256, verify length and normalization. Return full dimensions if model doesn't support Matryoshka.

### Task 2.5 — OpenAI adapter (`src/embeddings/openai.js`)

**What**: Implement the embed function for OpenAI's API.

**Sub-tasks**:
1. Construct `POST https://api.openai.com/v1/embeddings` requests with `{ model, input, dimensions? }`.
2. Parse the response: extract embedding vectors from `data[].embedding`.
3. Handle errors: 401 (bad key), 429 (rate limit), 400 (input too long).
4. Pass `dimensions` parameter for Matryoshka models (text-embedding-3-*). Note: any integer value ≤ the model's max is accepted (not just specific stops). The server truncates the embedding to the requested dimension.
5. Implement `validateApiKey` by making a minimal embedding request.

**Verification**:
- Unit tests (mocked fetch): valid response → returns vectors. 401 → throws `ApiKeyError`. 429 → throws `RateLimitError`. Dimensions parameter is included for Matryoshka models.
- Manual test (with real API key): embed 3 short texts with `text-embedding-3-small` → returns 3 vectors of correct dimensions.

### Task 2.6 — Voyage AI adapter (`src/embeddings/voyage.js`)

**What**: Implement the embed function for Voyage AI's API.

**Sub-tasks**:
1. Construct `POST https://api.voyageai.com/v1/embeddings` requests with `{ model, input, input_type, output_dimension?, output_dtype? }`.
2. Parse the response: extract embedding vectors from `data[].embedding`.
3. Handle `input_type` parameter (`"document"` for embedding, `"query"` for search).
4. Support `output_dimension` parameter for Matryoshka models (Voyage 4 and 3.5 series support 2048, 1024, 512, 256).
5. Support `output_dtype` parameter for quantized embeddings (`float`, `int8`, `uint8`, `binary`, `ubinary`) — Voyage 4 and 3.5 series.
6. Handle errors (401, 429, etc.).

**Verification**:
- Unit tests (mocked fetch): same pattern as OpenAI.
- Manual test: embed 3 texts with `voyage-3.5` → correct vectors.
- Manual test: embed with `output_dimension: 256` → verify truncated output.

### Task 2.7 — Google Gemini adapter (`src/embeddings/gemini.js`)

**What**: Implement the embed function for Google's Gemini embedding API.

**Sub-tasks**:
1. Construct requests to `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent?key={apiKey}` for single input, or `:batchEmbedContents` for batch.
2. Handle the Gemini-specific request format: `{ model, content: { parts: [{ text }] }, taskType?, outputDimensionality? }`. Note: `gemini-embedding-001` accepts only **one input per request** via the standard endpoint; use `batchEmbedContents` to batch (array of `requests`).
3. Support `outputDimensionality` parameter for Matryoshka (recommend 768, 1536, 3072).
4. Support `taskType` parameter (`RETRIEVAL_DOCUMENT`, `RETRIEVAL_QUERY`, `SEMANTIC_SIMILARITY`, `CLASSIFICATION`, `CLUSTERING`).
5. Parse response: extract from `embedding.values` (single) or `embeddings[].values` (batch).
6. Handle errors.
7. Note: `text-embedding-004` is deprecated (Jan 2026). Do NOT use it.

**Verification**:
- Unit tests (mocked fetch): same pattern.
- Manual test: embed 3 texts with `gemini-embedding-001`.

### Task 2.8 — Model selector UI (`src/ui/components/model-selector.js`)

**What**: A dropdown/card UI for selecting the embedding provider and model. Groups models by provider. Shows model metadata (dimensions, input type).

**Verification**:
- Manual UI test: dropdown shows all models grouped by provider. Selecting a model updates the state.

### Task 2.9 — API key input UI (`src/ui/components/api-key-input.js`)

**What**: A secure input field for the API key. Password-type input with show/hide toggle. Stores the key only in memory (never persisted). Optional "Validate" button that calls the adapter's `validateApiKey`.

**Verification**:
- Manual UI test: key is masked by default. Toggle reveals it. Validate button shows success/error.

### Task 2.10 — Dimension slider UI (`src/ui/components/dimension-slider.js`)

**What**: When a model supports Matryoshka, show a slider with discrete stops at the legal dimension values. Hidden for non-Matryoshka models.

**Verification**:
- Manual UI test: select `text-embedding-3-small` → slider appears (any value ≤ 1536). Select `voyage-4-large` → slider appears with stops at 2048, 1024, 512, 256. Select `gemini-embedding-001` → slider with recommended 768, 1536, 3072. Select `nomic-embed-text-v1.5` → slider with 768, 512, 256, 128, 64. Select `all-MiniLM-L6-v2` → slider hidden (no Matryoshka support).

### Task 2.11 — Configure view (`src/ui/views/configure.js`)

**What**: The view where the user selects the column to embed, chooses a model, enters the API key, and sets the dimension (if Matryoshka). Contains a "Generate Embeddings" button.

**Sub-tasks**:
1. Column selector dropdown (populated from parsed data headers).
2. Metadata column multi-select (which other columns to keep as metadata).
3. Model selector component.
4. API key input component.
5. Dimension slider (conditional).
6. "Generate Embeddings" button.

**Verification**:
- Manual UI test: full configuration workflow — select column, select model, enter key, adjust dimension → click Generate.

### Task 2.12 — Embedding progress UI (`src/ui/components/progress-bar.js`) and embed view (`src/ui/views/embed.js`)

**What**: Show a progress bar during embedding. Display batch N/M, estimated time remaining, and a cancel button.

**Sub-tasks**:
1. Progress bar component with percentage, label, and cancel.
2. Embed view orchestrates: creates batches → iterates batches → calls adapter → accumulates vectors → updates progress → on complete, transitions to export view.
3. Handle errors gracefully (show error, allow retry).
4. Implement retry with exponential backoff for rate-limit errors.

**Verification**:
- Manual UI test: start embedding with a real API key and 5 text rows → progress bar fills → vectors stored in state.
- Cancel mid-way → embedding stops, user can go back to configure.

---

## Phase 3 — HuggingFace In-Browser Embeddings

**Goal**: Full in-browser embedding using HuggingFace models via Transformers.js (ONNX Runtime). This provides data privacy since no data leaves the browser.

### Task 3.1 — Research and select models

**What**: Identify well-tested HuggingFace ONNX models for text embedding that work with Transformers.js. Criteria: small model size (< 150MB quantized), good quality, available in ONNX format on HuggingFace. Refer to the **HuggingFace (in-browser)** table in the Embedding model registry above.

Recommended models (all tested with Transformers.js v3.8.1):
- `Xenova/all-MiniLM-L6-v2` — 22M params, 384 dims, ~23 MB (q8). The most popular and well-tested option.
- `Xenova/bge-small-en-v1.5` — 33M params, 384 dims, ~33 MB (q8). BAAI BGE, strong English retrieval. Requires `query: ` prefix for query texts.
- `Xenova/gte-small` — 33M params, 384 dims, ~33 MB (q8). Alibaba GTE, good general purpose.
- `mixedbread-ai/mxbai-embed-xsmall-v1` — 22M params, 384 dims, ~23 MB (q8). Efficient and high quality.
- `nomic-ai/nomic-embed-text-v1.5` — 137M params, 768 dims, ~34 MB (q4). Higher quality, supports Matryoshka (768, 512, 256, 128, 64).
- `onnx-community/embeddinggemma-300m-ONNX` — 300M params, 768 dims, ~150 MB (q4). Google DeepMind's EmbeddingGemma. High quality but large download. Flag this as "large download" in the UI.

Add these to the model registry with `provider: 'huggingface'` and `runtime: 'transformers.js'`.

**Verification**:
- Unit test: model registry includes HuggingFace models with correct metadata.

### Task 3.2 — Transformers.js integration (`src/embeddings/huggingface.js`)

**What**: Implement the HuggingFace adapter using `@huggingface/transformers` library.

**Sub-tasks**:
1. Install `@huggingface/transformers@^3.8.1` as a dependency. (When v4 exits preview and reaches stable, upgrade to take advantage of the ~4× speedup for BERT-based models and improved WebGPU runtime.)
2. Use the `pipeline('feature-extraction', modelId, { device: 'webgpu' })` API with WASM fallback. In v3, WebGPU is available via `device: 'webgpu'`. If `navigator.gpu` is not available, fall back to default WASM.
3. Run inference in a Web Worker to avoid blocking the main thread.
4. Create `src/workers/embedding-worker.js` — receives text batches, loads the model (caching it), returns vectors.
5. Handle model download progress (the first run downloads the ONNX model; show progress to user).
6. Implement mean pooling + L2 normalization post-processing.
7. Attempt WebGPU acceleration (`device: 'webgpu'`) with WASM fallback.

**Sub-tasks for the Web Worker**:
1. Worker receives `{ type: 'init', modelId }` → loads pipeline, posts back `{ type: 'ready' }`.
2. Worker receives `{ type: 'embed', texts, batchIndex }` → runs pipeline, posts back `{ type: 'result', vectors, batchIndex }`.
3. Worker receives `{ type: 'cancel' }` → terminates.
4. Worker posts `{ type: 'progress', ... }` during model download.

**Verification**:
- Unit test (mocked): worker message protocol round-trips correctly.
- Manual test: select `all-MiniLM-L6-v2` → model downloads (progress shown) → embed 5 texts → vectors returned (384 dims each) → no API key required.
- Verify the main thread remains responsive during embedding (UI doesn't freeze).

### Task 3.3 — Model download progress UI

**What**: When a HuggingFace model is selected, show a download progress indicator during the first use (model files are cached by the browser after the first download).

**Verification**:
- Manual UI test: first time selecting a HF model → download bar shows file size and progress → on completion, embedding begins.
- Second time → no download, embedding starts immediately.

### Task 3.4 — Adapt configure and embed views for HuggingFace

**What**: When a HuggingFace model is selected, hide the API key input. Show a note about in-browser processing and data privacy. The embed view should handle the Web Worker lifecycle.

**Verification**:
- Manual UI test: select a HuggingFace model → API key field disappears → "Your data stays in your browser" note appears → embedding runs via worker.

---

## Phase 4 — TensorFlow Projector Export

**Goal**: Convert the embedding tensor and metadata into TensorFlow Projector-compatible formats. Enable download as a combined file or as separate files.

### Task 4.1 — Tensor encoder (`src/export/tensor.js`)

**What**: Convert `number[][]` embeddings into the two supported formats.

**Sub-tasks**:
1. `toTSV(vectors)` — join each vector with `\t`, join rows with `\n`. No header row.
2. `toBinary(vectors)` — create a `Float32Array` from the flat vector data, return as `ArrayBuffer`.
3. `fromTSV(tsvString)` — parse back (for round-trip testing).
4. `fromBinary(buffer, shape)` — parse back.

**Verification**:
- Unit tests: encode → decode round-trip for both formats. Verify binary output byte length = N × D × 4.

### Task 4.2 — Metadata encoder (`src/export/metadata.js`)

**What**: Convert selected metadata columns into TSV format.

**Sub-tasks**:
1. `toTSV(headers, rows)` — first line is tab-separated headers, subsequent lines are tab-separated values. Replace `null`/`undefined` with empty string.
2. Handle single-column case (no header row, per TF Projector spec).

**Verification**:
- Unit tests: multi-column metadata with header. Single-column without header. Null handling. Round-trip with the projector parser from Phase 1.

### Task 4.3 — Config JSON builder (`src/export/config.js`)

**What**: Build the `ProjectorConfig` JSON.

**Sub-tasks**:
1. `buildConfig({ tensorName, tensorShape, tensorPath, metadataPath, sprite? })` — returns the JSON object.
2. For download mode: paths are relative filenames.
3. For GitHub mode: paths are raw GitHub URLs (`https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`).

**Verification**:
- Unit tests: config with and without sprite. GitHub URL construction. Shape matches actual tensor dimensions.

### Task 4.4 — Download handler (`src/export/download.js`)

**What**: Bundle tensor, metadata, and config into a downloadable package.

**Sub-tasks**:
1. For the "single file for TF Projector" download: create a TSV file where tensor data has optional label column prepended (from first metadata column), so the user can drag-and-drop it into TF Projector's "Load" dialog.
2. For the "full export" download: create a ZIP file containing `tensors.tsv` (or `tensors.bytes`), `metadata.tsv`, and `config.json`. Use `fflate@^0.8.2` (~8 kB gzipped, pure JS, no dependencies).
3. Trigger browser download via `URL.createObjectURL` + temporary `<a>` element.

**Verification**:
- Unit tests: ZIP contains the expected files with correct content.
- Manual test: download the ZIP → unzip → verify files open in a text editor and match expected format.
- Manual test: upload the TSV to https://projector.tensorflow.org → data loads and visualizes correctly.

### Task 4.5 — Export view (`src/ui/views/export.js`)

**What**: The export view presents two options: "Download to Disk" and "Save to GitHub". Shows a summary of the embedding (N points, D dimensions, model used). The download button triggers immediately. The GitHub button leads to the GitHub auth flow (Phase 5).

**Verification**:
- Manual UI test: after embedding, the export view shows correct summary.
- Click "Download" → ZIP downloads.
- Click "Save to GitHub" → transitions to GitHub auth (placeholder for now).

---

## Phase 5 — GitHub Persistence

**Goal**: Implement the OAuth PKCE flow to authenticate with GitHub, then save tensor, metadata, and config files to the user's GitHub repository with structured directory layout.

### Task 5.1 — PKCE OAuth flow (`src/github/auth.js`)

**What**: Implement the GitHub OAuth PKCE flow as described in the [github-backend](https://github.com/jeyabbalas/github-backend) reference repo.

**Sub-tasks**:
1. `generateCodeVerifier()` — random 64-char string.
2. `generateCodeChallenge(verifier)` — SHA-256 hash, base64url-encoded.
3. `generateState()` — random CSRF token.
4. `initiateLogin(clientId, redirectUri, workerUrl)` — store verifier+state in `sessionStorage`, redirect to GitHub authorize URL with PKCE params.
5. `handleCallback()` — on page load, check for `?code=` and `?state=` params, verify state, exchange code for token via Cloudflare Worker, store token in `sessionStorage`.
6. `getToken()` — retrieve from `sessionStorage`.
7. `logout()` — clear `sessionStorage`.

**Verification**:
- Unit tests (mocked): code verifier generation produces 64-char string. Code challenge is valid SHA-256. State verification rejects mismatched state. Token exchange constructs correct request to worker URL.
- Manual test: clicking "Login with GitHub" redirects to GitHub → after authorization, redirected back with token stored in session.

### Task 5.2 — GitHub API wrapper (`src/github/api.js`)

**What**: Thin wrapper around the GitHub REST API using `fetch` + the stored access token.

**Sub-tasks**:
1. `getUser()` — `GET /user`.
2. `listRepos()` — `GET /user/repos` (paginated, sorted by updated).
3. `createRepo(name, description, isPublic)` — `POST /user/repos`.
4. `getContents(owner, repo, path)` — `GET /repos/{owner}/{repo}/contents/{path}`.
5. `createOrUpdateFile(owner, repo, path, content, message, sha?)` — `PUT /repos/{owner}/{repo}/contents/{path}`. Content must be base64-encoded.
6. Error handling: 401 → trigger re-auth. 404 → file doesn't exist (OK for create). 422 → conflict.

**Verification**:
- Unit tests (mocked fetch): each method constructs the correct request. Error handling works.
- Manual test: after login, `getUser()` returns the logged-in user's info.

### Task 5.3 — Repository picker/creator UI (`src/ui/components/repo-picker.js`)

**What**: A component that lists the user's repos in a dropdown and has a "Create New Repo" option. When creating, prompt for repo name and description.

**Verification**:
- Manual UI test: after GitHub login, dropdown shows the user's repos. "Create New" option opens a form. Creating a repo succeeds and it appears in the dropdown.

### Task 5.4 — GitHub file persistence (`src/export/github.js`)

**What**: Save the tensor, metadata, and config to the selected GitHub repo with a structured directory layout.

**Sub-tasks**:
1. Directory structure within the repo:
   ```
   embedgen-data/
   └── {timestamp}-{model-name}/
       ├── tensors.bytes        # Binary format for efficient storage
       ├── metadata.tsv
       └── config.json
   ```
2. Base64-encode binary tensor data for the GitHub API.
3. Save files sequentially (GitHub API doesn't support atomic multi-file commits via the Contents API without the Git Data API, so use the Git Data API for atomic commits):
   - Create blobs for each file.
   - Get the current commit SHA and tree SHA.
   - Create a new tree with the three files.
   - Create a new commit.
   - Update the ref.
4. Build raw GitHub URLs for the config file: `https://raw.githubusercontent.com/{owner}/{repo}/main/embedgen-data/{dir}/config.json`.
5. Update config.json to contain raw GitHub URLs for tensor and metadata paths.

**Verification**:
- Unit tests: directory path generation, base64 encoding, URL construction.
- Manual test: save to GitHub → navigate to the repo on GitHub.com → verify the directory structure and file contents.
- Verify raw URLs are accessible and return correct content.

### Task 5.5 — GitHub login UI (`src/ui/components/github-login.js`)

**What**: A "Login with GitHub" button. After login, show the user's avatar and username. Show "Logout" option.

**Verification**:
- Manual UI test: button initiates OAuth flow. After login, avatar + name displayed. Logout clears session.

### Task 5.6 — Update export view with GitHub flow

**What**: Integrate the GitHub persistence into the export view. After "Save to GitHub" is clicked: authenticate (if not already) → pick/create repo → save files → show success with the raw config URL.

**Verification**:
- Manual end-to-end test: embed 5 texts → export → save to GitHub → verify on GitHub.com → copy the config URL.

---

## Phase 6 — TensorFlow Projector Integration

**Goal**: Embed TensorFlow Projector within the app for in-app visualization, and provide external links for users who prefer the standalone projector.

### Task 6.1 — Research TF Projector embedding options

**What**: Investigate the feasibility of embedding TensorFlow Projector.

Options to evaluate:
1. **iframe with URL parameters**: The standalone projector at `https://projector.tensorflow.org/` accepts a `?config=` URL parameter pointing to a JSON config file. If the user saved to GitHub, we have a raw URL for the config. Embed via `<iframe src="https://projector.tensorflow.org/?config={configUrl}">`.
2. **Self-hosted standalone**: The [embedding-projector-standalone](https://github.com/tensorflow/embedding-projector-standalone) repo contains a single `index.html` that bundles the projector. It could potentially be served from our own GitHub Pages alongside the app.
3. **Blob URL approach**: For local-only data (no GitHub), create blob URLs for the tensor/metadata files, construct a config pointing to them, and pass to the projector. This may not work due to cross-origin restrictions in the iframe.

Document the chosen approach and any limitations.

**Verification**:
- A written decision document in the codebase (`docs/projector-integration.md`) with the chosen approach, tested limitations, and fallback strategy.

### Task 6.2 — Projector iframe integration (`src/visualizer/projector.js`)

**What**: Implement the chosen integration approach.

**Sub-tasks**:
1. For GitHub-saved data: construct the TF Projector URL with `?config=` parameter and render in an iframe.
2. For local-only data: either warn that visualization requires GitHub upload, or implement a workaround (e.g., a local HTTP server isn't feasible for static hosting, so this may require GitHub persistence).
3. Handle iframe sizing (full-width, appropriate height).
4. Add a "Open in New Tab" button that opens the TF Projector URL directly.

**Verification**:
- Manual test: save to GitHub → visualize view → iframe loads TF Projector with the data → 3D/2D scatter plot appears.
- Manual test: "Open in New Tab" opens the projector in a new browser tab.

### Task 6.3 — External link builder (`src/visualizer/link.js`)

**What**: For users who saved to GitHub, construct a shareable link: `https://projector.tensorflow.org/?config={rawGitHubConfigUrl}`.

**Verification**:
- Unit test: URL construction.
- Manual test: the generated link loads correctly in a browser.

### Task 6.4 — Visualize view (`src/ui/views/visualize.js`)

**What**: The final view. Shows the embedded projector (if data was saved to GitHub) or instructions to upload to TF Projector manually (if downloaded locally). Provides the shareable link and a "Start Over" button.

**Verification**:
- Manual end-to-end test: complete the full flow from landing to visualization.

---

## Phase 7 — Image Embedding Support

**Goal**: Support image embeddings. The user provides JSON with image URLs. The app fetches images, sends them to a multimodal embedding API, and generates embeddings.

### Task 7.1 — Image data handling (`src/data/transforms.js`)

**What**: For image embedding, extract image URLs from the selected column and prefetch/validate them.

**Sub-tasks**:
1. `extractImageUrls(data, columnName)` — extract URL strings.
2. `validateImageUrls(urls)` — check URL format, optionally HEAD request to verify accessibility.
3. `fetchImageAsBase64(url)` — fetch image, convert to base64 (needed for some APIs).
4. Batch image URLs similar to text batching.

**Verification**:
- Unit tests: URL extraction, validation with valid/invalid URLs.
- Manual test: upload `sample-images.json` → URLs extracted and validated.

### Task 7.2 — Update adapters for image input

**What**: Extend Voyage and Gemini adapters to support image embedding where the provider supports it.

**Sub-tasks**:
1. **Voyage AI**: `voyage-multimodal-3.5` (released Jan 2026) supports text + images + video. `voyage-multimodal-3` supports text + images. The multimodal endpoint is `POST https://api.voyageai.com/v1/multimodalembeddings`. Inputs are structured as arrays of mixed content (text strings, image objects). Images can be sent as base64-encoded data or URLs. `voyage-multimodal-3.5` also supports Matryoshka (2048, 1024, 512, 256) — the first production-grade multimodal model to do so.
2. **Google Gemini**: `gemini-embedding-2-preview` (released March 2026) natively embeds text, images, video, audio, and PDFs into a unified space. Pass image data as inline base64 with `inlineData: { mimeType, data }` in the content parts. This is in preview status — flag it in the UI.
3. **OpenAI**: Does NOT offer image/multimodal embedding via the embeddings endpoint. Skip. Show a clear note in the UI that OpenAI models are text-only.
4. Update the model registry to flag which models support image input (`inputType: 'multimodal'`).

**Verification**:
- Unit tests (mocked): image embedding request format is correct for each provider.
- Manual test: embed 3 image URLs with `voyage-multimodal-3.5` → vectors returned.
- Manual test: embed 3 images with `gemini-embedding-2-preview` → vectors returned.

### Task 7.3 — Update UI for image mode

**What**: When the user's data contains image URLs and they select an image-capable model, show image thumbnails in the data preview. Hide text-only models from the model selector.

**Verification**:
- Manual test: upload image JSON → thumbnails shown → only multimodal models available → embedding works.

---

## Phase 8 — Polish, Error Handling, and End-to-End Testing

**Goal**: Production-quality UX, comprehensive error handling, accessibility, and full end-to-end testing.

### Task 8.1 — Notification/toast system (`src/ui/components/notification.js`)

**What**: A toast notification component for success, warning, and error messages. Auto-dismiss after a configurable timeout.

**Verification**:
- Manual UI test: trigger success/warning/error toasts → they appear, auto-dismiss, and can be manually closed.

### Task 8.2 — Comprehensive error handling

**What**: Audit every async operation and add user-friendly error handling.

**Sub-tasks**:
1. File parsing errors → show specific message (e.g., "Invalid CSV: unterminated quote on line 42").
2. API errors → show provider-specific guidance (e.g., "OpenAI returned 429: you've hit the rate limit. The app will retry automatically.").
3. GitHub errors → handle auth expiry, permission errors, network failures.
4. Model download errors → suggest checking internet connection.

**Verification**:
- Manual test: deliberately trigger each error type and verify the user sees a helpful message.

### Task 8.3 — Loading states and empty states

**What**: Every view and component should have appropriate loading and empty states.

**Verification**:
- Manual UI test: loading spinner during file parse, model download, API calls. Empty state when no data uploaded.

### Task 8.4 — Responsive design

**What**: Ensure the app works well on tablet and mobile viewports (down to 375px width).

**Verification**:
- Manual test: resize browser to various widths → layout adapts, no horizontal scroll, all controls usable.

### Task 8.5 — Accessibility audit

**What**: Add ARIA labels, keyboard navigation, focus management, color contrast compliance.

**Verification**:
- Manual test: navigate the entire app using only keyboard. Screen reader announces all interactive elements.

### Task 8.6 — End-to-end manual test script

**What**: Write a documented manual test script covering the full user journey.

**Test scenarios**:
1. Upload CSV → select text column → OpenAI embedding → download ZIP → load in TF Projector.
2. Upload JSON → Voyage AI embedding → save to GitHub → visualize in-app.
3. Upload image JSON → multimodal embedding → download.
4. Upload CSV → HuggingFace in-browser embedding → download.
5. Upload previously exported TF Projector data → visualize directly.
6. Error scenarios: invalid file, wrong API key, rate limit, network failure.

**Verification**:
- All 6 scenarios pass without errors.

### Task 8.7 — GitHub Pages deployment configuration

**What**: Configure the build for GitHub Pages deployment.

**Sub-tasks**:
1. Verify `vite.config.js` `base` is set correctly.
2. Add a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds and deploys to `gh-pages` branch on push to `main`.
3. Ensure all asset paths are relative.
4. Test the deployed version.

**Verification**:
- Push to `main` → GitHub Actions runs → site is live at `https://{username}.github.io/embedgen/`.
- All features work on the deployed version.

### Task 8.8 — GitHub OAuth Worker deployment

**What**: Deploy the Cloudflare Worker token-exchange proxy and wire up the OAuth environment variables so the "Save to GitHub" feature works on the live site.

**Sub-tasks**:
1. Create `worker/index.js` — Cloudflare Worker that receives `{ code, code_verifier }`, exchanges it with the GitHub OAuth endpoint using the stored client secret, and returns `{ access_token }`. Includes CORS headers for the GitHub Pages origin.
2. Deploy the worker via Wrangler (`npx wrangler deploy worker/index.js --name embedgen-oauth`) and set `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` as Worker secrets.
3. Create a GitHub OAuth App (Settings → Developer settings → OAuth Apps) with the callback URL set to `https://{username}.github.io/embedgen/`.
4. Add `VITE_GITHUB_CLIENT_ID` and `VITE_GITHUB_WORKER_URL` as GitHub Actions repository variables.
5. Update `.github/workflows/deploy.yml` to pass those variables as `env` on the `npm run build` step so Vite bakes them into the bundle.

**Sub-task 6** (added): Add a "Folder path" input to the repo picker so users can choose where in the repo files are saved. Default: `embedgen-data`. A timestamped subfolder is always appended to avoid overwrites. Changes: `repo-picker.js` (UI + `getSelected` returns `folder`), `export/github.js` (`buildFilePaths` and `saveToGitHub` accept `folder`), `export.js` (passes `selection.folder`).

**Verification**:
- Click "Save to GitHub" on the export view → redirected to GitHub login → redirected back → token exchanged → repo picker loads with a "Folder path" input → user can type a custom path → file committed to the specified folder → no `client_id=` empty URL in the browser network tab.

---

## Phase Summary

| Phase | Focus | Key Deliverable |
|-------|-------|----------------|
| 0 | Scaffolding | Runnable Vite project with tests, directory skeleton, CSS foundation |
| 1 | Data Ingestion | File upload, parsing (CSV/TSV/JSON/Projector), validation, data preview |
| 2 | Cloud Embeddings | Voyage AI, OpenAI, Gemini adapters, model selector, batching, progress |
| 3 | In-Browser Embeddings | HuggingFace via Transformers.js, Web Worker, model download |
| 4 | Export | Tensor/metadata/config encoding, ZIP download |
| 5 | GitHub Persistence | PKCE OAuth, repo management, file upload, raw URLs |
| 6 | Visualization | TF Projector iframe integration, shareable links |
| 7 | Image Embeddings | Image URL handling, multimodal adapters |
| 8 | Polish | Error handling, responsiveness, accessibility, deployment |

### Dependency graph

```
Phase 0 (scaffolding)
  └──▶ Phase 1 (data ingestion)
         └──▶ Phase 2 (cloud embeddings)
         │      └──▶ Phase 4 (export)
         │             ├──▶ Phase 5 (GitHub persistence)
         │             │      └──▶ Phase 6 (visualization)
         │             └──▶ Phase 6 (visualization)
         └──▶ Phase 3 (HuggingFace in-browser)
                └──▶ Phase 4 (export) [same as above]
  Phase 7 (image embeddings) depends on Phase 2 + Phase 4
  Phase 8 (polish) depends on all prior phases
```

### Notes for coding agents

1. **Always run `npm test` after completing each task** to ensure no regressions.
2. **Keep modules small and focused** — each file should have a single responsibility.
3. **No frameworks** — this is vanilla JS with ES6 modules. Use the DOM API directly.
4. **CSS in separate files** — never inline styles in JS. Use CSS classes and CSS custom properties.
5. **Error messages should be user-friendly** — never expose raw stack traces to the user.
6. **API keys are never persisted** — store only in memory (JS variable). The API key input should be `type="password"`.
7. **The GitHub token uses `sessionStorage`** — cleared when the tab closes.
8. **Test with real APIs sparingly** — unit tests should mock `fetch`. Manual tests with real APIs are for verification only.
9. **Anthropic does not have its own embedding model** — Voyage AI (now owned by MongoDB) is Anthropic's recommended embedding provider. When the spec says "Anthropic", implement Voyage AI.
10. **Pin dependency versions** — Use the versions listed in the Dependency Versions table above. Specifically: `vite@^8.0.3`, `vitest@^4.1.1`, `@huggingface/transformers@^3.8.1`, `fflate@^0.8.2`.
11. **Vite 8 uses Rolldown** — Rolldown is now the sole bundler (replacing esbuild + Rollup). If you encounter build issues, consult the Vite 8 migration guide. The `vite.config.js` syntax is unchanged.
12. **Google `text-embedding-004` is deprecated** — it was sunset January 14, 2026. Always use `gemini-embedding-001` for text or `gemini-embedding-2-preview` for multimodal.
13. **Voyage 4 shared embedding space** — All Voyage 4 models (voyage-4-large, voyage-4, voyage-4-lite) produce embeddings in the same vector space. This is a unique feature worth highlighting in the UI.
14. **Transformers.js v4 is in preview** — v4 (available via `@next` tag, e.g., `@huggingface/transformers@4.0.0-next.9`) offers a rewritten C++ WebGPU runtime with ~4× speedup for BERT-based embedding models. However, it is NOT yet stable. Use v3.8.1 for now. When v4 reaches GA, migration should be straightforward — the `pipeline()` API is the same.
