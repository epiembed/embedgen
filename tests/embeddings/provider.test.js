import { describe, it, expect } from 'vitest';
import {
  validateAdapter,
  ApiKeyError,
  RateLimitError,
  QuotaError,
  EmbeddingError,
} from '../../src/embeddings/provider.js';

const validAdapter = {
  name: 'test',
  embed: async () => [],
  validateApiKey: async () => true,
};

describe('validateAdapter', () => {
  it('accepts a valid adapter', () => {
    expect(validateAdapter(validAdapter)).toBe(true);
  });

  it('throws when adapter is not an object', () => {
    expect(() => validateAdapter(null)).toThrow(TypeError);
    expect(() => validateAdapter('string')).toThrow(TypeError);
  });

  it('throws when name is missing', () => {
    expect(() => validateAdapter({ ...validAdapter, name: undefined })).toThrow(/name/);
  });

  it('throws when name is empty string', () => {
    expect(() => validateAdapter({ ...validAdapter, name: '  ' })).toThrow(/name/);
  });

  it('throws when embed is not a function', () => {
    expect(() => validateAdapter({ ...validAdapter, embed: 'not-a-fn' })).toThrow(/embed/);
  });

  it('throws when validateApiKey is not a function', () => {
    expect(() => validateAdapter({ ...validAdapter, validateApiKey: null })).toThrow(/validateApiKey/);
  });
});

describe('error types', () => {
  it('ApiKeyError has correct name and message', () => {
    const err = new ApiKeyError('bad key');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiKeyError);
    expect(err.name).toBe('ApiKeyError');
    expect(err.message).toBe('bad key');
  });

  it('ApiKeyError has a default message', () => {
    expect(new ApiKeyError().message).toMatch(/api key/i);
  });

  it('RateLimitError has correct name and retryAfter', () => {
    const err = new RateLimitError('slow down', 30);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.name).toBe('RateLimitError');
    expect(err.retryAfter).toBe(30);
  });

  it('RateLimitError retryAfter defaults to null', () => {
    expect(new RateLimitError().retryAfter).toBeNull();
  });

  it('QuotaError has correct name', () => {
    const err = new QuotaError();
    expect(err).toBeInstanceOf(QuotaError);
    expect(err.name).toBe('QuotaError');
  });

  it('EmbeddingError carries status code', () => {
    const err = new EmbeddingError('bad input', 400);
    expect(err).toBeInstanceOf(EmbeddingError);
    expect(err.name).toBe('EmbeddingError');
    expect(err.status).toBe(400);
  });

  it('EmbeddingError status defaults to null', () => {
    expect(new EmbeddingError('oops').status).toBeNull();
  });
});
