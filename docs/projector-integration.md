# TF Projector Integration — Decision Document

## Options evaluated

### Option 1 — iframe with `?config=` URL parameter ✅ CHOSEN

The hosted projector at `https://projector.tensorflow.org/` accepts a `?config=` query
parameter pointing to a publicly accessible JSON config file. EmbedGen produces exactly
this format (`config.json`) when saving to GitHub.

**How it works:**
1. User saves embeddings to GitHub → gets a `raw.githubusercontent.com` config URL.
2. App constructs: `https://projector.tensorflow.org/?config={rawConfigUrl}`
3. Projector fetches `config.json`, then fetches the referenced tensor and metadata URLs.
4. All three files are on `raw.githubusercontent.com`, which sends
   `Access-Control-Allow-Origin: *` — CORS is satisfied.

**Pros:**
- Zero infrastructure — uses the official hosted projector.
- No extra assets to bundle or deploy.
- Shareable: the constructed URL works in any browser, by anyone.
- Projector is actively maintained by Google.

**Cons:**
- Requires data to be saved to a **public** GitHub repo (private repos return 404 for
  raw URLs without a token, and the projector iframe can't pass auth headers).
- Depends on `projector.tensorflow.org` remaining available.
- iframe height needs manual sizing; projector doesn't communicate its preferred size.

**Verdict:** Best option for EmbedGen's GitHub-first workflow. Covers the primary use case
with minimal complexity.

---

### Option 2 — Self-hosted standalone projector

The [`embedding-projector-standalone`](https://github.com/tensorflow/embedding-projector-standalone)
repo ships a single bundled `index.html` (~5–8 MB). It could be deployed alongside
EmbedGen on GitHub Pages.

**Pros:**
- No external dependency on `projector.tensorflow.org`.
- Same-origin deployment would allow blob: URL data sources (see Option 3).

**Cons:**
- The standalone bundle is large and would inflate the GitHub Pages repo.
- Still fetches data files via XHR/fetch — CORS still applies unless data is same-origin.
- The standalone repo is infrequently updated and may lag behind the hosted version.
- Adds maintenance burden (updating the bundled projector).

**Verdict:** Not worth the complexity for this project. Revisit only if the hosted
projector becomes unavailable.

---

### Option 3 — Blob URL approach (local-only data)

For data that hasn't been saved to GitHub, create `blob:` object URLs for the tensor and
metadata files in the browser, construct a config pointing to them, and pass the config
URL to the projector iframe.

**Why this doesn't work:**
- The projector iframe is hosted at `projector.tensorflow.org` — a different origin.
- `blob:` URLs are scoped to the origin that created them. A cross-origin iframe
  **cannot** fetch a `blob:` URL from another origin; the request is blocked.
- There is no postMessage API in the TF Projector to inject data directly.

**Verdict:** Not feasible for the hosted projector. Only viable if self-hosting the
projector on the same origin (see Option 2), which introduces its own trade-offs.

---

## Chosen approach

**Option 1** — `?config=` iframe for GitHub-saved data.

For **local-only exports** (user downloaded ZIP but didn't save to GitHub), the visualize
view will:
1. Show a clear message: visualization requires the data to be publicly accessible.
2. Offer a "Save to GitHub" shortcut that returns to the export view.
3. Provide a manual fallback: instructions to visit `projector.tensorflow.org`, click
   "Load data", and upload the `tensors.tsv` + `metadata.tsv` files from the ZIP.

## Limitations

| Scenario | Support |
|---|---|
| Saved to public GitHub repo | Full iframe visualization + shareable link |
| Saved to private GitHub repo | Manual upload only (raw URLs require auth) |
| Downloaded ZIP, no GitHub | Manual upload only |
| Offline / no internet | Neither (projector.tensorflow.org requires network) |

## iframe sizing

The projector does not expose a resize API. We'll render the iframe at `100%` width and
a fixed `600px` height (with a resize handle via CSS `resize: vertical`). An
"Open in new tab" button will always be present so the user can break out to full-screen.
