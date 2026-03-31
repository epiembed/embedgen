import { describe, it, expect } from 'vitest';
import { toTSV, toBinary, fromTSV, fromBinary } from '../../src/export/tensor.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fixtureVectors = [
  [0.1941, 0.8372, -0.3015, 0.5280],
  [-0.6103, 0.2947, 0.7831, -0.1042],
  [0.4456, -0.5519, 0.1273, 0.8904],
  [-0.2387, 0.6614, -0.7092, 0.3318],
  [0.7749, -0.0831, 0.4567, -0.6240],
];

// ── toTSV ─────────────────────────────────────────────────────────────

describe('toTSV', () => {
  it('joins values with tabs and rows with newlines', () => {
    const tsv = toTSV([[1, 2, 3], [4, 5, 6]]);
    expect(tsv).toBe('1\t2\t3\n4\t5\t6');
  });

  it('produces no header row', () => {
    const tsv = toTSV([[0.1, 0.2]]);
    const lines = tsv.split('\n');
    expect(lines).toHaveLength(1);
    expect(Number(lines[0].split('\t')[0])).toBeCloseTo(0.1);
  });

  it('encodes fixture vectors correctly', () => {
    const tsv = toTSV(fixtureVectors);
    const lines = tsv.split('\n');
    expect(lines).toHaveLength(5);
    expect(lines[0].split('\t')).toHaveLength(4);
  });
});

// ── fromTSV ───────────────────────────────────────────────────────────

describe('fromTSV', () => {
  it('round-trips through toTSV', () => {
    const tsv = toTSV(fixtureVectors);
    const decoded = fromTSV(tsv);
    expect(decoded).toHaveLength(fixtureVectors.length);
    decoded.forEach((vec, i) => {
      vec.forEach((val, j) => expect(val).toBeCloseTo(fixtureVectors[i][j], 4));
    });
  });

  it('parses sample-tensor.tsv fixture', () => {
    const text = readFileSync(resolve('tests/fixtures/sample-tensor.tsv'), 'utf8');
    const vectors = fromTSV(text);
    expect(vectors).toHaveLength(5);
    expect(vectors[0]).toHaveLength(4);
    expect(vectors[0][0]).toBeCloseTo(0.1941, 4);
  });

  it('ignores trailing newline', () => {
    const tsv = '1\t2\n3\t4\n';
    expect(fromTSV(tsv)).toHaveLength(2);
  });
});

// ── toBinary ──────────────────────────────────────────────────────────

describe('toBinary', () => {
  it('returns an ArrayBuffer', () => {
    expect(toBinary(fixtureVectors)).toBeInstanceOf(ArrayBuffer);
  });

  it('byte length equals N × D × 4', () => {
    const buf = toBinary(fixtureVectors);
    expect(buf.byteLength).toBe(5 * 4 * 4); // 5 rows, 4 dims, 4 bytes/float
  });

  it('values are stored as Float32', () => {
    const vectors = [[1.0, 2.0, 3.0]];
    const buf = toBinary(vectors);
    const view = new Float32Array(buf);
    expect(view[0]).toBeCloseTo(1.0);
    expect(view[1]).toBeCloseTo(2.0);
    expect(view[2]).toBeCloseTo(3.0);
  });
});

// ── fromBinary ────────────────────────────────────────────────────────

describe('fromBinary', () => {
  it('round-trips through toBinary', () => {
    const buf = toBinary(fixtureVectors);
    const decoded = fromBinary(buf, [5, 4]);
    expect(decoded).toHaveLength(5);
    decoded.forEach((vec, i) => {
      expect(vec).toHaveLength(4);
      vec.forEach((val, j) => expect(val).toBeCloseTo(fixtureVectors[i][j], 5));
    });
  });

  it('correctly segments rows', () => {
    const vectors = [[1, 2], [3, 4], [5, 6]];
    const buf = toBinary(vectors);
    const decoded = fromBinary(buf, [3, 2]);
    expect(decoded[0]).toEqual([1, 2]);
    expect(decoded[1]).toEqual([3, 4]);
    expect(decoded[2]).toEqual([5, 6]);
  });
});
