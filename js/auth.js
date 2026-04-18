/* ========================================
   काम Khoj.com — Authentication (auth.js)
   ======================================== */

(function () {
  /* ── State ── */
  let selectedUserType = null; // 'worker' | 'client'

  /* ── DOM Refs ── */
  const heroSection = document.getElementById('hero-section');
  const authSection = document.getElementById('auth-section');
  const authBackBtn = document.getElementById('auth-back-btn');
  const authTabs = document.querySelectorAll('.auth-tab');
  const loginPanel = document.getElementById('login-panel');
  const registerPanel = document.getElementById('register-panel');
  const loginForm = document.getElementById('login-form');
  const registerFormWorker = document.getElementById('register-form-worker');
  const registerFormClient = document.getElementById('register-form-client');
  const btnLookingForWork = document.getElementById('btn-looking-for-work');
  const btnNeedToHire = document.getElementById('btn-need-to-hire');
  const authTitle = document.getElementById('auth-title');

  /* ── If already logged in, redirect ── */
  const session = getSession();
  if (session) {
    const redirect = session.userType === 'worker' ? 'pages/worker-dashboard.html' : 'pages/client-dashboard.html';
    window.location.href = redirect;
    return;
  }

  /* ── Hero CTA Handlers ── */
  btnLookingForWork.addEventListener('click', () => startAuth('worker'));
  btnNeedToHire.addEventListener('click', () => startAuth('client'));

  // Allow direct open to login flow from links like index.html#login or index.html?login=1
  const url = new URL(window.location.href);
  if (url.hash === '#login' || url.searchParams.get('login') === '1') {
    openLoginOnly();
  }

  function startAuth(type) {
    selectedUserType = type;
    heroSection.style.display = 'none';
    authSection.classList.add('active');
    document.body.classList.add('auth-active');
    authTitle.textContent = type === 'worker' ? 'Worker Account' : 'Client Account';
    switchTab('login');
    updateRegisterForm();
  }

  function openLoginOnly() {
    selectedUserType = null;
    heroSection.style.display = 'none';
    authSection.classList.add('active');
    document.body.classList.add('auth-active');
    authTitle.textContent = 'Login To Your Account';
    switchTab('login');
  }

  /* ── Back Button ── */
  authBackBtn.addEventListener('click', () => {
    authSection.classList.remove('active');
    document.body.classList.remove('auth-active');
    heroSection.style.display = '';
    clearAllErrors();
  });

  /* ── Tab Switching ── */
  authTabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  function switchTab(tabName) {
    if (tabName === 'register' && !selectedUserType) {
      selectedUserType = 'client';
      authTitle.textContent = 'Client Account';
      updateRegisterForm();
    }
    authTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    loginPanel.classList.toggle('active', tabName === 'login');
    registerPanel.classList.toggle('active', tabName === 'register');
    clearAllErrors();
  }

  function updateRegisterForm() {
    if (selectedUserType === 'worker') {
      registerFormWorker.style.display = 'block';
      registerFormClient.style.display = 'none';
    } else {
      registerFormWorker.style.display = 'none';
      registerFormClient.style.display = 'block';
    }
  }

  /* ── Validation Helpers ── */
  function showError(input, msg) {
    input.classList.add('error');
    const errEl = (input.closest('.form-group') || input.parentElement).querySelector('.form-error');
    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.add('visible');
    }
  }

  function clearError(input) {
    input.classList.remove('error');
    const errEl = (input.closest('.form-group') || input.parentElement).querySelector('.form-error');
    if (errEl) errEl.classList.remove('visible');
  }

  function clearAllErrors() {
    document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(i => clearError(i));
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /* ── Real-time Validation ── */
  document.querySelectorAll('#auth-section .form-input, #auth-section .form-select, #auth-section .form-textarea').forEach(input => {
    input.addEventListener('input', () => clearError(input));
    input.addEventListener('change', () => clearError(input));
  });

  /* ── Character Counter for Bio ── */
  const bioTextarea = document.getElementById('reg-worker-bio');
  const bioCounter = document.getElementById('bio-char-counter');
  if (bioTextarea && bioCounter) {
    bioTextarea.addEventListener('input', () => {
      const len = bioTextarea.value.length;
      bioCounter.textContent = `${len}/300`;
      bioCounter.classList.toggle('warn', len > 300);
    });
  }

  /* ── Profile Picture Preview ── */
  function setupFileInput(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input) return;
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        showToast('Image must be under 2MB', 'error');
        input.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (preview) {
          preview.src = ev.target.result;
          preview.style.display = 'block';
        }
      };
      reader.readAsDataURL(file);
    });
  }

  setupFileInput('reg-worker-picture', 'reg-worker-pic-preview');
  setupFileInput('reg-client-picture', 'reg-client-pic-preview');

  /* ── Login Form ── */
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    clearAllErrors();

    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    const email = emailInput.value.trim();
    const password = passInput.value;
    let valid = true;

    if (!email) { showError(emailInput, 'Email is required'); valid = false; }
    else if (!validateEmail(email)) { showError(emailInput, 'Enter a valid email'); valid = false; }
    if (!password) { showError(passInput, 'Password is required'); valid = false; }

    if (!valid) return;

    // Show loading
    const btn = loginForm.querySelector('.btn');
    btn.classList.add('loading');

    setTimeout(() => {
      btn.classList.remove('loading');

      const user = getUserByEmail(email);
      if (!user || user.password !== password) {
        showToast('Invalid email or password', 'error');
        return;
      }
      if (selectedUserType && user.type !== selectedUserType) {
        showToast(`This account is registered as a ${user.type}. Please use the correct login type.`, 'error');
        return;
      }

      if (!selectedUserType) {
        selectedUserType = user.type;
      }

      saveSession({ userId: user.id, userType: user.type });
      showToast('Login successful! Redirecting...', 'success');
      setTimeout(() => {
        document.body.classList.add('page-fade-out');
        setTimeout(() => { window.location.href = user.type === 'worker' ? 'pages/worker-dashboard.html' : 'pages/client-dashboard.html'; }, 280);
      }, 400);
    }, 500);
  });

  /* ── Worker Registration ── */
  registerFormWorker.addEventListener('submit', (e) => {
    e.preventDefault();
    clearAllErrors();

    const fields = {
      name: document.getElementById('reg-worker-name'),
      email: document.getElementById('reg-worker-email'),
      password: document.getElementById('reg-worker-password'),
      phone: document.getElementById('reg-worker-phone'),
      category: document.getElementById('reg-worker-category'),
      experience: document.getElementById('reg-worker-experience'),
      city: document.getElementById('reg-worker-city'),
      bio: document.getElementById('reg-worker-bio'),
      picture: document.getElementById('reg-worker-picture')
    };

    let valid = true;

    if (!fields.name.value.trim()) { showError(fields.name, 'Name is required'); valid = false; }
    if (!fields.email.value.trim()) { showError(fields.email, 'Email is required'); valid = false; }
    else if (!validateEmail(fields.email.value.trim())) { showError(fields.email, 'Enter a valid email'); valid = false; }
    if (!fields.password.value || fields.password.value.length < 6) { showError(fields.password, 'Password must be at least 6 characters'); valid = false; }
    if (!fields.phone.value.trim()) { showError(fields.phone, 'Phone is required'); valid = false; }
    if (!fields.category.value) { showError(fields.category, 'Select a category'); valid = false; }
    if (!fields.city.value.trim()) { showError(fields.city, 'City is required'); valid = false; }
    if (fields.bio.value.length > 300) { showError(fields.bio, 'Bio must be under 300 characters'); valid = false; }

    if (!valid) return;

    const btn = registerFormWorker.querySelector('.btn');
    btn.classList.add('loading');

    // Get profile picture base64
    const picPreview = document.getElementById('reg-worker-pic-preview');
    const profilePicture = picPreview && picPreview.style.display !== 'none' ? picPreview.src : null;

    setTimeout(() => {
      btn.classList.remove('loading');

      const result = createUser({
        type: 'worker',
        name: fields.name.value.trim(),
        email: fields.email.value.trim(),
        password: fields.password.value,
        phone: fields.phone.value.trim(),
        category: fields.category.value,
        experience: fields.experience.value,
        city: fields.city.value.trim(),
        bio: fields.bio.value.trim(),
        profilePicture: profilePicture,
        paymentInfo: {
          esewa: (document.getElementById('reg-worker-pay-esewa') || {}).value?.trim() || '',
          khalti: (document.getElementById('reg-worker-pay-khalti') || {}).value?.trim() || '',
          bankName: (document.getElementById('reg-worker-pay-bank-name') || {}).value?.trim() || '',
          bankAccount: (document.getElementById('reg-worker-pay-bank-account') || {}).value?.trim() || ''
        }
      });

      if (!result.success) {
        showToast(result.error, 'error');
        return;
      }

      saveSession({ userId: result.user.id, userType: 'worker' });
      showToast('Account created! Redirecting...', 'success');
      // Wait for Firestore write to finish before navigating (avoids data loss)
      const workerSync = window._pendingFirestoreSync || Promise.resolve();
      Promise.race([workerSync, new Promise(r => setTimeout(r, 4000))]).then(() => {
        document.body.classList.add('page-fade-out');
        setTimeout(() => { window.location.href = 'pages/worker-dashboard.html'; }, 280);
      });
    }, 500);
  });

  /* ── Client Registration ── */
  registerFormClient.addEventListener('submit', (e) => {
    e.preventDefault();
    clearAllErrors();

    const fields = {
      name: document.getElementById('reg-client-name'),
      email: document.getElementById('reg-client-email'),
      password: document.getElementById('reg-client-password'),
      phone: document.getElementById('reg-client-phone'),
      city: document.getElementById('reg-client-city'),
      picture: document.getElementById('reg-client-picture')
    };

    let valid = true;

    if (!fields.name.value.trim()) { showError(fields.name, 'Name is required'); valid = false; }
    if (!fields.email.value.trim()) { showError(fields.email, 'Email is required'); valid = false; }
    else if (!validateEmail(fields.email.value.trim())) { showError(fields.email, 'Enter a valid email'); valid = false; }
    if (!fields.password.value || fields.password.value.length < 6) { showError(fields.password, 'Password must be at least 6 characters'); valid = false; }
    if (!fields.phone.value.trim()) { showError(fields.phone, 'Phone is required'); valid = false; }
    if (!fields.city.value.trim()) { showError(fields.city, 'City is required'); valid = false; }

    if (!valid) return;

    const btn = registerFormClient.querySelector('.btn');
    btn.classList.add('loading');

    const picPreview = document.getElementById('reg-client-pic-preview');
    const profilePicture = picPreview && picPreview.style.display !== 'none' ? picPreview.src : null;

    setTimeout(() => {
      btn.classList.remove('loading');

      const result = createUser({
        type: 'client',
        name: fields.name.value.trim(),
        email: fields.email.value.trim(),
        password: fields.password.value,
        phone: fields.phone.value.trim(),
        city: fields.city.value.trim(),
        profilePicture: profilePicture
      });

      if (!result.success) {
        showToast(result.error, 'error');
        return;
      }

      saveSession({ userId: result.user.id, userType: 'client' });
      showToast('Account created! Redirecting...', 'success');
      // Wait for Firestore write to finish before navigating (avoids data loss)
      const clientSync = window._pendingFirestoreSync || Promise.resolve();
      Promise.race([clientSync, new Promise(r => setTimeout(r, 4000))]).then(() => {
        document.body.classList.add('page-fade-out');
        setTimeout(() => { window.location.href = 'pages/client-dashboard.html'; }, 280);
      });
    }, 500);
  });

})();
