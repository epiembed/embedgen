# EmbedGen — Manual Test Script

End-to-end test scenarios for the full EmbedGen user journey. Run these against a locally served build (`npm run dev`) or a deployed instance before each release.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Node / Vite dev server | `npm run dev` — app served at `http://localhost:5173` |
| OpenAI API key | For Scenario 1. Must have access to `text-embedding-3-small`. |
| Voyage AI API key | For Scenario 2 and 3. Must have access to `voyage-4-lite` and `voyage-multimodal-3`. |
| GitHub account | For Scenario 2. A public repo to write to (or the app can create one). |
| Modern browser | Chrome 120+ or Firefox 121+ recommended. |
| Browser DevTools | Keep the Console open throughout — note any uncaught errors. |

### Sample test files

Create the following files locally before running tests. Keep them small (≤ 20 rows) to minimise API costs and wait time.

**`test-text.csv`**
```csv
id,label,description
1,apple,"A round fruit, typically red or green"
2,banana,"A long yellow fruit"
3,cherry,"A small red stone fruit"
4,dog,"A domesticated carnivorous mammal"
5,cat,"A small domesticated carnivore, often kept as a pet"
6,python,"A large non-venomous snake, also a programming language"
7,javascript,"A scripting language used for web development"
8,typescript,"A typed superset of JavaScript"
9,react,"A JavaScript library for building user interfaces"
10,vite,"A fast build tool and dev server"
```

**`test-text.json`**
```json
[
  {"id": 1, "topic": "climate", "text": "Global temperatures have risen by 1.1°C since pre-industrial times."},
  {"id": 2, "topic": "climate", "text": "Arctic sea ice is declining at a rate of 13% per decade."},
  {"id": 3, "topic": "space",   "text": "The James Webb Space Telescope observes in infrared light."},
  {"id": 4, "topic": "space",   "text": "Mars has two small moons: Phobos and Deimos."},
  {"id": 5, "topic": "biology", "text": "DNA carries genetic instructions for growth and reproduction."},
  {"id": 6, "topic": "biology", "text": "Mitochondria are often called the powerhouse of the cell."}
]
```

**`test-images.json`** (use stable public image URLs)
```json
[
  {"id": 1, "label": "cat",    "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/320px-Cat03.jpg"},
  {"id": 2, "label": "dog",    "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/YellowLabradorLooking_new.jpg/320px-YellowLabradorLooking_new.jpg"},
  {"id": 3, "label": "bird",   "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/A_small_cup_of_coffee.JPG/320px-A_small_cup_of_coffee.JPG"},
  {"id": 4, "label": "coffee", "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/A_small_cup_of_coffee.JPG/320px-A_small_cup_of_coffee.JPG"}
]
```

---

## Scenario 1 — CSV → OpenAI → Download ZIP → Manual TF Projector upload

**Goal**: Verify the core text-embedding pipeline with a CSV file, OpenAI model, local download, and manual Projector workflow.

### Steps

**1. Upload**
1. Open the app. Verify the landing page shows the EmbedGen header and a file upload zone.
2. Drag `test-text.csv` onto the upload zone (or click to browse).
3. **Expected**: A data preview table appears showing all 10 rows × 3 columns (`id`, `label`, `description`). Summary reads "10 rows × 3 columns".
4. **Expected**: No console errors.

**2. Configure**
5. In the "Text column" selector, choose `description`.
6. **Expected**: The `description` column is highlighted in the data preview.
7. In the "Metadata columns" section, check `id` and `label`.
8. **Expected**: Both checkboxes are checked; the `id` and `label` columns are highlighted.
9. In the model selector, choose **OpenAI** provider and **text-embedding-3-small** model.
10. **Expected**: A dimension slider appears (Matryoshka). Default dimension is 1536.
11. Drag the slider to **512**.
12. **Expected**: Slider value label updates to "512".
13. Enter your OpenAI API key and click **Verify**.
14. **Expected**: "API key verified" message appears. The "Generate embeddings" button becomes enabled.

**3. Generate**
15. Click **Generate embeddings**.
16. **Expected**: Progress bar advances from 0% to 100%. Label shows something like "Embedding 10 / 10".
17. **Expected**: On completion, the view transitions to the Export step. No console errors.

**4. Export — Download**
18. On the Export view, click **Download ZIP**.
19. **Expected**: A `.zip` file downloads (e.g. `embedgen-export.zip`).
20. Unzip it and verify the following files are present:
    - `tensors.tsv` — 10 rows, each with 512 tab-separated float values.
    - `metadata.tsv` — 11 rows (1 header + 10 data), columns `id` and `label`.
    - `config.json` — references `tensors.tsv` and `metadata.tsv` as relative paths.
21. **Pass**: All three files present with correct structure.
22. **Fail**: Missing files, wrong column count, `config.json` points to absolute URLs.

**5. Visualize — Manual Projector**
23. Open `https://projector.tensorflow.org/` in a new tab.
24. Click **Load data** in the left panel.
25. Upload `tensors.tsv` in the "Step 1" field and `metadata.tsv` in the "Step 2" field.
26. Click **Load**.
27. **Expected**: 10 points appear in the 3D visualisation. Hovering a point shows the corresponding label.
28. **Pass**: Points visible, metadata labels correct.
29. **Fail**: Error loading files, wrong number of points, labels missing.

**6. Return to app — Visualize step**
30. Back in EmbedGen, click **Visualize** (or navigate to the Visualize step).
31. **Expected**: Fallback message appears: "Visualization requires publicly accessible data." A "Save to GitHub" shortcut is visible.
32. **Pass**: Fallback renders correctly.

---

## Scenario 2 — JSON → Voyage AI → Save to GitHub → In-app visualisation

**Goal**: Verify the GitHub save path and the embedded TF Projector iframe with a shareable link.

### Steps

**1. Upload**
1. On the landing page, upload `test-text.json`.
2. **Expected**: Data preview shows 6 rows × 3 columns (`id`, `topic`, `text`).

**2. Configure**
3. Select `text` as the text column.
4. Check `topic` as a metadata column (leave `id` unchecked).
5. Select **Voyage AI** provider and **Voyage 4 Lite** model.
6. **Expected**: Matryoshka dimension slider appears. Legal stops: 256 / 512 / 1024 / 2048.
7. Leave dimensions at the default (2048 — rightmost stop).
8. Enter your Voyage AI API key and click **Verify**.
9. **Expected**: "API key verified".

**3. Generate**
10. Click **Generate embeddings**.
11. **Expected**: Progress bar reaches 100%. Transitions to Export view.

**4. Export — Save to GitHub**
12. Click **Connect with GitHub** (or if already connected, skip to step 14).
13. Complete the GitHub OAuth flow in the pop-up window.
14. **Expected**: GitHub login section shows your avatar and username.
15. In the repository picker, select an existing public repo OR choose "＋ Create new repo…" and create one named `embedgen-test`.
16. Click **Save to GitHub**.
17. **Expected**: Progress indicator advances: "Uploading tensors.tsv… Uploading metadata.tsv… Uploading config.json… Done."
18. **Expected**: Save status changes to success. A "Visualize" button appears.
19. **Pass**: All 3 files committed to the repo. Verify on GitHub.com.
20. **Fail**: Any error message, partial upload, or console network errors.

**5. Visualize — iframe + shareable link**
21. Click **Visualize** (or navigate to Visualize step).
22. **Expected**: A "Shareable link" section appears above the embed. The input contains a `projector.tensorflow.org/?config=...` URL.
23. Click **Copy**. Paste into the browser address bar and open.
24. **Expected**: TF Projector loads with 6 points. Hovering shows `topic` labels.
25. Back in EmbedGen: the iframe below also loads the projection (may take a few seconds).
26. **Pass**: Shareable link works, iframe shows points, labels visible.
27. **Fail**: iframe shows blank or error, link navigates to broken projector page.

**6. Start over**
28. Click **Start over**.
29. **Expected**: Returns to the landing step. State is fully reset (no stale data, API key cleared).

---

## Scenario 3 — Image JSON → Voyage Multimodal → Download

**Goal**: Verify the multimodal (image) embedding path. No GitHub save needed.

### Steps

**1. Upload**
1. Upload `test-images.json`.
2. **Expected**: Data preview shows 4 rows × 3 columns. The `image_url` column renders thumbnail images in the table cells.
3. **Expected**: An "Image mode detected" notice is visible.

**2. Configure**
4. The app should auto-detect `image_url` as the image column. Confirm it is selected.
5. Check `label` as a metadata column.
6. Select **Voyage AI** provider and **Voyage Multimodal 3** model.
7. **Expected**: No dimension slider (model does not support Matryoshka).
8. Enter your Voyage AI API key and click **Verify**.
9. **Expected**: "API key verified".

**3. Generate**
10. Click **Generate embeddings**.
11. **Expected**: Progress bar reaches 100%. Each image URL is sent to the Voyage multimodal endpoint.
12. **Expected**: Transitions to Export view. No console errors.

**4. Export — Download**
13. Click **Download ZIP**.
14. Unzip and verify:
    - `tensors.tsv` — 4 rows, each with 1024 tab-separated float values.
    - `metadata.tsv` — 5 rows (1 header + 4 data), column `label`.
    - `config.json` — correct relative references.
15. **Pass**: All files present, 1024 dimensions per row.
16. **Fail**: Wrong dimension count, missing files.

**5. Visualize — fallback**
17. Navigate to the Visualize step (without saving to GitHub).
18. **Expected**: Fallback message shown — no iframe embed, "Save to GitHub" shortcut visible.
19. Manual steps instructions are displayed: how to upload tensors/metadata to projector.tensorflow.org.
20. **Pass**: Fallback instructions are clear and correct.

---

## Scenario 4 — CSV → HuggingFace in-browser → Download

**Goal**: Verify the in-browser (no API key) embedding path using a HuggingFace ONNX model.

### Steps

**1. Upload**
1. Upload `test-text.csv`.
2. **Expected**: Data preview shows 10 rows × 3 columns.

**2. Configure**
3. Select `description` as the text column.
4. Check `label` as a metadata column.
5. Select **HuggingFace** provider and **all-MiniLM-L6-v2** model.
6. **Expected**: No API key input is shown (in-browser model). No dimension slider.
7. **Expected**: A note is visible: "Runs in-browser. No API key needed. ~23 MB download."
8. The "Generate embeddings" button should be enabled immediately (no key verification needed).

**3. Generate**
9. Click **Generate embeddings**.
10. **Expected**: A model download progress message appears first (first run only, ~23 MB). Subsequent runs use the cached model.
11. **Expected**: After model loads, embedding progress bar runs from 0% to 100%.
12. **Expected**: Transitions to Export view. No console errors.

**4. Export — Download**
13. Click **Download ZIP**.
14. Unzip and verify:
    - `tensors.tsv` — 10 rows, each with 384 tab-separated float values.
    - `metadata.tsv` — 11 rows (1 header + 10 data), column `label`.
    - `config.json` — correct relative references.
15. **Pass**: Correct dimension count (384), all files present.
16. **Fail**: Empty tensors, wrong dimension count, download fails.

**5. Back navigation**
17. From the Export view, click **← Back to configure**.
18. **Expected**: Returns to Configure view with all previous selections intact (column, model, metadata columns).
19. Click **← Back to upload** from Configure.
20. **Expected**: Returns to landing with the data preview still showing.

---

## Cross-cutting checks

Run these checks across all scenarios:

| Check | How to verify |
|---|---|
| **No console errors** | DevTools Console — zero uncaught errors throughout each scenario |
| **Responsive layout** | Resize browser to 375px wide — all content readable, no horizontal scroll |
| **Keyboard navigation** | Tab through all interactive elements — focus ring always visible, logical order |
| **Screen reader headings** | On each step transition, focus moves to the `<h1>` heading |
| **Copy button feedback** | "Copied!" label appears for ~2 s, then reverts to "Copy" |
| **Start over resets state** | After Start over, uploading a new file shows no stale data from the previous session |
| **Invalid API key** | Enter a malformed key and click Verify — clear error message, no unhandled rejection |
| **Empty column selection** | Try to generate without selecting a text column — button should be disabled or show a validation error |

---

## Known limitations (not failures)

- The TF Projector iframe may take 5–10 seconds to load after navigating to the Visualize step — this is normal.
- HuggingFace model download can take 20–60 seconds on first run depending on network speed.
- Private GitHub repos: saving succeeds but the Projector iframe will not load (raw.githubusercontent.com requires auth for private repos). The app shows the fallback — this is expected behaviour.
