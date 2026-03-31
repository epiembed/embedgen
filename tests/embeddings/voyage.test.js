import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adapter } from '../../src/embeddings/voyage.js';
import { ApiKeyError, RateLimitError, QuotaError, EmbeddingError } from '../../src/embeddings/provider.js';

function mockFetch(status, body, headers = {}) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: key => headers[key] ?? null },
    json: async () => body,
  });
}

function embeddingResponse(vectors) {
  return {
    data: vectors.map((embedding, index) => ({ index, embedding })),
  };
}

beforeEach(() => { vi.restoreAllMocks(); });

// ── adapter shape ─────────────────────────────────────────────────────

describe('voyage adapter shape', () => {
  it('has correct name', () => expect(adapter.name).toBe('voyage'));
  it('exposes embed function', () => expect(typeof adapter.embed).toBe('function'));
  it('exposes validateApiKey function', () => expect(typeof adapter.validateApiKey).toBe('function'));
});

// ── embed ─────────────────────────────────────────────────────────────

describe('embed', () => {
  it('returns vectors for a valid response', async () => {
    const vectors = [[0.1, 0.2], [0.3, 0.4]];
    global.fetch = mockFetch(200, embeddingResponse(vectors));
    const result = await adapter.embed(['hello', 'world'], 'voyage-3.5', 'pa-test');
    expect(result).toEqual(vectors);
  });

  it('sends correct model and input in request body', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    await adapter.embed(['hi'], 'voyage-3.5', 'pa-test');

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.model).toBe('voyage-3.5');
    expect(body.input).toEqual(['hi']);
  });

  it('sends Authorization Bearer header', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    await adapter.embed(['hi'], 'voyage-3.5', 'pa-mykey');

    const headers = global.fetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('Bearer pa-mykey');
  });

  it('sends input_type when provided', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    await adapter.embed(['hi'], 'voyage-3.5', 'pa-test', { input_type: 'document' });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.input_type).toBe('document');
  });

  it('omits input_type when null', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    await adapter.embed(['hi'], 'voyage-3.5', 'pa-test', { input_type: null });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.input_type).toBeUndefined();
  });

  it('sends output_dimension for Matryoshka-capable models', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    await adapter.embed(['hi'], 'voyage-4-large', 'pa-test', { output_dimension: 256 });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.output_dimension).toBe(256);
  });

  it('omits output_dimension for non-Matryoshka models', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    await adapter.embed(['hi'], 'voyage-finance-2', 'pa-test', { output_dimension: 256 });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.output_dimension).toBeUndefined();
  });

  it('sends output_dtype for supported models', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    await adapter.embed(['hi'], 'voyage-4', 'pa-test', { output_dtype: 'int8' });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.output_dtype).toBe('int8');
  });

  it('omits output_dtype for models that do not support it', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    await adapter.embed(['hi'], 'voyage-law-2', 'pa-test', { output_dtype: 'int8' });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.output_dtype).toBeUndefined();
  });

  it('sorts results by index', async () => {
    const shuffled = {
      data: [
        { index: 1, embedding: [0.2] },
        { index: 0, embedding: [0.1] },
      ],
    };
    global.fetch = mockFetch(200, shuffled);
    const result = await adapter.embed(['a', 'b'], 'voyage-3.5', 'pa-test');
    expect(result).toEqual([[0.1], [0.2]]);
  });

  it('throws ApiKeyError on 401', async () => {
    global.fetch = mockFetch(401, { detail: 'Invalid API key' });
    await expect(adapter.embed(['hi'], 'voyage-3.5', 'bad-key'))
      .rejects.toBeInstanceOf(ApiKeyError);
  });

  it('throws RateLimitError on 429', async () => {
    global.fetch = mockFetch(429, { detail: 'Rate limit exceeded' }, { 'retry-after': '10' });
    await expect(adapter.embed(['hi'], 'voyage-3.5', 'pa-test'))
      .rejects.toBeInstanceOf(RateLimitError);
  });

  it('throws QuotaError on 429 with quota message', async () => {
    global.fetch = mockFetch(429, { detail: 'Quota exceeded for this month' });
    await expect(adapter.embed(['hi'], 'voyage-3.5', 'pa-test'))
      .rejects.toBeInstanceOf(QuotaError);
  });

  it('throws EmbeddingError on 400', async () => {
    global.fetch = mockFetch(400, { detail: 'Invalid input' });
    await expect(adapter.embed(['hi'], 'voyage-3.5', 'pa-test'))
      .rejects.toBeInstanceOf(EmbeddingError);
  });
});

// ── multimodal embed ──────────────────────────────────────────────────

describe('embed — multimodal (voyage-multimodal-3.5)', () => {
  it('calls the multimodal endpoint', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    await adapter.embed(['hello'], 'voyage-multimodal-3.5', 'pa-test');
    const [url] = global.fetch.mock.calls[0];
    expect(url).toContain('multimodalembeddings');
  });

  it('wraps plain text input as a text content part', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    await adapter.embed(['hello'], 'voyage-multimodal-3.5', 'pa-test');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.inputs[0]).toEqual([{ type: 'text', text: 'hello' }]);
  });

  it('wraps image_url input correctly', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    const input = { type: 'image_url', url: 'https://example.com/img.jpg' };
    await adapter.embed([input], 'voyage-multimodal-3.5', 'pa-test');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.inputs[0]).toEqual([{ type: 'image_url', image_url: { url: 'https://example.com/img.jpg' } }]);
  });

  it('wraps image_base64 input correctly', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    const input = { type: 'image_base64', data: 'abc123', mimeType: 'image/png' };
    await adapter.embed([input], 'voyage-multimodal-3.5', 'pa-test');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.inputs[0]).toEqual([{ type: 'image_base64', image_base64: { base64: 'abc123', media_type: 'image/png' } }]);
  });

  it('sends output_dimension for voyage-multimodal-3.5 (Matryoshka)', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    await adapter.embed(['hi'], 'voyage-multimodal-3.5', 'pa-test', { output_dimension: 512 });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.output_dimension).toBe(512);
  });

  it('does NOT send output_dimension for voyage-multimodal-3 (no Matryoshka)', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    await adapter.embed(['hi'], 'voyage-multimodal-3', 'pa-test', { output_dimension: 512 });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.output_dimension).toBeUndefined();
  });

  it('uses inputs key (not input) in body', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    await adapter.embed(['hi'], 'voyage-multimodal-3.5', 'pa-test');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.inputs).toBeDefined();
    expect(body.input).toBeUndefined();
  });
});

// ── validateApiKey ────────────────────────────────────────────────────

describe('validateApiKey', () => {
  it('returns true for a valid key', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    expect(await adapter.validateApiKey('pa-valid')).toBe(true);
  });

  it('returns false for an invalid key', async () => {
    global.fetch = mockFetch(401, { detail: 'Invalid API key' });
    expect(await adapter.validateApiKey('bad-key')).toBe(false);
  });

  it('rethrows non-auth errors', async () => {
    global.fetch = mockFetch(429, { detail: 'Rate limit exceeded' });
    await expect(adapter.validateApiKey('pa-test')).rejects.toBeInstanceOf(RateLimitError);
  });
});
