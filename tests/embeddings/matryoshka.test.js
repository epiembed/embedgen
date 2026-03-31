import { describe, it, expect } from 'vitest';
import {
  getLegalDimensions,
  truncateEmbeddings,
  normalizeEmbeddings,
} from '../../src/embeddings/matryoshka.js';

// ── getLegalDimensions ────────────────────────────────────────────────

describe('getLegalDimensions', () => {
  it('returns discrete stops for Voyage 4 models', () => {
    const dims = getLegalDimensions('voyage/voyage-4-large');
    expect(dims).toEqual([2048, 1024, 512, 256]);
  });

  it('returns null for OpenAI (any value ≤ max)', () => {
    expect(getLegalDimensions('openai/text-embedding-3-large')).toBeNull();
    expect(getLegalDimensions('openai/text-embedding-3-small')).toBeNull();
  });

  it('returns null for Gemini (any value ≤ max)', () => {
    expect(getLegalDimensions('gemini/gemini-embedding-001')).toBeNull();
  });

  it('returns [full dims] for non-Matryoshka models', () => {
    expect(getLegalDimensions('openai/text-embedding-ada-002')).toEqual([1536]);
    expect(getLegalDimensions('huggingface/Xenova/all-MiniLM-L6-v2')).toEqual([384]);
  });

  it('returns discrete stops for nomic (client-side Matryoshka)', () => {
    const dims = getLegalDimensions('huggingface/nomic-ai/nomic-embed-text-v1.5');
    expect(dims).toEqual([768, 512, 256, 128, 64]);
  });

  it('throws for unknown model id', () => {
    expect(() => getLegalDimensions('openai/nonexistent')).toThrow('Unknown model');
  });
});

// ── truncateEmbeddings ────────────────────────────────────────────────

describe('truncateEmbeddings', () => {
  const vectors = [
    [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
    [0.6, 0.5, 0.4, 0.3, 0.2, 0.1],
  ];

  it('truncates vectors to targetDim', () => {
    const result = truncateEmbeddings(vectors, 3);
    expect(result[0]).toHaveLength(3);
    expect(result[0]).toEqual([0.1, 0.2, 0.3]);
    expect(result[1]).toEqual([0.6, 0.5, 0.4]);
  });

  it('does not modify vectors shorter than or equal to targetDim', () => {
    const result = truncateEmbeddings(vectors, 6);
    expect(result[0]).toHaveLength(6);
    expect(result[0]).toEqual(vectors[0]);
  });

  it('returns full vector when targetDim exceeds length', () => {
    const result = truncateEmbeddings([[1, 2, 3]], 100);
    expect(result[0]).toEqual([1, 2, 3]);
  });

  it('does not mutate the original vectors', () => {
    const original = [[1, 2, 3, 4]];
    truncateEmbeddings(original, 2);
    expect(original[0]).toHaveLength(4);
  });

  it('throws for invalid targetDim', () => {
    expect(() => truncateEmbeddings(vectors, 0)).toThrow();
    expect(() => truncateEmbeddings(vectors, -1)).toThrow();
    expect(() => truncateEmbeddings(vectors, 1.5)).toThrow();
  });

  it('handles empty vectors array', () => {
    expect(truncateEmbeddings([], 4)).toEqual([]);
  });
});

// ── normalizeEmbeddings ───────────────────────────────────────────────

describe('normalizeEmbeddings', () => {
  it('produces unit-length vectors', () => {
    const vectors = [[3, 4], [1, 0], [0, 1]];
    const result = normalizeEmbeddings(vectors);
    for (const v of result) {
      const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
      expect(norm).toBeCloseTo(1.0, 10);
    }
  });

  it('normalizes correctly for a known vector', () => {
    const result = normalizeEmbeddings([[3, 4]]);
    expect(result[0][0]).toBeCloseTo(0.6, 10);
    expect(result[0][1]).toBeCloseTo(0.8, 10);
  });

  it('returns zero vector unchanged', () => {
    const result = normalizeEmbeddings([[0, 0, 0]]);
    expect(result[0]).toEqual([0, 0, 0]);
  });

  it('does not mutate the original vectors', () => {
    const original = [[3, 4]];
    normalizeEmbeddings(original);
    expect(original[0]).toEqual([3, 4]);
  });

  it('handles empty vectors array', () => {
    expect(normalizeEmbeddings([])).toEqual([]);
  });

  it('truncate then normalize produces unit vectors', () => {
    // 1536-dim → 256 then normalize
    const vec = Array.from({ length: 1536 }, (_, i) => (i % 7) * 0.1 - 0.3);
    const truncated = truncateEmbeddings([vec], 256);
    const normalized = normalizeEmbeddings(truncated);
    const norm = Math.sqrt(normalized[0].reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1.0, 10);
    expect(normalized[0]).toHaveLength(256);
  });
});
