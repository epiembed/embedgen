/**
 * Data validation module.
 * Each validator returns { valid, warnings, errors }.
 * run() composes all validators into a single result.
 */

/** @typedef {{ valid: boolean, warnings: string[], errors: string[] }} ValidationResult */

/**
 * Validate that parsed data has at least one row.
 * @param {{ rows: unknown[][] }} data
 * @returns {ValidationResult}
 */
export function validateNotEmpty(data) {
  if (!data.rows || data.rows.length === 0) {
    return { valid: false, warnings: [], errors: ['Dataset is empty — no rows found'] };
  }
  return { valid: true, warnings: [], errors: [] };
}

/**
 * Validate that a named column exists in the headers.
 * @param {{ headers: string[] }} data
 * @param {string} columnName
 * @returns {ValidationResult}
 */
export function validateColumnExists(data, columnName) {
  if (!data.headers.includes(columnName)) {
    return {
      valid: false,
      warnings: [],
      errors: [`Column "${columnName}" not found. Available columns: ${data.headers.join(', ')}`],
    };
  }
  return { valid: true, warnings: [], errors: [] };
}

/**
 * Validate that the embedding column has no null or empty-string values.
 * Reports a warning (not an error) listing how many rows are affected.
 * @param {{ headers: string[], rows: (string|null)[][] }} data
 * @param {string} columnName
 * @returns {ValidationResult}
 */
export function validateNoEmptyValues(data, columnName) {
  const colIndex = data.headers.indexOf(columnName);
  if (colIndex === -1) {
    return { valid: false, warnings: [], errors: [`Column "${columnName}" not found`] };
  }

  const emptyCount = data.rows.filter(row => {
    const val = row[colIndex];
    return val === null || val === undefined || String(val).trim() === '';
  }).length;

  if (emptyCount > 0) {
    return {
      valid: true,
      warnings: [`Column "${columnName}" has ${emptyCount} empty or null value(s) — those rows will be skipped`],
      errors: [],
    };
  }
  return { valid: true, warnings: [], errors: [] };
}

/**
 * Validate that a list of strings are well-formed URLs (http/https).
 * Does not fetch — format-only check.
 * @param {string[]} urls
 * @returns {ValidationResult}
 */
export function validateUrls(urls) {
  const invalid = urls.filter(u => {
    try {
      const parsed = new URL(u);
      return parsed.protocol !== 'http:' && parsed.protocol !== 'https:';
    } catch {
      return true;
    }
  });

  if (invalid.length > 0) {
    return {
      valid: false,
      warnings: [],
      errors: [`${invalid.length} invalid URL(s) found: ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '…' : ''}`],
    };
  }
  return { valid: true, warnings: [], errors: [] };
}

/**
 * Merge an array of ValidationResults into one.
 * @param {ValidationResult[]} results
 * @returns {ValidationResult}
 */
function merge(results) {
  return results.reduce(
    (acc, r) => ({
      valid: acc.valid && r.valid,
      warnings: [...acc.warnings, ...r.warnings],
      errors: [...acc.errors, ...r.errors],
    }),
    { valid: true, warnings: [], errors: [] }
  );
}

/**
 * Run all standard validators for a parsed tabular dataset.
 * @param {{ headers: string[], rows: (string|null)[][] }} data
 * @param {string} columnName  The column that will be embedded
 * @returns {ValidationResult}
 */
export function run(data, columnName) {
  return merge([
    validateNotEmpty(data),
    validateColumnExists(data, columnName),
    validateNoEmptyValues(data, columnName),
  ]);
}
