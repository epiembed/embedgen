import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { toTSV } from '../../src/export/metadata.js';
import { parse as parseProjector } from '../../src/data/parsers/projector.js';

// ── toTSV ─────────────────────────────────────────────────────────────

describe('toTSV — multi-column', () => {
  it('emits header row followed by data rows', () => {
    const tsv = toTSV(['text', 'category'], [
      ['The quick brown fox', 'animals'],
      ['Machine learning', 'technology'],
    ]);
    const lines = tsv.split('\n');
    expect(lines[0]).toBe('text\tcategory');
    expect(lines[1]).toBe('The quick brown fox\tanimals');
    expect(lines[2]).toBe('Machine learning\ttechnology');
  });

  it('replaces null/undefined with empty string', () => {
    const tsv = toTSV(['a', 'b'], [[null, 'x'], ['y', undefined]]);
    const lines = tsv.split('\n');
    expect(lines[1]).toBe('\tx');
    expect(lines[2]).toBe('y\t');
  });

  it('replaces embedded tabs in values with a space', () => {
    const tsv = toTSV(['col'], [['val\twith\ttabs'], ['normal']]);
    // With single col, no header
    expect(tsv).not.toContain('\t');
  });

  it('matches sample-metadata.tsv fixture format', () => {
    const fixture = readFileSync(resolve('tests/fixtures/sample-metadata.tsv'), 'utf8').trimEnd();
    const headers = ['text', 'category'];
    const rows = [
      ['The quick brown fox jumps over the lazy dog', 'animals'],
      ['Machine learning models encode semantic meaning', 'technology'],
      ['A stitch in time saves nine', 'proverbs'],
      ['The mitochondria is the powerhouse of the cell', 'biology'],
      ['To be, or not to be, that is the question', 'literature'],
    ];
    expect(toTSV(headers, rows)).toBe(fixture);
  });
});

describe('toTSV — single-column', () => {
  it('emits no header row', () => {
    const tsv = toTSV(['label'], [['alpha'], ['beta'], ['gamma']]);
    const lines = tsv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('alpha');
  });

  it('replaces null with empty string', () => {
    const tsv = toTSV(['label'], [['first'], [null], ['third']]);
    const lines = tsv.split('\n');
    expect(lines[1]).toBe('');
  });
});

// ── Round-trip with projector parser ─────────────────────────────────

describe('round-trip with projector parser', () => {
  it('multi-column: encode → parse recovers headers and rows', () => {
    const headers = ['word', 'pos'];
    const rows = [['cat', 'noun'], ['run', 'verb'], ['fast', 'adverb']];
    const tsv = toTSV(headers, rows);

    // Use a dummy tensor so the projector parser can validate row counts
    const tensorTsv = '0.1\t0.2\n0.3\t0.4\n0.5\t0.6';
    const { metadata } = parseProjector(tensorTsv, tsv);

    expect(metadata.headers).toEqual(headers);
    expect(metadata.rows).toEqual(rows);
  });

  it('single-column: encode → parse recovers rows', () => {
    const headers = ['label'];
    const rows = [['alpha'], ['beta'], ['gamma']];
    const tsv = toTSV(headers, rows);

    const tensorTsv = '0.1\t0.2\n0.3\t0.4\n0.5\t0.6';
    const { metadata } = parseProjector(tensorTsv, tsv);

    // Single-column produces no header in TSV → parser returns headers: []
    expect(metadata.headers).toEqual([]);
    expect(metadata.rows).toEqual(rows);
  });
});
