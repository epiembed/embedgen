/**
 * JSON parser for arrays of objects.
 * Returns { headers: string[], rows: (string|null)[][] }.
 */

const URL_PATTERN = /^https?:\/\/.+/i;

/**
 * Parse JSON text into headers and rows.
 * Validates the input is an array of objects.
 * Headers are derived from the union of all object keys, preserving
 * insertion order from the first object, then appending any keys
 * seen in subsequent objects.
 *
 * @param {string} text
 * @returns {{ headers: string[], rows: (string|null)[][] }}
 */
export function parse(text) {
  if (!text || !text.trim()) {
    throw new Error('Input is empty');
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('JSON must be an array of objects');
  }

  if (parsed.length === 0) {
    return { headers: [], rows: [] };
  }

  // Build headers from union of all keys, maintaining insertion order
  const headerSet = new Set();
  for (const obj of parsed) {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('JSON array must contain only objects');
    }
    for (const key of Object.keys(obj)) {
      headerSet.add(key);
    }
  }
  const headers = Array.from(headerSet);

  // Build rows, inserting null for missing keys, stringifying non-null values
  const rows = parsed.map(obj =>
    headers.map(h => {
      const val = obj[h];
      if (val === undefined || val === null) return null;
      return typeof val === 'string' ? val : String(val);
    })
  );

  return { headers, rows };
}

/**
 * Return the indices of columns whose values look like URLs.
 * A column qualifies if at least one non-null value matches the URL pattern.
 *
 * @param {string[]} headers
 * @param {(string|null)[][]} rows
 * @returns {number[]}
 */
export function detectUrlColumns(headers, rows) {
  return headers.reduce((acc, _h, i) => {
    const hasUrl = rows.some(row => row[i] !== null && URL_PATTERN.test(row[i]));
    if (hasUrl) acc.push(i);
    return acc;
  }, []);
}
