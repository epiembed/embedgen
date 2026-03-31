import { describe, it, expect } from 'vitest';
import {
  MODELS,
  getModelsByProvider,
  getModelById,
  getModelsByInputType,
  getProviders,
} from '../../src/config/models.js';

describe('model registry', () => {
  it('contains all Voyage text models', () => {
    const voyageText = getModelsByProvider('voyage').filter(m => m.inputType === 'text');
    const names = voyageText.map(m => m.name);
    expect(names).toContain('voyage-4-large');
    expect(names).toContain('voyage-4');
    expect(names).toContain('voyage-4-lite');
    expect(names).toContain('voyage-3.5');
    expect(names).toContain('voyage-3.5-lite');
    expect(names).toContain('voyage-3-large');
    expect(names).toContain('voyage-code-3');
    expect(names).toContain('voyage-finance-2');
    expect(names).toContain('voyage-law-2');
  });

  it('contains both Voyage multimodal models', () => {
    const voyageMulti = getModelsByProvider('voyage').filter(m => m.inputType === 'multimodal');
    const names = voyageMulti.map(m => m.name);
    expect(names).toContain('voyage-multimodal-3.5');
    expect(names).toContain('voyage-multimodal-3');
  });

  it('contains all OpenAI models', () => {
    const names = getModelsByProvider('openai').map(m => m.name);
    expect(names).toContain('text-embedding-3-large');
    expect(names).toContain('text-embedding-3-small');
    expect(names).toContain('text-embedding-ada-002');
    expect(names).not.toContain('text-embedding-004'); // deprecated
  });

  it('contains both Gemini models and not the deprecated one', () => {
    const names = getModelsByProvider('gemini').map(m => m.name);
    expect(names).toContain('gemini-embedding-001');
    expect(names).toContain('gemini-embedding-2-preview');
    expect(names).not.toContain('text-embedding-004');
  });

  it('contains all HuggingFace in-browser models', () => {
    const names = getModelsByProvider('huggingface').map(m => m.name);
    expect(names).toContain('Xenova/all-MiniLM-L6-v2');
    expect(names).toContain('Xenova/bge-small-en-v1.5');
    expect(names).toContain('Xenova/gte-small');
    expect(names).toContain('mixedbread-ai/mxbai-embed-xsmall-v1');
    expect(names).toContain('nomic-ai/nomic-embed-text-v1.5');
    expect(names).toContain('onnx-community/embeddinggemma-300m-ONNX');
  });

  it('getModelById returns the correct model', () => {
    const model = getModelById('openai/text-embedding-3-small');
    expect(model).toBeDefined();
    expect(model.name).toBe('text-embedding-3-small');
    expect(model.dimensions).toBe(1536);
  });

  it('getModelById returns undefined for unknown id', () => {
    expect(getModelById('openai/nonexistent')).toBeUndefined();
  });

  it('getModelsByInputType returns only text models', () => {
    const textModels = getModelsByInputType('text');
    expect(textModels.every(m => m.inputType === 'text')).toBe(true);
    expect(textModels.length).toBeGreaterThan(0);
  });

  it('getModelsByInputType returns only multimodal models', () => {
    const multi = getModelsByInputType('multimodal');
    expect(multi.every(m => m.inputType === 'multimodal')).toBe(true);
    expect(multi.length).toBeGreaterThan(0);
  });

  it('getProviders returns all four providers', () => {
    const providers = getProviders();
    expect(providers).toContain('voyage');
    expect(providers).toContain('openai');
    expect(providers).toContain('gemini');
    expect(providers).toContain('huggingface');
  });

  it('all models have required fields', () => {
    for (const model of MODELS) {
      expect(model.id, `${model.id} missing id`).toBeTruthy();
      expect(model.provider, `${model.id} missing provider`).toBeTruthy();
      expect(model.name, `${model.id} missing name`).toBeTruthy();
      expect(model.displayName, `${model.id} missing displayName`).toBeTruthy();
      expect(typeof model.dimensions, `${model.id} dimensions must be number`).toBe('number');
      expect(typeof model.supportsMatryoshka).toBe('boolean');
    }
  });

  it('Voyage 4 series models share an embedding space', () => {
    const voyage4 = MODELS.filter(m => m.sharedEmbeddingSpace === 'voyage-4');
    const names = voyage4.map(m => m.name);
    expect(names).toContain('voyage-4-large');
    expect(names).toContain('voyage-4');
    expect(names).toContain('voyage-4-lite');
  });

  it('gemini-embedding-2-preview is flagged as preview', () => {
    const model = getModelById('gemini/gemini-embedding-2-preview');
    expect(model.preview).toBe(true);
  });

  it('HuggingFace models have null apiEndpoint', () => {
    const hf = getModelsByProvider('huggingface');
    expect(hf.every(m => m.apiEndpoint === null)).toBe(true);
  });

  it('nomic-embed-text-v1.5 supports Matryoshka with correct stops', () => {
    const model = getModelById('huggingface/nomic-ai/nomic-embed-text-v1.5');
    expect(model.supportsMatryoshka).toBe(true);
    expect(model.matryoshkaDimensions).toEqual([768, 512, 256, 128, 64]);
  });
});
