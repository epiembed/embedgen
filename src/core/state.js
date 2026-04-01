/**
 * Reactive state store.
 *
 * Usage:
 *   const store = createStore({ step: 'landing', data: null });
 *   const unsub = store.subscribe(state => console.log(state));
 *   store.setState({ step: 'configure' });
 *   unsub();
 */

/**
 * @template T
 * @param {T} initialState
 * @returns {{ getState: () => T, setState: (partial: Partial<T>) => void, subscribe: (listener: (state: T) => void) => () => void }}
 */
export function createStore(initialState) {
  let state = { ...initialState };
  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(partial) {
    console.log('[embedgen:state] setState', partial);
    state = { ...state, ...partial };
    console.log('[embedgen:state] new state', state);
    for (const listener of listeners) {
      listener(state);
    }
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { getState, setState, subscribe };
}
