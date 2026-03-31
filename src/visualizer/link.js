/**
 * TF Projector shareable link builder.
 *
 * Constructs a URL of the form:
 *   https://projector.tensorflow.org/?config={encodedConfigUrl}
 *
 * The configUrl should be a raw.githubusercontent.com URL pointing to
 * the config.json produced by buildConfig().
 */

const PROJECTOR_BASE = 'https://projector.tensorflow.org/';

/**
 * Build a shareable TF Projector link from a raw GitHub config URL.
 * @param {string} configUrl  Publicly accessible URL to a projector config.json
 * @returns {string}
 */
export function buildShareableLink(configUrl) {
  if (!configUrl) throw new Error('configUrl is required');
  return `${PROJECTOR_BASE}?config=${encodeURIComponent(configUrl)}`;
}
