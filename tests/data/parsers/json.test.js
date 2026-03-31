import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse, detectUrlColumns } from '../../../src/data/parsers/json.js';

const fixturesDir = resolve('tests/fixtures');

describe('json parser', () => {
  it('parses sample.json', () => {
    const text = readFileSync(resolve(fixturesDir, 'sample.json'), 'utf8');
    const { headers, rows } = parse(text);
    expect(headers).toEqual(['id', 'text', 'category']);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual(['1', 'The quick brown fox jumps over the lazy dog', 'animals']);
  });

  it('parses sample-images.json', () => {
    const text = readFileSync(resolve(fixturesDir, 'sample-images.json'), 'utf8');
    const { headers, rows } = parse(text);
    expect(headers).toEqual(['image_url', 'caption']);
    expect(rows).toHaveLength(3);
    expect(rows[0][0]).toMatch(/^https?:\/\//);
  });

  it('returns empty headers and rows for empty array', () => {
    const { headers, rows } = parse('[]');
    expect(headers).toEqual([]);
    expect(rows).toEqual([]);
  });

  it('inserts null for missing keys', () => {
    const text = JSON.stringify([
      { a: '1', b: '2' },
      { a: '3' },
      { b: '4', c: '5' },
    ]);
    const { headers, rows } = parse(text);
    expect(headers).toEqual(['a', 'b', 'c']);
    expect(rows[1]).toEqual(['3', null, null]);
    expect(rows[2]).toEqual([null, '4', '5']);
  });

  it('maintains key insertion order from first object', () => {
    const text = JSON.stringify([
      { z: '1', a: '2', m: '3' },
      { a: '4', z: '5', m: '6' },
    ]);
    const { headers } = parse(text);
    expect(headers).toEqual(['z', 'a', 'm']);
  });

  it('stringifies non-string values', () => {
    const text = JSON.stringify([{ n: 42, flag: true, ratio: 3.14 }]);
    const { rows } = parse(text);
    expect(rows[0]).toEqual(['42', 'true', '3.14']);
  });

  it('throws on empty input', () => {
    expect(() => parse('')).toThrow('empty');
  });

  it('throws on invalid JSON', () => {
    expect(() => parse('{not valid')).toThrow('Invalid JSON');
  });

  it('throws when JSON is not an array', () => {
    expect(() => parse('{"a": 1}')).toThrow('array');
  });

  it('throws when array contains non-objects', () => {
    expect(() => parse('["a", "b"]')).toThrow('objects');
  });
});

describe('detectUrlColumns', () => {
  it('detects URL columns in sample-images.json', () => {
    const text = readFileSync(resolve(fixturesDir, 'sample-images.json'), 'utf8');
    const { headers, rows } = parse(text);
    const urlCols = detectUrlColumns(headers, rows);
    expect(urlCols).toEqual([0]); // image_url is index 0
  });

  it('returns empty array when no URLs present', () => {
    const { headers, rows } = parse(JSON.stringify([{ a: 'hello', b: 'world' }]));
    expect(detectUrlColumns(headers, rows)).toEqual([]);
  });

  it('detects multiple URL columns', () => {
    const data = JSON.stringify([
      { thumb: 'https://a.com/1.jpg', full: 'https://b.com/2.jpg', label: 'cat' },
    ]);
    const { headers, rows } = parse(data);
    const urlCols = detectUrlColumns(headers, rows);
    expect(urlCols).toEqual([0, 1]);
  });

  it('ignores null values when detecting URLs', () => {
    const data = JSON.stringify([
      { url: null, label: 'foo' },
      { url: 'https://example.com/img.png', label: 'bar' },
    ]);
    const { headers, rows } = parse(data);
    expect(detectUrlColumns(headers, rows)).toEqual([0]);
  });
});
