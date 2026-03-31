// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildDirName,
  buildFilePaths,
  arrayBufferToBase64,
  stringToBase64,
  saveToGitHub,
} from '../../src/export/github.js';

// ── buildDirName ──────────────────────────────────────────────────────

describe('buildDirName', () => {
  it('includes timestamp and model slug', () => {
    const d = buildDirName('openai/text-embedding-3-small', new Date('2024-06-15T10:30:00.000Z'));
    expect(d).toBe('2024-06-15_10-30-00-openai-text-embedding-3-small');
  });

  it('replaces slashes in model id with dashes', () => {
    const d = buildDirName('voyage/voyage-3', new Date('2024-01-01T00:00:00.000Z'));
    expect(d).toContain('voyage-voyage-3');
    expect(d).not.toContain('/');
  });
});

// ── buildFilePaths ────────────────────────────────────────────────────

describe('buildFilePaths', () => {
  it('returns paths under embedgen-data/{dirName}', () => {
    const { tensorPath, metadataPath, configPath } = buildFilePaths('2024-01-01_00-00-00-model');
    expect(tensorPath).toBe('embedgen-data/2024-01-01_00-00-00-model/tensors.bytes');
    expect(metadataPath).toBe('embedgen-data/2024-01-01_00-00-00-model/metadata.tsv');
    expect(configPath).toBe('embedgen-data/2024-01-01_00-00-00-model/config.json');
  });
});

// ── arrayBufferToBase64 ───────────────────────────────────────────────

describe('arrayBufferToBase64', () => {
  it('encodes an ArrayBuffer to base64', () => {
    const buf = new Uint8Array([72, 101, 108, 108, 111]).buffer; // "Hello"
    expect(arrayBufferToBase64(buf)).toBe(btoa('Hello'));
  });

  it('accepts a Uint8Array directly', () => {
    const arr = new Uint8Array([72, 101, 108, 108, 111]);
    expect(arrayBufferToBase64(arr)).toBe(btoa('Hello'));
  });
});

// ── stringToBase64 ────────────────────────────────────────────────────

describe('stringToBase64', () => {
  it('encodes ASCII string to base64', () => {
    expect(stringToBase64('Hello')).toBe(btoa('Hello'));
  });

  it('round-trips through atob', () => {
    const original = 'tensors\tmetadata\nrow1\trow2';
    const decoded = atob(stringToBase64(original));
    // decoded is the UTF-8 byte representation — for pure ASCII it equals the original
    expect(decoded).toBe(original);
  });

  it('handles empty string', () => {
    expect(stringToBase64('')).toBe('');
  });
});

// ── saveToGitHub ──────────────────────────────────────────────────────

describe('saveToGitHub', () => {
  const TOKEN = 'ghp_test';
  const OWNER = 'alice';
  const REPO  = 'my-repo';
  const NOW   = new Date('2024-06-15T10:30:00.000Z');

  const vectors  = [[0.1, 0.2], [0.3, 0.4]];
  const metadata = { headers: ['label'], rows: [['cat'], ['dog']] };

  // Sequence of mock responses for the Git Data API calls:
  // 1. createBlob (tensor)
  // 2. createBlob (metadata)
  // 3. createBlob (config)
  // 4. getLatestCommit (get ref)
  // 5. getCommitTree  (get commit)
  // 6. createTree
  // 7. createCommit
  // 8. updateRef (PATCH)
  function setupFetchMock() {
    let call = 0;
    const responses = [
      { sha: 'blob-tensor' },       // 1 createBlob tensor
      { sha: 'blob-metadata' },     // 2 createBlob metadata
      { sha: 'blob-config' },       // 3 createBlob config
      { object: { sha: 'commit0' } }, // 4 getLatestCommit
      { tree: { sha: 'tree0' } },   // 5 getCommitTree
      { sha: 'tree1' },             // 6 createTree
      { sha: 'commit1' },           // 7 createCommit
      {},                           // 8 updateRef
    ];
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      const body = responses[call++] ?? {};
      return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: async () => body });
    }));
  }

  beforeEach(setupFetchMock);
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('returns configUrl pointing to raw.githubusercontent.com', async () => {
    const { configUrl } = await saveToGitHub({
      token: TOKEN, owner: OWNER, repo: REPO,
      vectors, metadata, modelId: 'openai/text-embedding-3-small',
      modelName: 'OpenAI Small', now: NOW,
    });
    expect(configUrl).toContain('raw.githubusercontent.com');
    expect(configUrl).toContain(OWNER);
    expect(configUrl).toContain(REPO);
    expect(configUrl).toContain('config.json');
  });

  it('returns the correct dirName', async () => {
    const { dirName } = await saveToGitHub({
      token: TOKEN, owner: OWNER, repo: REPO,
      vectors, metadata, modelId: 'openai/text-embedding-3-small',
      modelName: 'OpenAI Small', now: NOW,
    });
    expect(dirName).toBe('2024-06-15_10-30-00-openai-text-embedding-3-small');
  });

  it('makes 8 fetch calls (3 blobs + ref + commit + tree + commit + updateRef)', async () => {
    await saveToGitHub({
      token: TOKEN, owner: OWNER, repo: REPO,
      vectors, metadata, modelId: 'model/name',
      modelName: 'Model', now: NOW,
    });
    expect(fetch).toHaveBeenCalledTimes(8);
  });

  it('includes auth header in all requests', async () => {
    await saveToGitHub({
      token: TOKEN, owner: OWNER, repo: REPO,
      vectors, metadata, modelId: 'model/name',
      modelName: 'Model', now: NOW,
    });
    for (const [, opts] of fetch.mock.calls) {
      expect(opts.headers['Authorization']).toBe(`Bearer ${TOKEN}`);
    }
  });

  it('throws when a fetch call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 422, statusText: 'Unprocessable',
      json: async () => ({}),
    }));
    await expect(saveToGitHub({
      token: TOKEN, owner: OWNER, repo: REPO,
      vectors, metadata, modelId: 'model/name',
      modelName: 'Model', now: NOW,
    })).rejects.toThrow('422');
  });
});
