import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from '../../../src/data/parsers/projector.js';

const fixturesDir = resolve('tests/fixtures');

describe('projector parser', () => {
  it('parses sample-tensor.tsv alone', () => {
    const tensorText = readFileSync(resolve(fixturesDir, 'sample-tensor.tsv'), 'utf8');
    const { vectors, metadata } = parse(tensorText);
    expect(vectors).toHaveLength(5);
    expect(vectors[0]).toHaveLength(4);
    expect(metadata).toBeNull();
  });

  it('parses tensor values correctly', () => {
    const tensorText = readFileSync(resolve(fixturesDir, 'sample-tensor.tsv'), 'utf8');
    const { vectors } = parse(tensorText);
    expect(vectors[0]).toEqual([0.1941, 0.8372, -0.3015, 0.528]);
    expect(vectors[1][0]).toBeCloseTo(-0.6103);
  });

  it('parses sample-tensor.tsv + sample-metadata.tsv', () => {
    const tensorText = readFileSync(resolve(fixturesDir, 'sample-tensor.tsv'), 'utf8');
    const metaText = readFileSync(resolve(fixturesDir, 'sample-metadata.tsv'), 'utf8');
    const { vectors, metadata } = parse(tensorText, metaText);
    expect(vectors).toHaveLength(5);
    expect(metadata).not.toBeNull();
    expect(metadata.headers).toEqual(['text', 'category']);
    expect(metadata.rows).toHaveLength(5);
    expect(metadata.rows[0]).toEqual([
      'The quick brown fox jumps over the lazy dog',
      'animals',
    ]);
  });

  it('strips optional label column from tensor', () => {
    const text = 'label_a\t0.1\t0.2\t0.3\nlabel_b\t0.4\t0.5\t0.6';
    const { vectors } = parse(text);
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toEqual([0.1, 0.2, 0.3]);
    expect(vectors[1]).toEqual([0.4, 0.5, 0.6]);
  });

  it('parses metadata with header row', () => {
    const tensorText = '0.1\t0.2\n0.3\t0.4';
    const metaText = 'name\ttype\nalpha\tfoo\nbeta\tbar';
    const { metadata } = parse(tensorText, metaText);
    expect(metadata.headers).toEqual(['name', 'type']);
    expect(metadata.rows).toHaveLength(2);
  });

  it('parses metadata without header (single column)', () => {
    const tensorText = '0.1\t0.2\n0.3\t0.4';
    const metaText = 'alpha\nbeta';
    const { metadata } = parse(tensorText, metaText);
    expect(metadata.headers).toEqual([]);
    expect(metadata.rows).toEqual([['alpha'], ['beta']]);
  });

  it('throws when tensor has < 2 dimensions', () => {
    expect(() => parse('0.5\n0.6')).toThrow('at least 2 dimensions');
  });

  it('throws on non-uniform dimensionality', () => {
    expect(() => parse('0.1\t0.2\n0.3\t0.4\t0.5')).toThrow('Non-uniform');
  });

  it('throws on mismatched row counts', () => {
    const tensorText = '0.1\t0.2\n0.3\t0.4\n0.5\t0.6'; // 3 vectors
    const metaText = 'name\ttype\nalpha\tfoo';           // header + 1 data row
    expect(() => parse(tensorText, metaText)).toThrow('mismatch');
  });

  it('throws on empty tensor input', () => {
    expect(() => parse('')).toThrow('empty');
  });
});
