/**
 * GitHub login UI component.
 *
 * States:
 *   - logged-out: shows "Login with GitHub" button.
 *   - loading:    shows a spinner while fetching user info or initiating login.
 *   - logged-in:  shows avatar + username + "Logout" button.
 *
 * Usage:
 *   const login = createGitHubLogin({ clientId, redirectUri, getUser, initiateLogin, getToken, logout });
 *   container.appendChild(login.el);
 *   login.init();  // checks for an existing token and hydrates UI
 */

/**
 * @param {object} opts
 * @param {string}   opts.clientId
 * @param {string}   opts.redirectUri
 * @param {Function} opts.getUser       — (token) => Promise<{ login, avatar_url }>
 * @param {Function} opts.initiateLogin — (clientId, redirectUri) => Promise<void>
 * @param {Function} opts.getToken      — () => string|null
 * @param {Function} opts.logout        — () => void
 * @param {Function} [opts.onLogin]     — (user) => void  called after successful login
 * @param {Function} [opts.onLogout]    — () => void      called after logout
 * @returns {{ el: HTMLElement, init: () => Promise<void> }}
 */
export function createGitHubLogin({
  clientId, redirectUri,
  getUser, initiateLogin, getToken, logout,
  onLogin, onLogout,
}) {
  const el = document.createElement('div');
  el.className = 'github-login';

  // ── Logged-out state ──────────────────────────────────────────────
  const loggedOut = document.createElement('div');
  loggedOut.className = 'github-login__logged-out';

  const loginBtn = document.createElement('button');
  loginBtn.type = 'button';
  loginBtn.className = 'github-login__login-btn btn btn--secondary';
  loginBtn.textContent = 'Login with GitHub';
  loginBtn.addEventListener('click', async () => {
    setLoading(true);
    await initiateLogin(clientId, redirectUri);
  });
  loggedOut.appendChild(loginBtn);

  // ── Loading state ─────────────────────────────────────────────────
  const loadingEl = document.createElement('div');
  loadingEl.className = 'github-login__loading';
  loadingEl.textContent = 'Connecting to GitHub…';
  loadingEl.hidden = true;

  // ── Logged-in state ───────────────────────────────────────────────
  const loggedIn = document.createElement('div');
  loggedIn.className = 'github-login__logged-in';
  loggedIn.hidden = true;

  const avatar = document.createElement('img');
  avatar.className = 'github-login__avatar';
  avatar.alt = '';
  avatar.width = 32;
  avatar.height = 32;

  const username = document.createElement('span');
  username.className = 'github-login__username';

  const logoutBtn = document.createElement('button');
  logoutBtn.type = 'button';
  logoutBtn.className = 'github-login__logout-btn btn btn--ghost';
  logoutBtn.textContent = 'Logout';
  logoutBtn.addEventListener('click', () => {
    logout();
    showLoggedOut();
    onLogout?.();
  });

  loggedIn.appendChild(avatar);
  loggedIn.appendChild(username);
  loggedIn.appendChild(logoutBtn);

  // ── Error ─────────────────────────────────────────────────────────
  const errorEl = document.createElement('p');
  errorEl.className = 'github-login__error';
  errorEl.hidden = true;

  el.appendChild(loggedOut);
  el.appendChild(loadingEl);
  el.appendChild(loggedIn);
  el.appendChild(errorEl);

  // ── State helpers ─────────────────────────────────────────────────
  function setLoading(on) {
    loadingEl.hidden = !on;
    loggedOut.hidden = on;
    loggedIn.hidden = true;
    errorEl.hidden = true;
  }

  function showLoggedOut() {
    loggedOut.hidden = false;
    loadingEl.hidden = true;
    loggedIn.hidden = true;
    errorEl.hidden = true;
  }

  function showLoggedIn(user) {
    avatar.src = user.avatar_url;
    avatar.alt = user.login;
    username.textContent = user.login;
    loggedIn.hidden = false;
    loggedOut.hidden = true;
    loadingEl.hidden = true;
    errorEl.hidden = true;
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    showLoggedOut();
  }

  // ── init: hydrate from existing token ─────────────────────────────
  async function init() {
    const token = getToken();
    if (!token) { showLoggedOut(); return; }

    setLoading(true);
    try {
      const user = await getUser(token);
      showLoggedIn(user);
      onLogin?.(user);
    } catch {
      logout();
      showError('Session expired — please log in again.');
    }
  }

  return { el, init };
}
