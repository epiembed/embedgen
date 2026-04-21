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

  let currentStep = null;

  function render(state) {
    if (state.step === currentStep) return;
    currentStep = state.step;

    const renderFn = views.get(state.step);
    if (!renderFn) {
      console.warn(`[embedgen:router] No view registered for step: "${state.step}"`);
      return;
    }
    console.log(`[embedgen:router] → step: "${state.step}"`);
    container.innerHTML = '';
    renderFn(container, state);
    // Move focus to the new view's heading so screen readers announce the step change
    const heading = container.querySelector('h1');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: false });
    }
  }

  function start() {
    store.subscribe(render);
    render(store.getState());
  }

  return { register, start };
}
