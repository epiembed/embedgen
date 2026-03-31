import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from '../../../src/data/parsers/csv.js';

const fixturesDir = resolve('tests/fixtures');

describe('csv parser', () => {
  it('parses sample.csv', () => {
    const text = readFileSync(resolve(fixturesDir, 'sample.csv'), 'utf8');
    const { headers, rows } = parse(text);
    expect(headers).toEqual(['id', 'text', 'category']);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual(['1', 'The quick brown fox jumps over the lazy dog', 'animals']);
  });

  it('parses quoted fields containing commas', () => {
    const text = readFileSync(resolve(fixturesDir, 'sample.csv'), 'utf8');
    const { rows } = parse(text);
    expect(rows[4]).toEqual(['5', 'To be, or not to be, that is the question', 'literature']);
  });

  it('parses TSV input', () => {
    const text = 'name\tvalue\tflag\nalpha\t1\ttrue\nbeta\t2\tfalse';
    const { headers, rows } = parse(text);
    expect(headers).toEqual(['name', 'value', 'flag']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(['alpha', '1', 'true']);
  });

  it('handles escaped quotes inside quoted fields', () => {
    const text = 'a,b\n"say ""hello""",world';
    const { rows } = parse(text);
    expect(rows[0][0]).toBe('say "hello"');
  });

  it('handles empty fields', () => {
    const text = 'a,b,c\n1,,3\n,5,';
    const { rows } = parse(text);
    expect(rows[0]).toEqual(['1', '', '3']);
    expect(rows[1]).toEqual(['', '5', '']);
  });

  it('handles trailing newline', () => {
    const text = 'a,b\n1,2\n';
    const { headers, rows } = parse(text);
    expect(headers).toEqual(['a', 'b']);
    expect(rows).toHaveLength(1);
  });

  it('handles CRLF line endings', () => {
    const text = 'a,b\r\n1,2\r\n3,4';
    const { headers, rows } = parse(text);
    expect(headers).toEqual(['a', 'b']);
    expect(rows).toHaveLength(2);
  });

  it('throws on empty input', () => {
    expect(() => parse('')).toThrow('empty');
    expect(() => parse('   ')).toThrow('empty');
  });
});
