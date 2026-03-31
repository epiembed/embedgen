import { describe, it, expect } from 'vitest';
import { buildConfig, buildGitHubRawUrl } from '../../src/export/config.js';

describe('buildConfig', () => {
  it('includes required fields', () => {
    const cfg = buildConfig({
      tensorName: 'My Embeddings',
      tensorShape: [100, 768],
      tensorPath: 'tensors.tsv',
    });
    expect(cfg.embeddings).toHaveLength(1);
    const emb = cfg.embeddings[0];
    expect(emb.tensorName).toBe('My Embeddings');
    expect(emb.tensorShape).toEqual([100, 768]);
    expect(emb.tensorPath).toBe('tensors.tsv');
  });

  it('omits metadataPath when not provided', () => {
    const cfg = buildConfig({
      tensorName: 'E',
      tensorShape: [5, 4],
      tensorPath: 'tensors.tsv',
    });
    expect(cfg.embeddings[0]).not.toHaveProperty('metadataPath');
  });

  it('includes metadataPath when provided', () => {
    const cfg = buildConfig({
      tensorName: 'E',
      tensorShape: [5, 4],
      tensorPath: 'tensors.tsv',
      metadataPath: 'metadata.tsv',
    });
    expect(cfg.embeddings[0].metadataPath).toBe('metadata.tsv');
  });

  it('omits sprite when not provided', () => {
    const cfg = buildConfig({
      tensorName: 'E',
      tensorShape: [5, 4],
      tensorPath: 'tensors.tsv',
    });
    expect(cfg.embeddings[0]).not.toHaveProperty('sprite');
  });

  it('includes sprite when provided', () => {
    const sprite = { imagePath: 'sprite.png', singleImageDim: [64, 64] };
    const cfg = buildConfig({
      tensorName: 'E',
      tensorShape: [5, 4],
      tensorPath: 'tensors.tsv',
      sprite,
    });
    expect(cfg.embeddings[0].sprite).toEqual(sprite);
  });

  it('shape matches actual tensor dimensions', () => {
    const n = 42, d = 128;
    const cfg = buildConfig({ tensorName: 'E', tensorShape: [n, d], tensorPath: 't.tsv' });
    expect(cfg.embeddings[0].tensorShape[0]).toBe(n);
    expect(cfg.embeddings[0].tensorShape[1]).toBe(d);
  });

  it('produces valid JSON', () => {
    const cfg = buildConfig({
      tensorName: 'E',
      tensorShape: [5, 4],
      tensorPath: 'tensors.tsv',
      metadataPath: 'metadata.tsv',
    });
    expect(() => JSON.stringify(cfg)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(cfg));
    expect(parsed.embeddings[0].tensorName).toBe('E');
  });
});

describe('buildGitHubRawUrl', () => {
  it('constructs correct raw URL', () => {
    const url = buildGitHubRawUrl('alice', 'my-repo', 'main', 'tensors.tsv');
    expect(url).toBe('https://raw.githubusercontent.com/alice/my-repo/main/tensors.tsv');
  });

  it('handles nested file paths', () => {
    const url = buildGitHubRawUrl('org', 'repo', 'gh-pages', 'embeddings/tensors.tsv');
    expect(url).toBe('https://raw.githubusercontent.com/org/repo/gh-pages/embeddings/tensors.tsv');
  });

  it('can be used for tensor and metadata paths in buildConfig', () => {
    const tensorPath = buildGitHubRawUrl('alice', 'repo', 'main', 'tensors.tsv');
    const metadataPath = buildGitHubRawUrl('alice', 'repo', 'main', 'metadata.tsv');
    const cfg = buildConfig({
      tensorName: 'E',
      tensorShape: [5, 4],
      tensorPath,
      metadataPath,
    });
    expect(cfg.embeddings[0].tensorPath).toContain('raw.githubusercontent.com');
    expect(cfg.embeddings[0].metadataPath).toContain('raw.githubusercontent.com');
  });
});
