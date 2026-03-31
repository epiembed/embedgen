// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../../src/core/state.js';
import { createRouter } from '../../src/core/router.js';

function makeContainer() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('createRouter', () => {
  it('renders the initial step on start', () => {
    const store = createStore({ step: 'landing' });
    const container = makeContainer();
    const renderLanding = vi.fn();

    const router = createRouter(store, container);
    router.register('landing', renderLanding);
    router.start();

    expect(renderLanding).toHaveBeenCalledOnce();
    expect(renderLanding).toHaveBeenCalledWith(container, store.getState());
  });

  it('clears container and calls new render fn when step changes', () => {
    const store = createStore({ step: 'landing' });
    const container = makeContainer();
    const renderLanding = vi.fn();
    const renderConfigure = vi.fn((el) => { el.textContent = 'configure'; });

    const router = createRouter(store, container);
    router.register('landing', renderLanding);
    router.register('configure', renderConfigure);
    router.start();

    store.setState({ step: 'configure' });

    expect(renderConfigure).toHaveBeenCalledOnce();
    expect(container.textContent).toBe('configure');
  });

  it('passes full state to the render function', () => {
    const store = createStore({ step: 'landing', data: { headers: [], rows: [] } });
    const container = makeContainer();
    const renderLanding = vi.fn();

    const router = createRouter(store, container);
    router.register('landing', renderLanding);
    router.start();

    expect(renderLanding).toHaveBeenCalledWith(container, store.getState());
  });

  it('does not call old view when step changes', () => {
    const store = createStore({ step: 'landing' });
    const container = makeContainer();
    const renderLanding = vi.fn();
    const renderConfigure = vi.fn();

    const router = createRouter(store, container);
    router.register('landing', renderLanding);
    router.register('configure', renderConfigure);
    router.start();

    store.setState({ step: 'configure' });

    expect(renderLanding).toHaveBeenCalledOnce(); // only on start
    expect(renderConfigure).toHaveBeenCalledOnce();
  });

  it('warns and does nothing for unregistered steps', () => {
    const store = createStore({ step: 'landing' });
    const container = makeContainer();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const router = createRouter(store, container);
    router.register('landing', vi.fn());
    router.start();

    store.setState({ step: 'unknown' });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"unknown"'));
    warn.mockRestore();
  });

  it('re-renders correctly across multiple step transitions', () => {
    const store = createStore({ step: 'landing' });
    const container = makeContainer();
    const steps = ['configure', 'embed', 'export'];
    const fns = Object.fromEntries(steps.map(s => [s, vi.fn()]));

    const router = createRouter(store, container);
    router.register('landing', vi.fn());
    steps.forEach(s => router.register(s, fns[s]));
    router.start();

    steps.forEach(s => store.setState({ step: s }));

    steps.forEach(s => expect(fns[s]).toHaveBeenCalledOnce());
  });
});
