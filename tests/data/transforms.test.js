// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractImageUrls, validateImageUrls, fetchImageAsBase64 } from '../../src/data/transforms.js';

const data = {
  headers: ['id', 'image_url', 'caption'],
  rows: [
    ['1', 'https://example.com/cat.jpg', 'a cat'],
    ['2', 'https://example.com/dog.png', 'a dog'],
    ['3', null,                          'missing'],
    ['4', '  ',                          'blank'],
    ['5', 'https://example.com/bird.jpg','a bird'],
  ],
};

// ── extractImageUrls ──────────────────────────────────────────────────

describe('extractImageUrls', () => {
  it('extracts URLs from the named column', () => {
    const urls = extractImageUrls(data, 'image_url');
    expect(urls[0]).toBe('https://example.com/cat.jpg');
    expect(urls[1]).toBe('https://example.com/dog.png');
    expect(urls[4]).toBe('https://example.com/bird.jpg');
  });

  it('returns null for null values', () => {
    const urls = extractImageUrls(data, 'image_url');
    expect(urls[2]).toBeNull();
  });

  it('returns null for blank/whitespace values', () => {
    const urls = extractImageUrls(data, 'image_url');
    expect(urls[3]).toBeNull();
  });

  it('returns an array with the same length as rows', () => {
    const urls = extractImageUrls(data, 'image_url');
    expect(urls).toHaveLength(data.rows.length);
  });

  it('throws when column is not found', () => {
    expect(() => extractImageUrls(data, 'nonexistent')).toThrow('not found');
  });
});

// ── validateImageUrls ─────────────────────────────────────────────────

describe('validateImageUrls — format only (no probe)', () => {
  it('marks valid http/https URLs as valid', async () => {
    const results = await validateImageUrls(['https://example.com/img.jpg']);
    expect(results[0].valid).toBe(true);
  });

  it('marks null as invalid', async () => {
    const results = await validateImageUrls([null]);
    expect(results[0].valid).toBe(false);
    expect(results[0].error).toMatch(/empty/i);
  });

  it('marks malformed URLs as invalid', async () => {
    const results = await validateImageUrls(['not-a-url']);
    expect(results[0].valid).toBe(false);
    expect(results[0].error).toMatch(/invalid url/i);
  });

  it('marks non-http protocols as invalid', async () => {
    const results = await validateImageUrls(['ftp://example.com/img.jpg']);
    expect(results[0].valid).toBe(false);
    expect(results[0].error).toMatch(/http/i);
  });

  it('validates a mixed array', async () => {
    const results = await validateImageUrls([
      'https://example.com/a.jpg',
      'bad-url',
      null,
    ]);
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(false);
    expect(results[2].valid).toBe(false);
  });
});

describe('validateImageUrls — with probe', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns valid when HEAD succeeds with image content-type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/jpeg' },
    }));
    const results = await validateImageUrls(['https://example.com/img.jpg'], { probe: true });
    expect(results[0].valid).toBe(true);
  });

  it('returns invalid when HEAD returns non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 403,
      headers: { get: () => null },
    }));
    const results = await validateImageUrls(['https://example.com/img.jpg'], { probe: true });
    expect(results[0].valid).toBe(false);
    expect(results[0].error).toContain('403');
  });

  it('returns valid when HEAD throws (CORS) — best-effort', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network error')));
    const results = await validateImageUrls(['https://example.com/img.jpg'], { probe: true });
    expect(results[0].valid).toBe(true);
  });
});

// ── fetchImageAsBase64 ────────────────────────────────────────────────

describe('fetchImageAsBase64', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns base64 data and mimeType', async () => {
    const fakeBytes = new Uint8Array([0xff, 0xd8, 0xff]); // JPEG magic bytes
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: async () => fakeBytes.buffer,
    }));

    const { data, mimeType } = await fetchImageAsBase64('https://example.com/img.jpg');
    expect(mimeType).toBe('image/jpeg');
    expect(typeof data).toBe('string');
    expect(atob(data)).toBe('\xff\xd8\xff');
  });

  it('strips charset from content-type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/png; charset=utf-8' },
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    const { mimeType } = await fetchImageAsBase64('https://example.com/img.png');
    expect(mimeType).toBe('image/png');
  });

  it('defaults mimeType to image/jpeg when content-type is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    const { mimeType } = await fetchImageAsBase64('https://example.com/img');
    expect(mimeType).toBe('image/jpeg');
  });

  it('throws when fetch returns non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 404, statusText: 'Not Found',
      headers: { get: () => null },
    }));
    await expect(fetchImageAsBase64('https://example.com/missing.jpg')).rejects.toThrow('404');
  });
});
