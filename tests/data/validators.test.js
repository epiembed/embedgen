import { describe, it, expect } from 'vitest';
import {
  validateNotEmpty,
  validateColumnExists,
  validateNoEmptyValues,
  validateUrls,
  run,
} from '../../src/data/validators.js';

const sampleData = {
  headers: ['id', 'text', 'category'],
  rows: [
    ['1', 'The quick brown fox', 'animals'],
    ['2', 'Machine learning', 'technology'],
    ['3', 'A stitch in time', 'proverbs'],
  ],
};

describe('validateNotEmpty', () => {
  it('passes for non-empty data', () => {
    const result = validateNotEmpty(sampleData);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails for empty rows array', () => {
    const result = validateNotEmpty({ rows: [] });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/empty/i);
  });

  it('fails when rows is missing', () => {
    const result = validateNotEmpty({});
    expect(result.valid).toBe(false);
  });
});

describe('validateColumnExists', () => {
  it('passes when column is present', () => {
    const result = validateColumnExists(sampleData, 'text');
    expect(result.valid).toBe(true);
  });

  it('fails when column is absent', () => {
    const result = validateColumnExists(sampleData, 'embedding');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/"embedding"/);
  });

  it('error message lists available columns', () => {
    const result = validateColumnExists(sampleData, 'missing');
    expect(result.errors[0]).toMatch(/id.*text.*category/);
  });
});

describe('validateNoEmptyValues', () => {
  it('passes when all values are present', () => {
    const result = validateNoEmptyValues(sampleData, 'text');
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns (not errors) when nulls are present', () => {
    const data = {
      headers: ['text'],
      rows: [['hello'], [null], ['world'], ['']],
    };
    const result = validateNoEmptyValues(data, 'text');
    expect(result.valid).toBe(true);
    expect(result.warnings[0]).toMatch(/2 empty/);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when column does not exist', () => {
    const result = validateNoEmptyValues(sampleData, 'nonexistent');
    expect(result.valid).toBe(false);
  });
});

describe('validateUrls', () => {
  it('passes for valid http/https URLs', () => {
    const result = validateUrls([
      'https://example.com/img.jpg',
      'http://cdn.example.org/pic.png',
    ]);
    expect(result.valid).toBe(true);
  });

  it('fails for malformed URLs', () => {
    const result = validateUrls(['not-a-url', 'also bad']);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/2 invalid/);
  });

  it('fails for non-http protocols', () => {
    const result = validateUrls(['ftp://example.com/file']);
    expect(result.valid).toBe(false);
  });

  it('truncates long invalid URL lists in error message', () => {
    const urls = ['bad1', 'bad2', 'bad3', 'bad4', 'bad5'];
    const result = validateUrls(urls);
    expect(result.errors[0]).toMatch(/5 invalid/);
    expect(result.errors[0]).toMatch(/…/);
  });

  it('passes for empty array', () => {
    const result = validateUrls([]);
    expect(result.valid).toBe(true);
  });
});

describe('run', () => {
  it('passes for valid data and column', () => {
    const result = run(sampleData, 'text');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when column does not exist', () => {
    const result = run(sampleData, 'nonexistent');
    expect(result.valid).toBe(false);
  });

  it('fails for empty dataset', () => {
    const result = run({ headers: ['text'], rows: [] }, 'text');
    expect(result.valid).toBe(false);
  });

  it('accumulates warnings from multiple validators', () => {
    const data = {
      headers: ['text'],
      rows: [['hello'], [null]],
    };
    const result = run(data, 'text');
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
