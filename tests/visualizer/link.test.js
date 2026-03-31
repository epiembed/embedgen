import { describe, it, expect } from 'vitest';
import { buildShareableLink } from '../../src/visualizer/link.js';

describe('buildShareableLink', () => {
  const CONFIG_URL = 'https://raw.githubusercontent.com/alice/repo/main/embedgen-data/2024-01-01_00-00-00-model/config.json';

  it('starts with the TF Projector base URL', () => {
    const link = buildShareableLink(CONFIG_URL);
    expect(link).toMatch(/^https:\/\/projector\.tensorflow\.org\//);
  });

  it('includes the config param', () => {
    const link = buildShareableLink(CONFIG_URL);
    expect(link).toContain('?config=');
  });

  it('percent-encodes the config URL', () => {
    const link = buildShareableLink(CONFIG_URL);
    const parsed = new URL(link);
    expect(parsed.searchParams.get('config')).toBe(CONFIG_URL);
  });

  it('round-trips the config URL through decoding', () => {
    const link = buildShareableLink(CONFIG_URL);
    const decoded = decodeURIComponent(link.split('?config=')[1]);
    expect(decoded).toBe(CONFIG_URL);
  });

  it('throws when configUrl is empty', () => {
    expect(() => buildShareableLink('')).toThrow();
  });

  it('throws when configUrl is not provided', () => {
    expect(() => buildShareableLink()).toThrow();
  });

  it('handles URLs with special characters', () => {
    const url = 'https://raw.githubusercontent.com/org/my-repo/main/data/a+b/config.json';
    const link = buildShareableLink(url);
    const parsed = new URL(link);
    expect(parsed.searchParams.get('config')).toBe(url);
  });
});
