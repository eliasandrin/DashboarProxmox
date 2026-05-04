/* INFORMIX Spa — Authentication */
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  if (!loginForm && !registerForm) return;

  // Redirect if already logged in
  if (ApiClient.getToken()) { window.location.href = '/dashboard.html'; return; }

  let errEl = document.getElementById('loginError');

  const ensureBanner = () => {
    if (errEl) return errEl;
    const hostForm = loginForm || registerForm;
    if (!hostForm) return null;

    const banner = document.createElement('div');
    banner.id = 'loginError';
    banner.className = 'login-error';
    banner.setAttribute('role', 'alert');
    banner.style.display = 'none';
    hostForm.parentNode.insertBefore(banner, hostForm);
    errEl = banner;
    return errEl;
  };

  const showMessage = (message, type = 'error') => {
    const banner = ensureBanner();
    if (!banner) return;
    banner.classList.remove('login-message-error', 'login-message-success');
    banner.classList.add(type === 'success' ? 'login-message-success' : 'login-message-error');
    banner.textContent = message;
    banner.style.display = 'block';
  };

  const clearError = () => {
    const banner = ensureBanner();
    if (!banner) return;
    banner.style.display = 'none';
    banner.textContent = '';
    banner.classList.remove('login-message-error', 'login-message-success');
  };

  const readableError = (err, fallbackKey) => {
    const rawMsg = (err && err.message ? String(err.message) : '');
    const raw = rawMsg.toLowerCase();

    if (raw.includes('username already exists')) {
      return t('username_exists');
    }
    if (raw.includes('email already exists')) {
      return t('email_exists');
    }
    if (raw.includes('at least 6 characters') || raw.includes('field must have at least 6 characters') || raw.includes('string should have at least 6 characters')) {
      return t('min_6_chars');
    }
    if (raw.includes('at least 8 characters')) {
      return t('min_8_chars');
    }
    if (raw.includes('only @informix.it')) {
      return t('email_domain_invalid');
    }

    if (raw.includes('unauthorized') || raw.includes('401')) {
      return t('login_failed');
    }
    if (raw.includes('failed to fetch') || raw.includes('networkerror') || raw.includes('load failed')) {
      return t('backend_unreachable');
    }
    if (!rawMsg || raw.includes('[object object]')) {
      return t(fallbackKey);
    }
    return rawMsg;
  };

  if (registerForm) {
    const initializeRegisterPage = async () => {
      clearError();
      try {
        await ApiClient.get('/auth/registration-status');
      } catch {
        // Avoid showing an error banner at page load.
      }
    };

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();

      const btn = document.getElementById('registerBtn');
      const full_name = document.getElementById('registerFullName').value.trim();
      const usernameLocal = document.getElementById('registerUsernameLocal').value.trim().toLowerCase();
      const password = document.getElementById('registerPassword').value;
      const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

      if (password !== passwordConfirm) {
        showMessage(t('password_mismatch'));
        return;
      }

      if (!/^[a-z0-9._%+-]+$/.test(usernameLocal)) {
        showMessage(t('invalid_email_local'));
        return;
      }

      const username = usernameLocal;
      const email = `${usernameLocal}@informix.it`;

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';

      try {
        await ApiClient.post('/auth/register', {
          username,
          email,
          password,
          full_name: full_name || null,
        });
        window.location.href = `/login.html?registered=1&username=${encodeURIComponent(usernameLocal)}`;
      } catch (err) {
        showMessage(readableError(err, 'register_failed'));
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<span data-i18n="create_account">${t('create_account')}</span>`;
      }
    });

    initializeRegisterPage();
  }

  if (loginForm) {
    const params = new URLSearchParams(window.location.search);
    if (params.get('registered') === '1') {
      const usernameFromQuery = params.get('username');
      if (usernameFromQuery) document.getElementById('loginUsernameLocal').value = usernameFromQuery;
      window.history.replaceState({}, document.title, '/login.html');
    }

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();

      const btn = document.getElementById('loginBtn');
      const usernameLocal = document.getElementById('loginUsernameLocal').value.trim().toLowerCase();
      const password = document.getElementById('password').value;

      if (!/^[a-z0-9._%+-]+$/.test(usernameLocal)) {
        showMessage(t('invalid_email_local'));
        return;
      }

      const username = usernameLocal;

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';

      try {
        const data = await ApiClient.post('/auth/login', { username, password });
        ApiClient.setToken(data.access_token);
        ApiClient.setUser(data.user);
        window.location.href = '/dashboard.html';
      } catch (err) {
        showMessage(readableError(err, 'login_failed'));
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<span data-i18n="sign_in">${t('sign_in')}</span>`;
      }
    });
  }
});
