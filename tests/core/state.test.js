import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../../src/core/state.js';

describe('createStore', () => {
  it('returns initial state via getState', () => {
    const store = createStore({ step: 'landing', data: null });
    expect(store.getState()).toEqual({ step: 'landing', data: null });
  });

  it('shallow-merges on setState', () => {
    const store = createStore({ step: 'landing', data: null, count: 0 });
    store.setState({ step: 'configure' });
    expect(store.getState()).toEqual({ step: 'configure', data: null, count: 0 });
  });

  it('notifies subscriber on setState', () => {
    const store = createStore({ step: 'landing' });
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ step: 'configure' });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ step: 'configure' });
  });

  it('notifies multiple subscribers', () => {
    const store = createStore({ step: 'landing' });
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(a);
    store.subscribe(b);
    store.setState({ step: 'embed' });
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('unsubscribe stops notifications', () => {
    const store = createStore({ step: 'landing' });
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    unsub();
    store.setState({ step: 'configure' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not mutate the previous state object', () => {
    const store = createStore({ step: 'landing' });
    const before = store.getState();
    store.setState({ step: 'configure' });
    expect(before.step).toBe('landing');
  });

  it('calls listener with fully merged state, not just partial', () => {
    const store = createStore({ a: 1, b: 2 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState({ a: 99 });
    expect(listener).toHaveBeenCalledWith({ a: 99, b: 2 });
  });
});
