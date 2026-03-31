/**
 * GitHub file persistence for EmbedGen exports.
 *
 * Uses the GitHub Git Data API to atomically commit three files in a single
 * commit:
 *   embedgen-data/{timestamp}-{model-name}/tensors.bytes
 *   embedgen-data/{timestamp}-{model-name}/metadata.tsv
 *   embedgen-data/{timestamp}-{model-name}/config.json
 *
 * config.json is built with raw GitHub URLs so TF Projector can load
 * the files directly.
 */

import { toBinary } from './tensor.js';
import { toTSV as metaToTSV } from './metadata.js';
import { buildConfig, buildGitHubRawUrl } from './config.js';

const BASE = 'https://api.github.com';

// ── Path / URL helpers ────────────────────────────────────────────────

/**
 * Build the export directory name: "{timestamp}-{model-name}".
 * Model name has slashes replaced with dashes.
 * @param {string} modelId   e.g. "openai/text-embedding-3-small"
 * @param {Date}   [now]
 * @returns {string}
 */
export function buildDirName(modelId, now = new Date()) {
  const ts = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const slug = modelId.replace(/\//g, '-');
  return `${ts}-${slug}`;
}

/**
 * Build the repo-relative paths for all three export files.
 * @param {string} dirName
 * @returns {{ tensorPath: string, metadataPath: string, configPath: string }}
 */
export function buildFilePaths(dirName) {
  const base = `embedgen-data/${dirName}`;
  return {
    tensorPath:   `${base}/tensors.bytes`,
    metadataPath: `${base}/metadata.tsv`,
    configPath:   `${base}/config.json`,
  };
}

/**
 * Base64-encode a Uint8Array / ArrayBuffer for the GitHub API.
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
export function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str);
}

/**
 * Base64-encode a UTF-8 string for the GitHub API.
 * @param {string} text
 * @returns {string}
 */
export function stringToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str);
}

// ── Git Data API helpers ──────────────────────────────────────────────

async function ghFetch(token, path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${res.statusText} (${path})`);
  }
  return res.json();
}

async function createBlob(token, owner, repo, content, encoding = 'base64') {
  const data = await ghFetch(token, `/repos/${owner}/${repo}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content, encoding }),
  });
  return data.sha;
}

async function getLatestCommit(token, owner, repo, branch = 'main') {
  const data = await ghFetch(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`);
  return {
    commitSha: data.object.sha,
  };
}

async function getCommitTree(token, owner, repo, commitSha) {
  const data = await ghFetch(token, `/repos/${owner}/${repo}/git/commits/${commitSha}`);
  return data.tree.sha;
}

async function createTree(token, owner, repo, baseTreeSha, files) {
  // files: [{ path, sha }]
  const tree = files.map(f => ({
    path: f.path,
    mode: '100644',
    type: 'blob',
    sha: f.sha,
  }));
  const data = await ghFetch(token, `/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree }),
  });
  return data.sha;
}

async function createCommit(token, owner, repo, message, treeSha, parentSha) {
  const data = await ghFetch(token, `/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  });
  return data.sha;
}

async function updateRef(token, owner, repo, branch, commitSha) {
  await ghFetch(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commitSha }),
  });
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Save embeddings to a GitHub repo in a single atomic commit.
 *
 * @param {object}   opts
 * @param {string}   opts.token        GitHub access token
 * @param {string}   opts.owner        Repo owner (username or org)
 * @param {string}   opts.repo         Repo name
 * @param {string}   opts.branch       Target branch (default: 'main')
 * @param {number[][]} opts.vectors    Embedding vectors [N × D]
 * @param {{ headers: string[], rows: (string|null)[][] }} opts.metadata
 * @param {string}   opts.modelId      e.g. "openai/text-embedding-3-small"
 * @param {string}   opts.modelName    Display name for config
 * @param {Date}     [opts.now]        Override timestamp (for testing)
 * @returns {Promise<{ configUrl: string, dirName: string }>}
 */
export async function saveToGitHub({
  token, owner, repo, branch = 'main',
  vectors, metadata, modelId, modelName, now,
}) {
  const n = vectors.length;
  const d = vectors[0]?.length ?? 0;

  const dirName = buildDirName(modelId, now);
  const { tensorPath, metadataPath, configPath } = buildFilePaths(dirName);

  // Build raw GitHub URLs for the config so TF Projector can load files
  const tensorUrl   = buildGitHubRawUrl(owner, repo, branch, tensorPath);
  const metadataUrl = buildGitHubRawUrl(owner, repo, branch, metadataPath);

  const config = buildConfig({
    tensorName:   modelName ?? modelId,
    tensorShape:  [n, d],
    tensorPath:   tensorUrl,
    metadataPath: metadata.headers.length ? metadataUrl : undefined,
  });

  // Encode files
  const tensorBase64   = arrayBufferToBase64(toBinary(vectors));
  const metadataBase64 = stringToBase64(metaToTSV(metadata.headers, metadata.rows));
  const configBase64   = stringToBase64(JSON.stringify(config, null, 2));

  // Create blobs in parallel
  const [tensorSha, metadataSha, configSha] = await Promise.all([
    createBlob(token, owner, repo, tensorBase64),
    createBlob(token, owner, repo, metadataBase64),
    createBlob(token, owner, repo, configBase64),
  ]);

  // Atomic commit via Git Data API
  const { commitSha } = await getLatestCommit(token, owner, repo, branch);
  const baseTreeSha   = await getCommitTree(token, owner, repo, commitSha);
  const newTreeSha    = await createTree(token, owner, repo, baseTreeSha, [
    { path: tensorPath,   sha: tensorSha },
    { path: metadataPath, sha: metadataSha },
    { path: configPath,   sha: configSha },
  ]);
  const newCommitSha  = await createCommit(
    token, owner, repo,
    `embedgen: add ${dirName}`,
    newTreeSha, commitSha,
  );
  await updateRef(token, owner, repo, branch, newCommitSha);

  const configUrl = buildGitHubRawUrl(owner, repo, branch, configPath);
  return { configUrl, dirName };
}
