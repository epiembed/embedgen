/**
 * TF Projector config JSON builder.
 *
 * Download mode: paths are relative filenames.
 * GitHub mode:   paths are raw GitHub URLs.
 */

/**
 * Build a raw GitHub URL for a file.
 * @param {string} owner
 * @param {string} repo
 * @param {string} branch
 * @param {string} filePath
 * @returns {string}
 */
export function buildGitHubRawUrl(owner, repo, branch, filePath) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
}

/**
 * Build a ProjectorConfig object.
 * @param {Object} opts
 * @param {string}   opts.tensorName     - Display name for this embedding.
 * @param {number[]} opts.tensorShape    - [N, D] — number of points × dimensions.
 * @param {string}   opts.tensorPath     - Path or URL to the tensor file.
 * @param {string}   [opts.metadataPath] - Path or URL to the metadata TSV (optional).
 * @param {Object}   [opts.sprite]       - Optional sprite config object.
 * @returns {{ embeddings: object[] }}
 */
export function buildConfig({ tensorName, tensorShape, tensorPath, metadataPath, sprite }) {
  const embedding = { tensorName, tensorShape, tensorPath };
  if (metadataPath) embedding.metadataPath = metadataPath;
  if (sprite) embedding.sprite = sprite;
  return { embeddings: [embedding] };
}
