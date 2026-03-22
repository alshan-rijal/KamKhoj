/* ========================================
   काम Khoj.com — Data Layer (data.js)
   Reads from in-memory cache (loaded by firebase-init.js).
   Writes sync back to Firestore in the background.
   Sessions remain in localStorage (client-side only).
   ======================================== */

const DATA_KEYS = {
  session: 'wfc_session'
};

const DEFAULT_SITE_SETTINGS = {
  brand: {
    nepali: 'काम',
    latin: 'Khoj.com'
  },
  about: {
    title: 'About काम Khoj.com',
    description: 'काम Khoj.com helps clients quickly discover trusted local workers and helps skilled workers find reliable job opportunities in their area.'
  },
  contact: {
    heading: 'Contact काम Khoj.com',
    email: 'hello@khoj.com',
    phone: '+977-9800000000',
    address: 'Putalisadak, Kathmandu, Nepal',
    supportHours: 'Sun-Fri, 9:00 AM - 6:00 PM'
  },
  founders: [
    {
      role: 'Founder',
      name: 'Aarav Sharma',
      title: 'Founder & Product Vision Lead',
      bio: 'Aarav leads platform strategy and focuses on building trustworthy hiring experiences for workers and clients.',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
      linkedin: 'https://www.linkedin.com/'
    },
    {
      role: 'Co-Founder',
      name: 'Saanvi Koirala',
      title: 'Co-Founder & Operations Lead',
      bio: 'Saanvi designs service operations and quality systems that keep the platform reliable across every city.',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80',
      linkedin: 'https://www.linkedin.com/'
    }
  ]
};

/* ── Category Color Map ── */
const CATEGORY_MAP = {
  'Construction Worker': { badge: 'badge-construction', color: '#F4A820' },
  'Housekeeper':         { badge: 'badge-housekeeper',  color: '#A855F7' },
  'Plumber':             { badge: 'badge-plumber',       color: '#1E90FF' },
  'Electrician':         { badge: 'badge-electrician',   color: '#FACC15' },
  'Gardener':            { badge: 'badge-gardener',      color: '#22C55E' },
  'Painter':             { badge: 'badge-painter',       color: '#EC4899' },
  'Carpenter':           { badge: 'badge-carpenter',     color: '#D97706' },
  'Security Guard':      { badge: 'badge-security',      color: '#9CA3AF' },
  'Driver':              { badge: 'badge-driver',        color: '#818CF8' },
  'Other':               { badge: 'badge-other',         color: '#9CA3AF' }
};

const CATEGORIES = Object.keys(CATEGORY_MAP);

/* ── UUID Generator ── */
function generateId() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

/* ── Image compression (keeps base64 under Firestore 1MB doc limit) ── */
function compressImage(dataUrl, maxWidth, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxWidth) {
        h = Math.round(h * maxWidth / w);
        w = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl); // fallback to original if decode fails
    img.src = dataUrl;
  });
}

/* ── Core Read/Write (Firestore + localStorage write-through) ── */
function getUsers() {
  return window._wfcUsersCache || [];
}

function saveUsers(users) {
  window._wfcUsersCache = [...users];
  // Instant localStorage write (fast reads on reload)
  localStorage.setItem('wfc_users', JSON.stringify(users));
  // Firestore sync — store the promise so callers can await it before redirecting
  window._pendingFirestoreSync = _syncUsersToFirestore(users);
}

async function _syncUsersToFirestore(users) {
  const { doc, setDoc } = window._fs;
  const db = window._db;
  try {
    // JSON round-trip strips undefined values (Firestore rejects them)
    await Promise.all(users.map(u => setDoc(doc(db, 'users', u.id), JSON.parse(JSON.stringify(u)))));
    console.log('Firestore sync OK:', users.length, 'users');
  } catch (e) {
    console.error('Firestore sync error:', e);
  }
}

function getSession() {
  const raw = localStorage.getItem(DATA_KEYS.session);
  return raw ? JSON.parse(raw) : null;
}

function saveSession(session) {
  localStorage.setItem(DATA_KEYS.session, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(DATA_KEYS.session);
}

/* ── User Queries ── */
function getUserById(id) {
  return getUsers().find(u => u.id === id) || null;
}

function getUserByEmail(email) {
  return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

function getWorkers() {
  return getUsers().filter(u => u.type === 'worker');
}

function getCurrentUser() {
  const session = getSession();
  if (!session) return null;
  return getUserById(session.userId);
}

/* ── User Mutations ── */
function createUser(userData) {
  const users = getUsers();
  if (users.some(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
    return { success: false, error: 'An account with this email already exists.' };
  }
  const user = {
    id: generateId(),
    type: userData.type,
    name: userData.name,
    email: userData.email,
    password: userData.password,
    phone: userData.phone,
    city: userData.city,
    profilePicture: userData.profilePicture || null,
    createdAt: new Date().toISOString(),
    ...(userData.type === 'worker' ? {
      category: userData.category,
      experience: Number(userData.experience) || 0,
      bio: userData.bio || '',
      availability: true,
      worksCompleted: 0,
      ratings: [],
      paymentInfo: userData.paymentInfo || { esewa: '', khalti: '', bankName: '', bankAccount: '' }
    } : {})
  };
  users.push(user);
  saveUsers(users);
  return { success: true, user };
}

function updateUser(id, updates) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return false;
  users[idx] = { ...users[idx], ...updates };
  saveUsers(users);
  return true;
}

function addRating(workerId, ratingObj) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === workerId);
  if (idx === -1) return false;
  users[idx].ratings.push(ratingObj);
  saveUsers(users);
  return true;
}

/* ── Rating Helpers ── */
function getAverageRating(worker) {
  if (!worker.ratings || worker.ratings.length === 0) return 0;
  const sum = worker.ratings.reduce((a, r) => a + r.stars, 0);
  return Math.round((sum / worker.ratings.length) * 10) / 10;
}

function hasClientReviewed(workerId, clientId) {
  const worker = getUserById(workerId);
  if (!worker || !worker.ratings) return false;
  return worker.ratings.some(r => r.clientId === clientId);
}

/* ── Avatar Generation ── */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function nameToColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#F4A820', '#1E90FF', '#22C55E', '#A855F7', '#EC4899', '#D97706', '#818CF8', '#EF4444'];
  return colors[Math.abs(hash) % colors.length];
}

function generateAvatarSVG(name, size = 80) {
  const initials = getInitials(name);
  const color = nameToColor(name);
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${size / 2}" fill="${color}"/>
      <text x="50%" y="50%" dy=".1em" fill="#0D0D0D" font-family="sans-serif" font-size="${size * 0.38}" font-weight="700" text-anchor="middle" dominant-baseline="central">${initials}</text>
    </svg>`
  )}`;
}

function getAvatarSrc(user) {
  return user.profilePicture || generateAvatarSVG(user.name);
}

/* ── Star Rendering ── */
function renderStars(rating, maxStars = 5) {
  let html = '<span class="star-rating">';
  for (let i = 1; i <= maxStars; i++) {
    html += `<span class="star ${i <= Math.round(rating) ? 'filled' : ''}">★</span>`;
  }
  html += '</span>';
  return html;
}

/* ── Date Formatting ── */
function formatDate(isoString) {
  const d = new Date(isoString);
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/* ── Toast System ── */
function initToastContainer() {
  if (!document.querySelector('.toast-container')) {
    const c = document.createElement('div');
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
}

function showToast(message, type = 'info') {
  initToastContainer();
  const container = document.querySelector('.toast-container');
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3000);
}

/* ── Category Badge Helper ── */
function getCategoryBadgeClass(category) {
  const entry = CATEGORY_MAP[category];
  return entry ? `badge badge-category ${entry.badge}` : 'badge badge-category badge-other';
}

/* ── Count-Up Animation ── */
function animateCountUp(element, target, duration = 1000, decimals = 0) {
  const start = 0;
  const startTime = performance.now();
  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = start + (target - start) * eased;
    element.textContent = decimals > 0 ? current.toFixed(decimals) : Math.round(current);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ── Auth Guards ── */
function getBasePath() {
  const scripts = document.querySelectorAll('script[src*="data.js"]');
  for (const s of scripts) {
    const src = s.getAttribute('src');
    const idx = src.indexOf('js/data.js');
    if (idx !== -1) return src.substring(0, idx);
  }
  return '';
}

function requireAuth(expectedType) {
  const session = getSession();
  if (!session || (expectedType && session.userType !== expectedType)) {
    window.location.href = getBasePath() + 'index.html';
    return null;
  }
  return session;
}

/* ═══════════════════════════════════════
   ASSIGNMENTS SYSTEM
   ═══════════════════════════════════════ */

function getAssignments() {
  return window._wfcAssignmentsCache || [];
}

function saveAssignments(assignments) {
  window._wfcAssignmentsCache = [...assignments];
  localStorage.setItem('wfc_assignments', JSON.stringify(assignments));
  _syncAssignmentsToFirestore(assignments);
}

async function _syncAssignmentsToFirestore(assignments) {
  const { doc, setDoc } = window._fs;
  const db = window._db;
  try {
    await Promise.all(assignments.map(a => setDoc(doc(db, 'assignments', a.id), JSON.parse(JSON.stringify(a)))));
    console.log('Assignments Firestore sync OK:', assignments.length);
  } catch (e) {
    console.error('Assignments Firestore sync error:', e);
  }
}

function _writeAssignment(assignment) {
  const { doc, setDoc } = window._fs;
  return setDoc(doc(window._db, 'assignments', assignment.id), JSON.parse(JSON.stringify(assignment)))
    .then(() => console.log('Assignment write OK:', assignment.id))
    .catch(e => console.error('Assignment write error:', e));
}

function createAssignment(data) {
  const assignments = getAssignments();
  const assignment = {
    id: generateId(),
    clientId: data.clientId,
    workerId: data.workerId,
    title: data.title,
    description: data.description || '',
    status: 'pending',           // pending → accepted/rejected/cancelled → not-started → ongoing → completed → confirmed
    rejectionReason: '',
    clientTimeEstimate: data.clientTimeEstimate || '',
    workerTimeEstimate: '',
    clientPriceEstimate: data.clientPriceEstimate || '',
    workerPriceEstimate: '',
    paymentMethod: '',
    paymentScreenshot: '',
    paymentStatus: '',
    paymentSubmittedAt: null,
    paymentVerifiedAt: null,
    workerPaymentStatus: '',
    workerPaidAt: null,
    createdAt: new Date().toISOString(),
    acceptedAt: null,
    completedAt: null,
    confirmedAt: null,
    reviewedAt: null
  };
  assignments.push(assignment);
  window._wfcAssignmentsCache = [...assignments];
  localStorage.setItem('wfc_assignments', JSON.stringify(assignments));
  _writeAssignment(assignment);
  return assignment;
}

function updateAssignment(id, updates) {
  const assignments = getAssignments();
  const idx = assignments.findIndex(a => a.id === id);
  if (idx === -1) return false;
  assignments[idx] = { ...assignments[idx], ...updates };
  window._wfcAssignmentsCache = [...assignments];
  localStorage.setItem('wfc_assignments', JSON.stringify(assignments));
  _writeAssignment(assignments[idx]);
  return true;
}

function getAssignmentById(id) {
  return getAssignments().find(a => a.id === id) || null;
}

function getAssignmentsByWorker(workerId) {
  return getAssignments().filter(a => a.workerId === workerId);
}

function getAssignmentsByClient(clientId) {
  return getAssignments().filter(a => a.clientId === clientId);
}

function getCompletedUnconfirmedByClient(clientId) {
  return getAssignments().filter(a => a.clientId === clientId && a.status === 'completed');
}

function getConfirmedUnreviewedByClient(clientId, workerId) {
  return getAssignments().filter(a =>
    a.clientId === clientId &&
    a.workerId === workerId &&
    a.status === 'confirmed' &&
    !a.reviewedAt
  );
}

/* ═══════════════════════════════════════
   PAYMENT SETTINGS
   ═══════════════════════════════════════ */

function getPaymentSettings() {
  return window._wfcPaymentSettingsCache || {
    esewaQR: '', khaltiQR: '', bankQR: '',
    bankAccountNumber: '', bankName: '',
    esewaName: '', khaltiName: ''
  };
}

function savePaymentSettings(settings) {
  window._wfcPaymentSettingsCache = { ...settings };
  localStorage.setItem('wfc_payment_settings', JSON.stringify(settings));
  _syncPaymentSettingsToFirestore(settings);
}

/* ═══════════════════════════════════════
   SITE SETTINGS (Brand/About/Contact)
   ═══════════════════════════════════════ */

function normalizeSiteSettings(settings) {
  const input = settings || {};
  const foundersInput = Array.isArray(input.founders) ? input.founders : [];
  return {
    brand: {
      nepali: input.brand?.nepali || input.brand?.hindi || DEFAULT_SITE_SETTINGS.brand.nepali,
      latin: input.brand?.latin || DEFAULT_SITE_SETTINGS.brand.latin
    },
    about: {
      title: input.about?.title || DEFAULT_SITE_SETTINGS.about.title,
      description: input.about?.description || DEFAULT_SITE_SETTINGS.about.description
    },
    contact: {
      heading: input.contact?.heading || DEFAULT_SITE_SETTINGS.contact.heading,
      email: input.contact?.email || DEFAULT_SITE_SETTINGS.contact.email,
      phone: input.contact?.phone || DEFAULT_SITE_SETTINGS.contact.phone,
      address: input.contact?.address || DEFAULT_SITE_SETTINGS.contact.address,
      supportHours: input.contact?.supportHours || DEFAULT_SITE_SETTINGS.contact.supportHours
    },
    founders: [0, 1].map((idx) => ({
      role: foundersInput[idx]?.role || DEFAULT_SITE_SETTINGS.founders[idx].role,
      name: foundersInput[idx]?.name || DEFAULT_SITE_SETTINGS.founders[idx].name,
      title: foundersInput[idx]?.title || DEFAULT_SITE_SETTINGS.founders[idx].title,
      bio: foundersInput[idx]?.bio || DEFAULT_SITE_SETTINGS.founders[idx].bio,
      image: foundersInput[idx]?.image || DEFAULT_SITE_SETTINGS.founders[idx].image,
      linkedin: foundersInput[idx]?.linkedin || DEFAULT_SITE_SETTINGS.founders[idx].linkedin
    }))
  };
}

function getSiteSettings() {
  return normalizeSiteSettings(window._wfcSiteSettingsCache || DEFAULT_SITE_SETTINGS);
}

function saveSiteSettings(settings) {
  const normalized = normalizeSiteSettings(settings);
  window._wfcSiteSettingsCache = { ...normalized };
  localStorage.setItem('wfc_site_settings', JSON.stringify(normalized));
  _syncSiteSettingsToFirestore(normalized);
}

async function _syncSiteSettingsToFirestore(settings) {
  const { doc, setDoc } = window._fs;
  try {
    await setDoc(doc(window._db, 'config', 'site_settings'), settings);
    console.log('Site settings Firestore sync OK');
  } catch (e) {
    console.error('Site settings sync error:', e);
  }
}

async function _syncPaymentSettingsToFirestore(settings) {
  const { doc, setDoc } = window._fs;
  try {
    await setDoc(doc(window._db, 'config', 'payment_settings'), settings);
    console.log('Payment settings Firestore sync OK');
  } catch (e) {
    console.error('Payment settings sync error:', e);
  }
}

/* ── Helper: Check if price/time are agreed ── */
function isPriceAgreed(task) {
  return !task.workerPriceEstimate || task.workerPriceEstimate === task.clientPriceEstimate;
}

function isTimeAgreed(task) {
  return !task.workerTimeEstimate || task.workerTimeEstimate === task.clientTimeEstimate;
}

function isReadyForPayment(task) {
  return ['not-started', 'accepted'].includes(task.status) &&
    !task.paymentStatus &&
    isPriceAgreed(task) &&
    isTimeAgreed(task);
}

function isPaymentVerified(task) {
  return task.paymentStatus === 'verified';
}

/* ── Get all assignments with payment screenshots (for admin) ── */
function getPaymentSubmissions() {
  return getAssignments().filter(a => a.paymentScreenshot || a.paymentStatus);
}

/* ── Seed Data (disabled — no demo data) ── */
function seedDataIfEmpty() {
  // No-op: demo data removed
}

// Run seed on load
seedDataIfEmpty();
