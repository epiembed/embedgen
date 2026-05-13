// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createDataPreview } from '../../src/ui/components/data-preview.js';

describe('createDataPreview image columns', () => {
  it('renders thumbnails only for http/https URL values', () => {
    const preview = createDataPreview({
      data: {
        headers: ['image'],
        rows: [
          ['https://example.com/cat.jpg'],
          ['not-a-url'],
        ],
      },
      selectedColumn: 'image',
      imageColumns: new Set(['image']),
    });

    const images = preview.querySelectorAll('img.data-preview__thumb');
    expect(images).toHaveLength(1);
    expect(images[0].src).toBe('https://example.com/cat.jpg');
    expect(preview.textContent).toContain('not-a-url');
  });
});
