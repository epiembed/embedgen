// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { detectImageColumns, getDefaultEmbeddingType, renderConfigure } from '../../src/ui/views/configure.js';

const urlData = {
  headers: ['id', 'image_url', 'caption'],
  rows: [
    ['1', 'https://example.com/cat.jpg', 'cat'],
    ['2', 'http://example.com/dog.png', 'dog'],
    ['3', 'not-a-url', 'plain text'],
  ],
};

const textData = {
  headers: ['id', 'caption'],
  rows: [
    ['1', 'cat'],
    ['2', 'dog'],
    ['3', 'bird'],
  ],
};

function createTestStore(initialState) {
  let state = { ...initialState };
  const setState = vi.fn(partial => {
    state = { ...state, ...partial };
  });
  return {
    getState: () => state,
    setState,
  };
}

function renderWithState(state) {
  const container = document.createElement('div');
  const store = createTestStore(state);
  renderConfigure(container, state, store);
  return { container, store };
}

function getRadio(container, value) {
  return container.querySelector(`input[name="configure-embedding-type"][value="${value}"]`);
}

function getModelOptionValues(container) {
  return [...container.querySelectorAll('.model-selector__select option')].map(option => option.value);
}

describe('detectImageColumns', () => {
  it('detects columns when more than half of values are http/https URLs', () => {
    expect(detectImageColumns(urlData).has('image_url')).toBe(true);
  });

  it('does not detect columns at exactly half URL values', () => {
    const data = {
      headers: ['maybe_url'],
      rows: [
        ['https://example.com/a.jpg'],
        ['plain text'],
      ],
    };
    expect(detectImageColumns(data).has('maybe_url')).toBe(false);
  });
});

describe('getDefaultEmbeddingType', () => {
  it('defaults to image for URL-majority columns', () => {
    expect(getDefaultEmbeddingType(urlData, 'image_url')).toBe('image');
  });

  it('defaults to text for regular text columns', () => {
    expect(getDefaultEmbeddingType(urlData, 'caption')).toBe('text');
  });
});

describe('renderConfigure embedding type selector', () => {
  it('renders text and image options with text selected by default', () => {
    const { container } = renderWithState({
      data: textData,
      selectedColumn: 'caption',
      metaColumns: ['id'],
      modelId: null,
      embeddingType: null,
    });

    expect(getRadio(container, 'text').checked).toBe(true);
    expect(getRadio(container, 'image').checked).toBe(false);
  });

  it('selects image by default for a URL-majority selected column', () => {
    const { container } = renderWithState({
      data: urlData,
      selectedColumn: 'image_url',
      metaColumns: ['id', 'caption'],
      modelId: null,
      embeddingType: null,
    });

    expect(getRadio(container, 'image').checked).toBe(true);
    const options = getModelOptionValues(container);
    expect(options).toContain('voyage/voyage-multimodal-3.5');
    expect(options).not.toContain('openai/text-embedding-3-small');
  });

  it('lets the user manually switch regular columns to image embedding', () => {
    const { container, store } = renderWithState({
      data: textData,
      selectedColumn: 'caption',
      metaColumns: ['id'],
      modelId: null,
      embeddingType: null,
    });

    const imageRadio = getRadio(container, 'image');
    imageRadio.checked = true;
    imageRadio.dispatchEvent(new Event('change', { bubbles: true }));

    expect(store.setState).toHaveBeenLastCalledWith(expect.objectContaining({ embeddingType: 'image' }));
    const options = getModelOptionValues(container);
    expect(options).toContain('voyage/voyage-multimodal-3.5');
    expect(options).not.toContain('openai/text-embedding-3-small');
  });

  it('updates the default type when the selected column changes', () => {
    const { container, store } = renderWithState({
      data: urlData,
      selectedColumn: 'caption',
      metaColumns: ['id', 'image_url'],
      modelId: null,
      embeddingType: null,
    });

    const columnSelect = container.querySelector('#configure-embed-col');
    columnSelect.value = 'image_url';
    columnSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(getRadio(container, 'image').checked).toBe(true);
    expect(store.setState).toHaveBeenLastCalledWith(expect.objectContaining({
      selectedColumn: 'image_url',
      embeddingType: 'image',
    }));
  });
});
