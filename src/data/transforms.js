/**
 * Image data transforms for image embedding support.
 *
 * Functions:
 *   extractImageUrls(data, columnName)  — pull URL strings from a parsed dataset column.
 *   validateImageUrls(urls)             — check URL format; optionally HEAD-probe accessibility.
 *   fetchImageAsBase64(url)             — fetch an image and return base64-encoded data + mimeType.
 */

// ── URL extraction ────────────────────────────────────────────────────

/**
 * Extract image URL strings from a named column of a parsed dataset.
 * Null/undefined/empty values are kept as null so row indices stay aligned.
 *
 * @param {{ headers: string[], rows: (string|null)[][] }} data
 * @param {string} columnName
 * @returns {(string|null)[]}
 */
export function extractImageUrls(data, columnName) {
  const colIndex = data.headers.indexOf(columnName);
  if (colIndex === -1) throw new Error(`Column "${columnName}" not found.`);
  return data.rows.map(row => {
    const val = row[colIndex];
    return (val === null || val === undefined || String(val).trim() === '') ? null : String(val).trim();
  });
}

// ── URL validation ────────────────────────────────────────────────────

/** @typedef {{ url: string, valid: boolean, error?: string }} UrlValidationResult */

/**
 * Validate an array of image URLs.
 * Always checks URL format. When `probe` is true, also sends a HEAD request
 * to verify the URL is reachable (best-effort — CORS may block the request).
 *
 * @param {(string|null)[]} urls
 * @param {{ probe?: boolean }} [opts]
 * @returns {Promise<UrlValidationResult[]>}
 */
export async function validateImageUrls(urls, { probe = false } = {}) {
  return Promise.all(urls.map(async url => {
    if (url === null) return { url: '', valid: false, error: 'Empty URL' };

    // Format check
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return { url, valid: false, error: 'Invalid URL format' };
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { url, valid: false, error: 'URL must use http or https' };
    }

    if (!probe) return { url, valid: true };

    // Optional HEAD probe
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (!res.ok) {
        return { url, valid: false, error: `HTTP ${res.status}` };
      }
      const ct = res.headers.get('content-type') ?? '';
      if (ct && !ct.startsWith('image/') && !ct.startsWith('application/octet-stream')) {
        return { url, valid: false, error: `Not an image (content-type: ${ct})` };
      }
      return { url, valid: true };
    } catch {
      // CORS or network error — treat as valid (can't probe from browser)
      return { url, valid: true };
    }
  }));
}

// ── Image fetching ────────────────────────────────────────────────────

/**
 * Fetch an image URL and return base64-encoded data and its MIME type.
 * Useful for APIs that require inline base64 (e.g. Gemini, Voyage multimodal).
 *
 * @param {string} url
 * @returns {Promise<{ data: string, mimeType: string }>}
 */
export async function fetchImageAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);

  const mimeType = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim();
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return { data: btoa(str), mimeType };
}
