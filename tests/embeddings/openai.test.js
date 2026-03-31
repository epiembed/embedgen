import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adapter } from '../../src/embeddings/openai.js';
import { ApiKeyError, RateLimitError, QuotaError, EmbeddingError } from '../../src/embeddings/provider.js';

// ── fetch mock helpers ────────────────────────────────────────────────

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

describe('openai adapter shape', () => {
  it('has correct name', () => expect(adapter.name).toBe('openai'));
  it('exposes embed function', () => expect(typeof adapter.embed).toBe('function'));
  it('exposes validateApiKey function', () => expect(typeof adapter.validateApiKey).toBe('function'));
});

// ── embed ─────────────────────────────────────────────────────────────

describe('embed', () => {
  it('returns vectors for a valid response', async () => {
    const vectors = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];
    global.fetch = mockFetch(200, embeddingResponse(vectors));

    const result = await adapter.embed(['hello', 'world'], 'text-embedding-3-small', 'sk-test');
    expect(result).toEqual(vectors);
  });

  it('sends the correct request body', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    await adapter.embed(['hi'], 'text-embedding-3-small', 'sk-test');

    const [, init] = global.fetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.model).toBe('text-embedding-3-small');
    expect(body.input).toEqual(['hi']);
  });

  it('sends Authorization header', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    await adapter.embed(['hi'], 'text-embedding-3-small', 'sk-mykey');

    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers['Authorization']).toBe('Bearer sk-mykey');
  });

  it('includes dimensions param for text-embedding-3-* models', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    await adapter.embed(['hi'], 'text-embedding-3-small', 'sk-test', { dimensions: 256 });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.dimensions).toBe(256);
  });

  it('omits dimensions param for ada-002', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    await adapter.embed(['hi'], 'text-embedding-ada-002', 'sk-test', { dimensions: 256 });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.dimensions).toBeUndefined();
  });

  it('sorts results by index to preserve input order', async () => {
    const shuffled = {
      data: [
        { index: 2, embedding: [0.3] },
        { index: 0, embedding: [0.1] },
        { index: 1, embedding: [0.2] },
      ],
    };
    global.fetch = mockFetch(200, shuffled);
    const result = await adapter.embed(['a', 'b', 'c'], 'text-embedding-3-small', 'sk-test');
    expect(result).toEqual([[0.1], [0.2], [0.3]]);
  });

  it('throws ApiKeyError on 401', async () => {
    global.fetch = mockFetch(401, { error: { message: 'Invalid API key' } });
    await expect(adapter.embed(['hi'], 'text-embedding-3-small', 'bad-key'))
      .rejects.toBeInstanceOf(ApiKeyError);
  });

  it('throws RateLimitError on 429', async () => {
    global.fetch = mockFetch(429, { error: { message: 'Rate limit' } }, { 'retry-after': '5' });
    await expect(adapter.embed(['hi'], 'text-embedding-3-small', 'sk-test'))
      .rejects.toBeInstanceOf(RateLimitError);
  });

  it('RateLimitError carries retryAfter from header', async () => {
    global.fetch = mockFetch(429, { error: { message: 'Rate limit' } }, { 'retry-after': '30' });
    try {
      await adapter.embed(['hi'], 'text-embedding-3-small', 'sk-test');
    } catch (err) {
      expect(err.retryAfter).toBe(30);
    }
  });

  it('throws QuotaError on 429 with insufficient_quota code', async () => {
    global.fetch = mockFetch(429, { error: { message: 'Quota exceeded', code: 'insufficient_quota' } });
    await expect(adapter.embed(['hi'], 'text-embedding-3-small', 'sk-test'))
      .rejects.toBeInstanceOf(QuotaError);
  });

  it('throws EmbeddingError on 400', async () => {
    global.fetch = mockFetch(400, { error: { message: 'Input too long' } });
    await expect(adapter.embed(['hi'], 'text-embedding-3-small', 'sk-test'))
      .rejects.toBeInstanceOf(EmbeddingError);
  });
});

// ── validateApiKey ────────────────────────────────────────────────────

describe('validateApiKey', () => {
  it('returns true when key is valid', async () => {
    global.fetch = mockFetch(200, embeddingResponse([[0.1]]));
    expect(await adapter.validateApiKey('sk-valid')).toBe(true);
  });

  it('returns false when key is invalid (401)', async () => {
    global.fetch = mockFetch(401, { error: { message: 'Invalid API key' } });
    expect(await adapter.validateApiKey('bad-key')).toBe(false);
  });

  it('rethrows non-auth errors', async () => {
    global.fetch = mockFetch(429, { error: { message: 'Rate limit' } });
    await expect(adapter.validateApiKey('sk-test')).rejects.toBeInstanceOf(RateLimitError);
  });
});
