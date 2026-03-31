/**
 * Step-based router.
 * Listens to state.step and renders the matching view into a container element.
 *
 * Usage:
 *   const router = createRouter(store, document.getElementById('app'));
 *   router.register('landing', renderLanding);
 *   router.register('configure', renderConfigure);
 *   router.start();
 */

/**
 * @param {object} store  Store returned by createStore
 * @param {HTMLElement} container  The element to render views into
 * @returns {{ register: (step: string, renderFn: (container: HTMLElement) => void) => void, start: () => void }}
 */
export function createRouter(store, container) {
  const views = new Map();

  function register(step, renderFn) {
    views.set(step, renderFn);
  }

  function render(state) {
    const renderFn = views.get(state.step);
    if (!renderFn) {
      console.warn(`[router] No view registered for step: "${state.step}"`);
      return;
    }
    container.innerHTML = '';
    renderFn(container, state);
  }

  function start() {
    store.subscribe(render);
    render(store.getState());
  }

  return { register, start };
}
