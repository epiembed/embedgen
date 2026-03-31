import { describe, it, expect } from 'vitest';
import { createBatches, estimateTokens } from '../../src/embeddings/batcher.js';

describe('estimateTokens', () => {
  it('estimates tokens as ceil(chars / 4)', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('a')).toBe(1);
  });
});

describe('createBatches', () => {
  it('returns empty array for empty input', () => {
    expect(createBatches([], 10)).toEqual([]);
  });

  it('returns empty array for non-array input', () => {
    expect(createBatches(null, 10)).toEqual([]);
  });

  it('splits 10 texts into batches of 3', () => {
    const texts = Array.from({ length: 10 }, (_, i) => `text${i}`);
    const batches = createBatches(texts, 3);
    expect(batches).toHaveLength(4);
    expect(batches[0]).toHaveLength(3);
    expect(batches[1]).toHaveLength(3);
    expect(batches[2]).toHaveLength(3);
    expect(batches[3]).toHaveLength(1);
  });

  it('puts all texts in one batch when count is within limit', () => {
    const texts = ['hello', 'world', 'foo'];
    expect(createBatches(texts, 10)).toEqual([texts]);
  });

  it('preserves all texts across batches', () => {
    const texts = Array.from({ length: 7 }, (_, i) => `item-${i}`);
    const batches = createBatches(texts, 3);
    expect(batches.flat()).toEqual(texts);
  });

  it('splits by token limit', () => {
    // Each text is 40 chars → ~10 tokens. Token limit = 25 → max 2 per batch.
    const text = 'a'.repeat(40);
    const texts = [text, text, text, text, text];
    const batches = createBatches(texts, 100, 25);
    expect(batches).toHaveLength(3); // [2, 2, 1]
    expect(batches[0]).toHaveLength(2);
    expect(batches[2]).toHaveLength(1);
  });

  it('single oversized text gets its own batch', () => {
    // 400 chars → 100 tokens, well above limit of 20
    const big = 'x'.repeat(400);
    const small = 'hi'; // 1 token
    const batches = createBatches([small, big, small], 100, 20);
    // small fits alone, big alone, small alone
    expect(batches).toHaveLength(3);
    expect(batches[1]).toEqual([big]);
  });

  it('batch size limit takes priority over token limit', () => {
    const texts = ['a', 'b', 'c', 'd'];
    // tokens are tiny but batch size = 2
    const batches = createBatches(texts, 2, Infinity);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toEqual(['a', 'b']);
    expect(batches[1]).toEqual(['c', 'd']);
  });

  it('works with a single text', () => {
    const batches = createBatches(['only one'], 5);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual(['only one']);
  });

  it('respects both limits simultaneously', () => {
    // 3 texts, each 20 chars → 5 tokens each. Batch size = 3, token limit = 12.
    // After 2 items: 10 tokens — adding a 3rd would be 15 > 12, so split.
    const text = 'a'.repeat(20);
    const texts = [text, text, text, text];
    const batches = createBatches(texts, 3, 12);
    expect(batches.flat()).toEqual(texts);
    batches.forEach(b => {
      expect(b.length).toBeLessThanOrEqual(3);
    });
  });
});
