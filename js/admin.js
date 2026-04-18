/* ========================================
   काम Khoj.com — Admin Core Logic (admin.js)
   Shared utilities for all admin pages.
   ======================================== */

const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'vac11g',
  name: 'System Administrator',
  avatar: null
};

/* ── Progress Bar ── */
function showProgressBar() {
  const existing = document.querySelector('.page-progress');
  if (existing) existing.remove();
  const bar = document.createElement('div');
  bar.className = 'page-progress';
  document.body.appendChild(bar);
  bar.addEventListener('animationend', () => bar.remove());
}

/* ── Toast System ── */
function adminInitToastContainer() {
  if (!document.querySelector('.toast-container')) {
    const c = document.createElement('div');
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
}
let toastTimers = new WeakMap();
function adminShowToast(message, type = 'info') {
  adminInitToastContainer();
  const container = document.querySelector('.toast-container');
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${escHtml(message)}</span><div class="toast-progress"></div>`;
  container.appendChild(toast);
  const timer = setTimeout(() => dismissToast(toast), 4000);
  toastTimers.set(toast, timer);
  toast.addEventListener('mouseenter', () => {
    clearTimeout(toastTimers.get(toast));
    const prog = toast.querySelector('.toast-progress');
    if (prog) prog.style.animationPlayState = 'paused';
  });
  toast.addEventListener('mouseleave', () => {
    const newTimer = setTimeout(() => dismissToast(toast), 2000);
    toastTimers.set(toast, newTimer);
    const prog = toast.querySelector('.toast-progress');
    if (prog) prog.style.animationPlayState = 'running';
  });
}
function dismissToast(toast) {
  toast.classList.add('removing');
  toast.addEventListener('animationend', () => toast.remove());
}

/* ── Ripple Effect ── */
function addRipple(e) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}
function initRippleButtons() {
  document.querySelectorAll('.adm-btn-primary, .adm-btn-info, .adm-btn-success').forEach(btn => {
    btn.addEventListener('click', addRipple);
  });
}

/* ── Count-Up Animation ── */
function adminAnimateCountUp(element, target, duration = 1500, decimals = 0) {
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = target * eased;
    element.textContent = decimals > 0 ? current.toFixed(decimals) : Math.round(current).toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ── Clock ── */
function initClock() {
  const el = document.getElementById('topbar-clock');
  if (!el) return;
  function update() {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  update();
  setInterval(update, 1000);
}

/* ── Sidebar Toggle (mobile) ── */
function initSidebar() {
  const sidebar = document.querySelector('.admin-sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  const hamburger = document.getElementById('adm-hamburger');
  if (!sidebar || !hamburger) return;

  hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
  });
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }
}

/* ── Profile Dropdown ── */
function initTopbarDropdown() {
  const avatar = document.getElementById('topbar-avatar');
  const dropdown = document.getElementById('topbar-dropdown');
  if (!avatar || !dropdown) return;
  avatar.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('active');
  });
  document.addEventListener('click', () => dropdown.classList.remove('active'));
}

/* ── Notification Bell ── */
function updateBellBadge() {
  const el = document.getElementById('bell-badge');
  if (!el) return;
  const count = adminGetFlaggedCount();
  el.textContent = count;
  el.style.display = count > 0 ? '' : 'none';
}

/* ── Admin Logout ── */
function adminLogout() {
  document.body.style.transition = 'opacity 0.5s';
  document.body.style.opacity = '0';
  setTimeout(() => {
    clearAdminSession();
    window.location.href = 'admin-login.html';
  }, 500);
}

/* ── Escape HTML ── */
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ── File Input → Base64 ── */
function fileToBase64(input, callback) {
  const file = input.files[0];
  if (!file) { callback(null); return; }
  if (file.size > 2 * 1024 * 1024) {
    adminShowToast('Image must be under 2MB', 'error');
    input.value = '';
    callback(null);
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => callback(e.target.result);
  reader.readAsDataURL(file);
}

/* ── Modal Helpers ── */
function openModal(id) {
  document.getElementById(id).classList.add('active');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

/* ── Init Common ── */
function initAdminCommon() {
  showProgressBar();
  initClock();
  initSidebar();
  initTopbarDropdown();
  updateBellBadge();
  initRippleButtons();

  // Theme toggle
  var themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.textContent = localStorage.getItem('wfc_theme') === 'light' ? '☀️' : '🌙';
    themeBtn.addEventListener('click', function() {
      var light = document.documentElement.getAttribute('data-theme') !== 'light';
      light ? document.documentElement.setAttribute('data-theme', 'light')
            : document.documentElement.removeAttribute('data-theme');
      themeBtn.textContent = light ? '☀️' : '🌙';
      localStorage.setItem('wfc_theme', light ? 'light' : 'dark');
    });
  }

  // Logout buttons
  document.querySelectorAll('[data-admin-logout]').forEach(btn => {
    btn.addEventListener('click', adminLogout);
  });
}

/* ── Category Options HTML ── */
function categoryOptionsHtml(selected) {
  return ADMIN_CATEGORIES.map(c =>
    `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`
  ).join('');
}

/* ── Generate Sidebar HTML ── */
function adminSidebarHTML(activePage) {
  const pages = [
    { id: 'dashboard', icon: '◈', label: 'Dashboard', href: 'admin-dashboard.html' },
    { id: 'workers', icon: '◈', label: 'Workers', href: 'admin-workers.html' },
    { id: 'clients', icon: '◈', label: 'Clients', href: 'admin-clients.html' },
    { id: 'messages', icon: '◈', label: 'Messages', href: 'admin-messages.html' },
    { id: 'reviews', icon: '◈', label: 'Reviews', href: 'admin-reviews.html' },
    { id: 'payments', icon: '◈', label: 'Payments', href: 'admin-payments.html' },
  ];
  return `
    <aside class="admin-sidebar">
      <div class="sidebar-top">
        <div class="sidebar-label">Control Center</div>
        <a href="admin-dashboard.html" class="sidebar-brand">
          <span class="brand-text">
            <span class="brand-nepali">काम</span>
            <span class="brand-latin">Khoj.com</span>
          </span>
        </a>
      </div>
      <div class="sidebar-divider"></div>
      <nav class="sidebar-nav">
        <div class="sidebar-nav-title">Main Navigation</div>
        ${pages.map(p => `
          <a href="${p.href}" class="sidebar-nav-item ${activePage === p.id ? 'active' : ''}">
            <span class="nav-icon">${p.icon}</span> ${p.label}
          </a>
        `).join('')}
        <div class="sidebar-divider"></div>
        <button class="sidebar-nav-item" data-admin-logout>
          <span class="nav-icon">🚪</span> Logout
        </button>
      </nav>
      <div class="sidebar-bottom">
        <div class="admin-avatar-sm">SA</div>
        <div class="sidebar-admin-info">
          <div class="sidebar-admin-name">System Admin</div>
          <span class="sidebar-admin-badge">Super Admin</span>
        </div>
      </div>
    </aside>
    <div class="sidebar-overlay"></div>
  `;
}

/* ── Generate Topbar HTML ── */
function adminTopbarHTML(title) {
  return `
    <header class="admin-topbar">
      <div class="topbar-left" style="display:flex;align-items:center;gap:12px;">
        <button class="adm-hamburger" id="adm-hamburger" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
        <div>
          <div class="topbar-eyebrow">Admin Workspace</div>
          <h1>${title}</h1>
        </div>
      </div>
      <div class="topbar-right">
        <span class="topbar-clock" id="topbar-clock"></span>
        <button class="theme-toggle-btn" id="theme-toggle-btn" aria-label="Toggle dark/light mode" title="Toggle dark/light mode" style="position:relative;bottom:auto;right:auto;width:38px;height:38px;font-size:1.1rem;box-shadow:none;border-radius:50%;flex-shrink:0;">🌙</button>
        <div style="position:relative;">
          <div class="topbar-avatar" id="topbar-avatar">SA</div>
          <div class="topbar-dropdown" id="topbar-dropdown">
            <button class="topbar-dropdown-item" onclick="window.location.href='admin-dashboard.html'">⚙️ Admin Settings</button>
            <button class="topbar-dropdown-item danger" data-admin-logout>🚪 Logout</button>
          </div>
        </div>
      </div>
    </header>
  `;
}
