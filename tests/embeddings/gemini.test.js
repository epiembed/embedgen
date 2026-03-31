import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adapter } from '../../src/embeddings/gemini.js';
import { ApiKeyError, RateLimitError, QuotaError, EmbeddingError } from '../../src/embeddings/provider.js';

function mockFetch(status, body, headers = {}) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: key => headers[key] ?? null },
    json: async () => body,
  });
}

function batchResponse(vectors) {
  return { embeddings: vectors.map(values => ({ values })) };
}

beforeEach(() => { vi.restoreAllMocks(); });

// ── adapter shape ─────────────────────────────────────────────────────

describe('gemini adapter shape', () => {
  it('has correct name', () => expect(adapter.name).toBe('gemini'));
  it('exposes embed function', () => expect(typeof adapter.embed).toBe('function'));
  it('exposes validateApiKey function', () => expect(typeof adapter.validateApiKey).toBe('function'));
});

// ── embed ─────────────────────────────────────────────────────────────

describe('embed', () => {
  it('returns vectors in input order', async () => {
    const vectors = [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]];
    global.fetch = mockFetch(200, batchResponse(vectors));
    const result = await adapter.embed(['a', 'b', 'c'], 'gemini-embedding-001', 'AIza-test');
    expect(result).toEqual(vectors);
  });

  it('sends API key as query parameter (not header)', async () => {
    global.fetch = mockFetch(200, batchResponse([[0.1]]));
    await adapter.embed(['hi'], 'gemini-embedding-001', 'AIza-mykey');

    const [url] = global.fetch.mock.calls[0];
    expect(url).toContain('key=AIza-mykey');
    const headers = global.fetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('uses batchEmbedContents endpoint', async () => {
    global.fetch = mockFetch(200, batchResponse([[0.1]]));
    await adapter.embed(['hi'], 'gemini-embedding-001', 'AIza-test');

    const [url] = global.fetch.mock.calls[0];
    expect(url).toContain('gemini-embedding-001:batchEmbedContents');
  });

  it('builds one request per text with correct structure', async () => {
    global.fetch = mockFetch(200, batchResponse([[0.1], [0.2]]));
    await adapter.embed(['hello', 'world'], 'gemini-embedding-001', 'AIza-test');

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.requests).toHaveLength(2);
    expect(body.requests[0].content.parts[0].text).toBe('hello');
    expect(body.requests[1].content.parts[0].text).toBe('world');
    expect(body.requests[0].model).toBe('models/gemini-embedding-001');
  });

  it('includes taskType when provided', async () => {
    global.fetch = mockFetch(200, batchResponse([[0.1]]));
    await adapter.embed(['hi'], 'gemini-embedding-001', 'AIza-test', {
      taskType: 'RETRIEVAL_DOCUMENT',
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.requests[0].taskType).toBe('RETRIEVAL_DOCUMENT');
  });

  it('omits taskType when not provided', async () => {
    global.fetch = mockFetch(200, batchResponse([[0.1]]));
    await adapter.embed(['hi'], 'gemini-embedding-001', 'AIza-test');

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.requests[0].taskType).toBeUndefined();
  });

  it('includes outputDimensionality when provided', async () => {
    global.fetch = mockFetch(200, batchResponse([[0.1]]));
    await adapter.embed(['hi'], 'gemini-embedding-001', 'AIza-test', {
      outputDimensionality: 768,
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.requests[0].outputDimensionality).toBe(768);
  });

  it('omits outputDimensionality when not provided', async () => {
    global.fetch = mockFetch(200, batchResponse([[0.1]]));
    await adapter.embed(['hi'], 'gemini-embedding-001', 'AIza-test');

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.requests[0].outputDimensionality).toBeUndefined();
  });

  it('throws ApiKeyError on 401', async () => {
    global.fetch = mockFetch(401, { error: { message: 'API key not valid' } });
    await expect(adapter.embed(['hi'], 'gemini-embedding-001', 'bad-key'))
      .rejects.toBeInstanceOf(ApiKeyError);
  });

  it('throws ApiKeyError on 403', async () => {
    global.fetch = mockFetch(403, { error: { message: 'Permission denied' } });
    await expect(adapter.embed(['hi'], 'gemini-embedding-001', 'bad-key'))
      .rejects.toBeInstanceOf(ApiKeyError);
  });

  it('throws RateLimitError on 429', async () => {
    global.fetch = mockFetch(429, { error: { message: 'Too many requests', status: 'RATE_LIMIT_EXCEEDED' } }, { 'retry-after': '5' });
    await expect(adapter.embed(['hi'], 'gemini-embedding-001', 'AIza-test'))
      .rejects.toBeInstanceOf(RateLimitError);
  });

  it('throws QuotaError on 429 with RESOURCE_EXHAUSTED status', async () => {
    global.fetch = mockFetch(429, { error: { message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } });
    await expect(adapter.embed(['hi'], 'gemini-embedding-001', 'AIza-test'))
      .rejects.toBeInstanceOf(QuotaError);
  });

  it('throws EmbeddingError on 400', async () => {
    global.fetch = mockFetch(400, { error: { message: 'Invalid argument' } });
    await expect(adapter.embed(['hi'], 'gemini-embedding-001', 'AIza-test'))
      .rejects.toBeInstanceOf(EmbeddingError);
  });
});

// ── validateApiKey ────────────────────────────────────────────────────

describe('validateApiKey', () => {
  it('returns true for a valid key', async () => {
    global.fetch = mockFetch(200, batchResponse([[0.1]]));
    expect(await adapter.validateApiKey('AIza-valid')).toBe(true);
  });

  it('returns false for an invalid key (401)', async () => {
    global.fetch = mockFetch(401, { error: { message: 'API key not valid' } });
    expect(await adapter.validateApiKey('bad-key')).toBe(false);
  });

  it('returns false for an invalid key (403)', async () => {
    global.fetch = mockFetch(403, { error: { message: 'Permission denied' } });
    expect(await adapter.validateApiKey('bad-key')).toBe(false);
  });

  it('rethrows non-auth errors', async () => {
    global.fetch = mockFetch(429, { error: { message: 'Rate limit', status: 'RATE_LIMIT_EXCEEDED' } });
    await expect(adapter.validateApiKey('AIza-test')).rejects.toBeInstanceOf(RateLimitError);
  });
});
