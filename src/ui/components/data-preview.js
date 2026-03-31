/**
 * Data preview component.
 * Renders a scrollable table of parsed data with an optional highlighted column.
 *
 * Usage:
 *   const el = createDataPreview({ data, selectedColumn: 'text', maxRows: 10 });
 *   container.appendChild(el);
 *
 *   // Update in place:
 *   updateDataPreview(el, { selectedColumn: 'category' });
 */

/**
 * @param {{ headers: string[], rows: (string|null)[][] }} data
 * @param {string|null} selectedColumn
 * @param {number} maxRows
 * @param {Set<string>} [imageColumns]  Column names whose values should render as thumbnails
 * @returns {HTMLElement}
 */
export function createDataPreview({ data, selectedColumn = null, maxRows = 10, imageColumns = new Set() }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'data-preview';
  render(wrapper, data, selectedColumn, maxRows, imageColumns);
  return wrapper;
}

/**
 * Re-render an existing data preview element with new options.
 * @param {HTMLElement} el  Element returned by createDataPreview
 * @param {{ data?: object, selectedColumn?: string|null, maxRows?: number, imageColumns?: Set<string> }} updates
 */
export function updateDataPreview(el, updates) {
  const prev = el._previewState;
  const next = { ...prev, ...updates };
  el._previewState = next;
  render(el, next.data, next.selectedColumn, next.maxRows, next.imageColumns);
}

// ── Internal helpers ──────────────────────────────────────────────

function render(wrapper, data, selectedColumn, maxRows, imageColumns = new Set()) {
  // Store state for updates
  wrapper._previewState = { data, selectedColumn, maxRows, imageColumns };
  wrapper.innerHTML = '';

  if (!data || !data.headers || data.headers.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'data-preview__empty';
    empty.textContent = 'No data to preview.';
    wrapper.appendChild(empty);
    return;
  }

  const { headers, rows } = data;
  const visibleRows = rows.slice(0, maxRows);
  const selectedIndex = selectedColumn !== null ? headers.indexOf(selectedColumn) : -1;

  // Summary bar
  const summary = document.createElement('p');
  summary.className = 'data-preview__summary';
  summary.textContent = `${rows.length} row${rows.length !== 1 ? 's' : ''} × ${headers.length} column${headers.length !== 1 ? 's' : ''}`;
  if (rows.length > maxRows) {
    summary.textContent += ` — showing first ${maxRows}`;
  }
  wrapper.appendChild(summary);

  // Scroll container
  const scroll = document.createElement('div');
  scroll.className = 'data-preview__scroll';

  const table = document.createElement('table');
  table.className = 'data-preview__table';

  // Header row
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headers.forEach((h, i) => {
    const th = document.createElement('th');
    th.textContent = h;
    if (i === selectedIndex) th.classList.add('data-preview__cell--selected');
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Data rows
  const tbody = document.createElement('tbody');
  visibleRows.forEach(row => {
    const tr = document.createElement('tr');
    headers.forEach((h, i) => {
      const td = document.createElement('td');
      const val = row[i];
      const isEmpty = val === null || val === undefined || String(val).trim() === '';

      if (!isEmpty && imageColumns.has(h)) {
        const img = document.createElement('img');
        img.src = String(val).trim();
        img.alt = '';
        img.className = 'data-preview__thumb';
        img.loading = 'lazy';
        img.width = 48;
        img.height = 48;
        td.appendChild(img);
        td.classList.add('data-preview__cell--image');
      } else {
        td.textContent = isEmpty ? '' : val;
        if (isEmpty) td.classList.add('data-preview__cell--empty');
      }

      if (i === selectedIndex) td.classList.add('data-preview__cell--selected');
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  scroll.appendChild(table);
  wrapper.appendChild(scroll);
}
