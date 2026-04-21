/**
 * Embedding model registry.
 * Single source of truth for all supported models and their metadata.
 */

/** @typedef {'text'|'image'|'multimodal'} InputType */
/** @typedef {'float'|'int8'|'uint8'|'binary'|'ubinary'} OutputDtype */

/**
 * @typedef {Object} ModelConfig
 * @property {string}      id                  - Unique identifier: "provider/model-name"
 * @property {string}      provider            - 'voyage'|'openai'|'gemini'|'huggingface'
 * @property {string}      name                - API model name
 * @property {string}      displayName         - Human-readable name for the UI
 * @property {number}      dimensions          - Default output dimensions
 * @property {number}      maxTokens           - Max input tokens per text
 * @property {number}      maxBatchSize        - Max inputs per API request
 * @property {InputType}   inputType           - Supported input modality
 * @property {boolean}     supportsMatryoshka  - Whether Matryoshka dim reduction is supported
 * @property {number[]|null} matryoshkaDimensions - Legal dimension values (null = any value ≤ dimensions)
 * @property {OutputDtype[]|null} outputDtypes - Supported quantization options (null = float only)
 * @property {string|null} apiEndpoint         - API endpoint URL (null for in-browser models)
 * @property {boolean}     preview             - Whether the model is in preview/beta
 * @property {string|null} sharedEmbeddingSpace - ID prefix if models share an embedding space
 * @property {string|null} note                - Optional UI-facing note
 */

/** @type {ModelConfig[]} */
const MODELS = [
  // ── Voyage AI — Text ────────────────────────────────────────────
  {
    id: 'voyage/voyage-4-large',
    provider: 'voyage',
    name: 'voyage-4-large',
    displayName: 'Voyage 4 Large',
    dimensions: 1024,
    maxTokens: 32000,
    maxBatchSize: 120000, // tokens/request
    inputType: 'text',
    supportsMatryoshka: true,
    matryoshkaDimensions: [2048, 1024, 512, 256],
    outputDtypes: ['float', 'int8', 'uint8', 'binary', 'ubinary'],
    apiEndpoint: 'https://api.voyageai.com/v1/embeddings',
    preview: false,
    sharedEmbeddingSpace: 'voyage-4',
    note: 'Highest quality in the Voyage 4 series. Shares embedding space with voyage-4 and voyage-4-lite.',
  },
  {
    id: 'voyage/voyage-4',
    provider: 'voyage',
    name: 'voyage-4',
    displayName: 'Voyage 4',
    dimensions: 1024,
    maxTokens: 32000,
    maxBatchSize: 320000,
    inputType: 'text',
    supportsMatryoshka: true,
    matryoshkaDimensions: [2048, 1024, 512, 256],
    outputDtypes: ['float', 'int8', 'uint8', 'binary', 'ubinary'],
    apiEndpoint: 'https://api.voyageai.com/v1/embeddings',
    preview: false,
    sharedEmbeddingSpace: 'voyage-4',
    note: 'Shares embedding space with voyage-4-large and voyage-4-lite.',
  },
  {
    id: 'voyage/voyage-4-lite',
    provider: 'voyage',
    name: 'voyage-4-lite',
    displayName: 'Voyage 4 Lite',
    dimensions: 1024,
    maxTokens: 32000,
    maxBatchSize: 1000000,
    inputType: 'text',
    supportsMatryoshka: true,
    matryoshkaDimensions: [2048, 1024, 512, 256],
    outputDtypes: ['float', 'int8', 'uint8', 'binary', 'ubinary'],
    apiEndpoint: 'https://api.voyageai.com/v1/embeddings',
    preview: false,
    sharedEmbeddingSpace: 'voyage-4',
    note: 'Fastest and cheapest in the Voyage 4 series. Shares embedding space with voyage-4-large and voyage-4.',
  },
  {
    id: 'voyage/voyage-3.5',
    provider: 'voyage',
    name: 'voyage-3.5',
    displayName: 'Voyage 3.5',
    dimensions: 1024,
    maxTokens: 32000,
    maxBatchSize: 320000,
    inputType: 'text',
    supportsMatryoshka: true,
    matryoshkaDimensions: [2048, 1024, 512, 256],
    outputDtypes: ['float', 'int8', 'uint8', 'binary', 'ubinary'],
    apiEndpoint: 'https://api.voyageai.com/v1/embeddings',
    preview: false,
    sharedEmbeddingSpace: null,
    note: null,
  },
  {
    id: 'voyage/voyage-3.5-lite',
    provider: 'voyage',
    name: 'voyage-3.5-lite',
    displayName: 'Voyage 3.5 Lite',
    dimensions: 1024,
    maxTokens: 32000,
    maxBatchSize: 1000000,
    inputType: 'text',
    supportsMatryoshka: true,
    matryoshkaDimensions: [2048, 1024, 512, 256],
    outputDtypes: ['float', 'int8', 'uint8', 'binary', 'ubinary'],
    apiEndpoint: 'https://api.voyageai.com/v1/embeddings',
    preview: false,
    sharedEmbeddingSpace: null,
    note: null,
  },
  {
    id: 'voyage/voyage-3-large',
    provider: 'voyage',
    name: 'voyage-3-large',
    displayName: 'Voyage 3 Large',
    dimensions: 1024,
    maxTokens: 32000,
    maxBatchSize: 120000,
    inputType: 'text',
    supportsMatryoshka: true,
    matryoshkaDimensions: [2048, 1024, 512, 256],
    outputDtypes: ['float', 'int8', 'uint8', 'binary', 'ubinary'],
    apiEndpoint: 'https://api.voyageai.com/v1/embeddings',
    preview: false,
    sharedEmbeddingSpace: null,
    note: null,
  },
  {
    id: 'voyage/voyage-code-3',
    provider: 'voyage',
    name: 'voyage-code-3',
    displayName: 'Voyage Code 3',
    dimensions: 1024,
    maxTokens: 32000,
    maxBatchSize: 120000,
    inputType: 'text',
    supportsMatryoshka: true,
    matryoshkaDimensions: [2048, 1024, 512, 256],
    outputDtypes: ['float', 'int8', 'uint8', 'binary', 'ubinary'],
    apiEndpoint: 'https://api.voyageai.com/v1/embeddings',
    preview: false,
    sharedEmbeddingSpace: null,
    note: 'Optimized for code.',
  },
  {
    id: 'voyage/voyage-finance-2',
    provider: 'voyage',
    name: 'voyage-finance-2',
    displayName: 'Voyage Finance 2',
    dimensions: 1024,
    maxTokens: 32000,
    maxBatchSize: 120000,
    inputType: 'text',
    supportsMatryoshka: false,
    matryoshkaDimensions: null,
    outputDtypes: null,
    apiEndpoint: 'https://api.voyageai.com/v1/embeddings',
    preview: false,
    sharedEmbeddingSpace: null,
    note: 'Optimized for financial text.',
  },
  {
    id: 'voyage/voyage-law-2',
    provider: 'voyage',
    name: 'voyage-law-2',
    displayName: 'Voyage Law 2',
    dimensions: 1024,
    maxTokens: 32000,
    maxBatchSize: 120000,
    inputType: 'text',
    supportsMatryoshka: false,
    matryoshkaDimensions: null,
    outputDtypes: null,
    apiEndpoint: 'https://api.voyageai.com/v1/embeddings',
    preview: false,
    sharedEmbeddingSpace: null,
    note: 'Optimized for legal text.',
  },

  // ── Voyage AI — Multimodal ───────────────────────────────────────
  {
    id: 'voyage/voyage-multimodal-3.5',
    provider: 'voyage',
    name: 'voyage-multimodal-3.5',
    displayName: 'Voyage Multimodal 3.5',
    dimensions: 1024,
    maxTokens: 32000,
    maxBatchSize: 120000,
    inputType: 'multimodal',
    supportsMatryoshka: true,
    matryoshkaDimensions: [2048, 1024, 512, 256],
    outputDtypes: null,
    apiEndpoint: 'https://api.voyageai.com/v1/multimodalembeddings',
    preview: false,
    sharedEmbeddingSpace: null,
    note: 'Supports text, images, and video.',
  },
  {
    id: 'voyage/voyage-multimodal-3',
    provider: 'voyage',
    name: 'voyage-multimodal-3',
    displayName: 'Voyage Multimodal 3',
    dimensions: 1024,
    maxTokens: 32000,
    maxBatchSize: 120000,
    inputType: 'multimodal',
    supportsMatryoshka: false,
    matryoshkaDimensions: null,
    outputDtypes: null,
    apiEndpoint: 'https://api.voyageai.com/v1/multimodalembeddings',
    preview: false,
    sharedEmbeddingSpace: null,
    note: 'Supports text and images.',
  },

  // ── OpenAI ───────────────────────────────────────────────────────
  {
    id: 'openai/text-embedding-3-large',
    provider: 'openai',
    name: 'text-embedding-3-large',
    displayName: 'OpenAI text-embedding-3-large',
    dimensions: 3072,
    maxTokens: 8191,
    maxBatchSize: 2048,
    inputType: 'text',
    supportsMatryoshka: true,
    matryoshkaDimensions: null, // any value ≤ 3072
    outputDtypes: null,
    apiEndpoint: 'https://api.openai.com/v1/embeddings',
    preview: false,
    sharedEmbeddingSpace: null,
    note: null,
  },
  {
    id: 'openai/text-embedding-3-small',
    provider: 'openai',
    name: 'text-embedding-3-small',
    displayName: 'OpenAI text-embedding-3-small',
    dimensions: 1536,
    maxTokens: 8191,
    maxBatchSize: 2048,
    inputType: 'text',
    supportsMatryoshka: true,
    matryoshkaDimensions: null, // any value ≤ 1536
    outputDtypes: null,
    apiEndpoint: 'https://api.openai.com/v1/embeddings',
    preview: false,
    sharedEmbeddingSpace: null,
    note: null,
  },
  {
    id: 'openai/text-embedding-ada-002',
    provider: 'openai',
    name: 'text-embedding-ada-002',
    displayName: 'OpenAI text-embedding-ada-002',
    dimensions: 1536,
    maxTokens: 8191,
    maxBatchSize: 2048,
    inputType: 'text',
    supportsMatryoshka: false,
    matryoshkaDimensions: null,
    outputDtypes: null,
    apiEndpoint: 'https://api.openai.com/v1/embeddings',
    preview: false,
    sharedEmbeddingSpace: null,
    note: null,
  },

  // ── Google Gemini ────────────────────────────────────────────────
  {
    id: 'gemini/gemini-embedding-001',
    provider: 'gemini',
    name: 'gemini-embedding-001',
    displayName: 'Gemini Embedding 001',
    dimensions: 3072,
    maxTokens: 2048,
    maxBatchSize: 100, // batchEmbedContents supports up to 100 requests
    inputType: 'text',
    supportsMatryoshka: true,
    matryoshkaDimensions: null, // any value; recommended: 768, 1536, 3072
    outputDtypes: null,
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents',
    preview: false,
    sharedEmbeddingSpace: null,
    note: '#1 on MTEB Multilingual leaderboard.',
  },
  {
    id: 'gemini/gemini-embedding-2-preview',
    provider: 'gemini',
    name: 'gemini-embedding-2-preview',
    displayName: 'Gemini Embedding 2',
    dimensions: 3072,
    maxTokens: null, // not yet published
    maxBatchSize: 100,
    inputType: 'multimodal',
    supportsMatryoshka: true,
    matryoshkaDimensions: null, // any value; recommended: 768, 1536, 3072
    outputDtypes: null,
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:batchEmbedContents',
    preview: true,
    sharedEmbeddingSpace: null,
    note: 'Preview. First multimodal Gemini embedding — supports text, images, video, audio, and PDFs.',
  },

  // ── HuggingFace (in-browser) ─────────────────────────────────────
  {
    id: 'huggingface/Xenova/all-MiniLM-L6-v2',
    provider: 'huggingface',
    name: 'Xenova/all-MiniLM-L6-v2',
    displayName: 'all-MiniLM-L6-v2',
    dimensions: 384,
    maxTokens: 256,
    maxBatchSize: 32,
    inputType: 'text',
    supportsMatryoshka: false,
    matryoshkaDimensions: null,
    outputDtypes: null,
    apiEndpoint: null,
    preview: false,
    sharedEmbeddingSpace: null,
    note: 'Runs in-browser. No API key needed. ~23 MB download.',
  },
  {
    id: 'huggingface/Xenova/bge-small-en-v1.5',
    provider: 'huggingface',
    name: 'Xenova/bge-small-en-v1.5',
    displayName: 'bge-small-en-v1.5',
    dimensions: 384,
    maxTokens: 512,
    maxBatchSize: 32,
    inputType: 'text',
    supportsMatryoshka: false,
    matryoshkaDimensions: null,
    outputDtypes: null,
    apiEndpoint: null,
    preview: false,
    sharedEmbeddingSpace: null,
    note: 'Runs in-browser. No API key needed. ~33 MB download.',
  },
  {
    id: 'huggingface/Xenova/paraphrase-MiniLM-L6-v2',
    provider: 'huggingface',
    name: 'Xenova/paraphrase-MiniLM-L6-v2',
    displayName: 'paraphrase-MiniLM-L6-v2',
    dimensions: 384,
    maxTokens: 128,
    maxBatchSize: 32,
    inputType: 'text',
    supportsMatryoshka: false,
    matryoshkaDimensions: null,
    outputDtypes: null,
    apiEndpoint: null,
    preview: false,
    sharedEmbeddingSpace: null,
    note: 'Runs in-browser. No API key needed. ~23 MB download.',
  },
  {
    id: 'huggingface/Xenova/all-MiniLM-L12-v2',
    provider: 'huggingface',
    name: 'Xenova/all-MiniLM-L12-v2',
    displayName: 'all-MiniLM-L12-v2',
    dimensions: 384,
    maxTokens: 256,
    maxBatchSize: 32,
    inputType: 'text',
    supportsMatryoshka: false,
    matryoshkaDimensions: null,
    outputDtypes: null,
    apiEndpoint: null,
    preview: false,
    sharedEmbeddingSpace: null,
    note: 'Runs in-browser. No API key needed. ~33 MB download.',
  },
  {
    id: 'huggingface/Xenova/all-distilroberta-v1',
    provider: 'huggingface',
    name: 'Xenova/all-distilroberta-v1',
    displayName: 'all-distilroberta-v1',
    dimensions: 768,
    maxTokens: 512,
    maxBatchSize: 32,
    inputType: 'text',
    supportsMatryoshka: false,
    matryoshkaDimensions: null,
    outputDtypes: null,
    apiEndpoint: null,
    preview: false,
    sharedEmbeddingSpace: null,
    note: 'Runs in-browser. No API key needed. ~82 MB download.',
  },
  {
    id: 'huggingface/Xenova/paraphrase-MiniLM-L3-v2',
    provider: 'huggingface',
    name: 'Xenova/paraphrase-MiniLM-L3-v2',
    displayName: 'paraphrase-MiniLM-L3-v2',
    dimensions: 384,
    maxTokens: 128,
    maxBatchSize: 32,
    inputType: 'text',
    supportsMatryoshka: false,
    matryoshkaDimensions: null,
    outputDtypes: null,
    apiEndpoint: null,
    preview: false,
    sharedEmbeddingSpace: null,
    note: 'Runs in-browser. No API key needed. ~17 MB download. Fastest MiniLM variant.',
  },
  {
    id: 'huggingface/Xenova/msmarco-MiniLM-L12-cos-v5',
    provider: 'huggingface',
    name: 'Xenova/msmarco-MiniLM-L12-cos-v5',
    displayName: 'msmarco-MiniLM-L12-cos-v5',
    dimensions: 384,
    maxTokens: 512,
    maxBatchSize: 32,
    inputType: 'text',
    supportsMatryoshka: false,
    matryoshkaDimensions: null,
    outputDtypes: null,
    apiEndpoint: null,
    preview: false,
    sharedEmbeddingSpace: null,
    note: 'Runs in-browser. No API key needed. ~33 MB download. Optimized for search/retrieval.',
  },
  {
    id: 'huggingface/Xenova/multi-qa-MiniLM-L6-cos-v1',
    provider: 'huggingface',
    name: 'Xenova/multi-qa-MiniLM-L6-cos-v1',
    displayName: 'multi-qa-MiniLM-L6-cos-v1',
    dimensions: 384,
    maxTokens: 512,
    maxBatchSize: 32,
    inputType: 'text',
    supportsMatryoshka: false,
    matryoshkaDimensions: null,
    outputDtypes: null,
    apiEndpoint: null,
    preview: false,
    sharedEmbeddingSpace: null,
    note: 'Runs in-browser. No API key needed. ~23 MB download. Trained for question-answer retrieval.',
  },
  {
    id: 'huggingface/Xenova/gte-small',
    provider: 'huggingface',
    name: 'Xenova/gte-small',
    displayName: 'gte-small',
    dimensions: 384,
    maxTokens: 512,
    maxBatchSize: 32,
    inputType: 'text',
    supportsMatryoshka: false,
    matryoshkaDimensions: null,
    outputDtypes: null,
    apiEndpoint: null,
    preview: false,
    sharedEmbeddingSpace: null,
    note: 'Runs in-browser. No API key needed. ~33 MB download.',
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────

/**
 * Get all models for a given provider.
 * @param {string} provider
 * @returns {ModelConfig[]}
 */
export function getModelsByProvider(provider) {
  return MODELS.filter(m => m.provider === provider);
}

/**
 * Get a model by its unique ID.
 * @param {string} id
 * @returns {ModelConfig|undefined}
 */
export function getModelById(id) {
  return MODELS.find(m => m.id === id);
}

/**
 * Get all models that support a given input type.
 * @param {InputType} inputType
 * @returns {ModelConfig[]}
 */
export function getModelsByInputType(inputType) {
  return MODELS.filter(m => m.inputType === inputType);
}

/**
 * Get all unique provider names in registry order.
 * @returns {string[]}
 */
export function getProviders() {
  return [...new Set(MODELS.map(m => m.provider))];
}

export { MODELS };
