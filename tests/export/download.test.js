import { describe, it, expect } from 'vitest';
import { buildSingleFileTSV, buildZip } from '../../src/export/download.js';
import { unzipSync, strFromU8 } from 'fflate';

// ── buildSingleFileTSV ────────────────────────────────────────────────

describe('buildSingleFileTSV', () => {
  const vectors = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];

  it('without labels: rows are tab-separated values', () => {
    const tsv = buildSingleFileTSV(vectors);
    const lines = tsv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('0.1\t0.2\t0.3');
    expect(lines[1]).toBe('0.4\t0.5\t0.6');
  });

  it('with labels: prepends label to each row', () => {
    const tsv = buildSingleFileTSV(vectors, ['cat', 'dog']);
    const lines = tsv.split('\n');
    expect(lines[0]).toBe('cat\t0.1\t0.2\t0.3');
    expect(lines[1]).toBe('dog\t0.4\t0.5\t0.6');
  });

  it('with missing label falls back to empty string', () => {
    const tsv = buildSingleFileTSV([[1, 2]], [undefined]);
    expect(tsv.startsWith('\t')).toBe(true);
  });

  it('produces no header row', () => {
    const tsv = buildSingleFileTSV(vectors);
    expect(tsv.split('\n')).toHaveLength(vectors.length);
  });
});

// ── buildZip ──────────────────────────────────────────────────────────

describe('buildZip', () => {
  const tensorsTSV = '0.1\t0.2\n0.3\t0.4';
  const metadataTSV = 'text\tcategory\nhello\tgreeting';
  const config = { embeddings: [{ tensorName: 'E', tensorShape: [2, 2], tensorPath: 'tensors.tsv' }] };

  it('returns a Uint8Array', () => {
    const zip = buildZip({ tensorsTSV, metadataTSV, config });
    expect(zip).toBeInstanceOf(Uint8Array);
  });

  it('ZIP contains tensors.tsv, metadata.tsv, config.json', () => {
    const zip = buildZip({ tensorsTSV, metadataTSV, config });
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(['config.json', 'metadata.tsv', 'tensors.tsv']);
  });

  it('tensors.tsv content matches input', () => {
    const zip = buildZip({ tensorsTSV, metadataTSV, config });
    const files = unzipSync(zip);
    expect(strFromU8(files['tensors.tsv'])).toBe(tensorsTSV);
  });

  it('metadata.tsv content matches input', () => {
    const zip = buildZip({ tensorsTSV, metadataTSV, config });
    const files = unzipSync(zip);
    expect(strFromU8(files['metadata.tsv'])).toBe(metadataTSV);
  });

  it('config.json is valid JSON matching the input config', () => {
    const zip = buildZip({ tensorsTSV, metadataTSV, config });
    const files = unzipSync(zip);
    const parsed = JSON.parse(strFromU8(files['config.json']));
    expect(parsed).toEqual(config);
  });
});
