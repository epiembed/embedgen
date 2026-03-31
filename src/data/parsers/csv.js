/**
 * CSV/TSV parser.
 * Returns { headers: string[], rows: string[][] }.
 */

/**
 * Detect delimiter by counting commas vs tabs in the first line.
 * @param {string} text
 * @returns {string} ',' or '\t'
 */
function detectDelimiter(text) {
  const firstLine = text.slice(0, text.indexOf('\n') >>> 0 || text.length);
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  return tabs >= commas ? '\t' : ',';
}

/**
 * Parse a single RFC 4180 record from `text` starting at `pos`.
 * @param {string} text
 * @param {number} pos
 * @param {string} delimiter
 * @returns {{ fields: string[], nextPos: number }}
 */
function parseRecord(text, pos, delimiter) {
  const fields = [];
  const len = text.length;

  while (pos <= len) {
    if (text[pos] === '"') {
      // Quoted field
      let field = '';
      pos++; // skip opening quote
      while (pos < len) {
        if (text[pos] === '"') {
          if (text[pos + 1] === '"') {
            // Escaped quote
            field += '"';
            pos += 2;
          } else {
            pos++; // skip closing quote
            break;
          }
        } else {
          field += text[pos];
          pos++;
        }
      }
      fields.push(field);
    } else {
      // Unquoted field — read until delimiter or line ending
      let field = '';
      while (pos < len && text[pos] !== delimiter && text[pos] !== '\n' && text[pos] !== '\r') {
        field += text[pos];
        pos++;
      }
      fields.push(field);
    }

    // After each field, expect a delimiter or end-of-record
    if (pos >= len || text[pos] === '\n' || text[pos] === '\r') {
      break;
    }
    if (text[pos] === delimiter) {
      pos++; // skip delimiter, read next field
    }
  }

  // Consume line ending (\r\n or \n)
  if (pos < len && text[pos] === '\r') pos++;
  if (pos < len && text[pos] === '\n') pos++;

  return { fields, nextPos: pos };
}

/**
 * Parse CSV or TSV text into headers and rows.
 * @param {string} text
 * @returns {{ headers: string[], rows: string[][] }}
 */
export function parse(text) {
  if (!text || !text.trim()) {
    throw new Error('Input is empty');
  }

  // Normalize line endings
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const trimmed = normalized.trimEnd();

  const delimiter = detectDelimiter(trimmed);
  const records = [];
  let pos = 0;

  while (pos < trimmed.length) {
    const { fields, nextPos } = parseRecord(trimmed, pos, delimiter);
    records.push(fields);
    pos = nextPos;
  }

  if (records.length === 0) {
    throw new Error('No records found');
  }

  const headers = records[0];
  const rows = records.slice(1);

  return { headers, rows };
}
