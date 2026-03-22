/* ========================================
   काम Khoj.com — Admin Data Layer
   Reads from in-memory cache (loaded by firebase-init.js).
   Writes sync back to Firestore in the background.
   Admin sessions remain in localStorage.
   ======================================== */

const ADMIN_KEYS = {
  session: 'wfc_admin_session',
  activity: 'wfc_admin_activity'
};

/* ── Admin Session ── */
function getAdminSession() {
  const raw = localStorage.getItem(ADMIN_KEYS.session);
  return raw ? JSON.parse(raw) : null;
}
function saveAdminSession(session) {
  localStorage.setItem(ADMIN_KEYS.session, JSON.stringify(session));
}
function clearAdminSession() {
  localStorage.removeItem(ADMIN_KEYS.session);
}
function requireAdminAuth() {
  if (!getAdminSession()) {
    window.location.replace('admin-login.html');
    return false;
  }
  return true;
}

/* ── Users CRUD (reads from cache, writes to localStorage + Firestore) ── */
function adminGetUsers() {
  return window._wfcUsersCache || [];
}
// adminSaveUsers kept for bulk ops (review management, etc.)
function adminSaveUsers(users) {
  window._wfcUsersCache = [...users];
  localStorage.setItem('wfc_users', JSON.stringify(users));
  const { doc, setDoc } = window._fs;
  Promise.all(users.map(u => setDoc(doc(window._db, 'users', u.id), JSON.parse(JSON.stringify(u)))))
    .then(() => console.log('Admin Firestore bulk sync OK:', users.length))
    .catch(e => console.error('Admin Firestore bulk sync error:', e));
}
function adminGetUserById(id) {
  return adminGetUsers().find(u => u.id === id) || null;
}
function adminGetWorkers() {
  return adminGetUsers().filter(u => u.type === 'worker');
}
function adminGetClients() {
  return adminGetUsers().filter(u => u.type === 'client');
}

/* ── Targeted single-doc Firestore write helper ── */
function _adminWriteUser(user) {
  const { doc, setDoc } = window._fs;
  return setDoc(doc(window._db, 'users', user.id), JSON.parse(JSON.stringify(user)))
    .then(() => console.log('Firestore write OK:', user.id))
    .catch(e => console.error('Firestore write error:', e));
}
function _adminDeleteUserDoc(id) {
  const { doc, deleteDoc } = window._fs;
  return deleteDoc(doc(window._db, 'users', id))
    .then(() => console.log('Firestore delete OK:', id))
    .catch(e => console.error('Firestore delete error:', e));
}

/* ── Admin Create User ── */
function adminCreateUser(userData) {
  const users = adminGetUsers();
  if (users.some(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
    return { success: false, error: 'An account with this email already exists.' };
  }
  const id = 'xxxx-xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
  const user = {
    id,
    type: userData.type,
    name: userData.name,
    email: userData.email,
    password: userData.password || 'default123',
    phone: userData.phone || '',
    city: userData.city || '',
    profilePicture: userData.profilePicture || null,
    company: userData.company || '',
    createdAt: new Date().toISOString(),
    ...(userData.type === 'worker' ? {
      category: userData.category || '',
      experience: Number(userData.experience) || 0,
      bio: userData.bio || '',
      availability: userData.availability !== undefined ? userData.availability : true,
      worksCompleted: 0,
      ratings: []
    } : {})
  };
  users.push(user);
  window._wfcUsersCache = [...users];
  localStorage.setItem('wfc_users', JSON.stringify(users));
  _adminWriteUser(user); // targeted single-doc write
  return { success: true, user };
}

/* ── Admin Update User — targeted single-doc write ── */
function adminUpdateUser(id, updates) {
  const users = adminGetUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return false;
  users[idx] = { ...users[idx], ...updates };
  window._wfcUsersCache = [...users];
  localStorage.setItem('wfc_users', JSON.stringify(users));
  _adminWriteUser(users[idx]); // only write this one doc
  return true;
}

/* ── Admin Delete User — targeted single-doc delete, returns promise ── */
async function adminDeleteUser(id) {
  let users = adminGetUsers();
  const user = users.find(u => u.id === id);
  if (!user) return null;
  const affectedWorkerIds = [];
  users = users.filter(u => u.id !== id);
  if (user.type === 'client') {
    users.forEach(u => {
      if (u.type === 'worker' && u.ratings) {
        const before = u.ratings.length;
        u.ratings = u.ratings.filter(r => r.clientId !== id);
        if (u.ratings.length !== before) affectedWorkerIds.push(u.id);
      }
    });
  }
  window._wfcUsersCache = [...users];
  localStorage.setItem('wfc_users', JSON.stringify(users));
  // Await the Firestore deletes so caller knows when it's done
  await _adminDeleteUserDoc(id);
  await Promise.all(affectedWorkerIds.map(wid => {
    const w = users.find(u => u.id === wid);
    return w ? _adminWriteUser(w) : Promise.resolve();
  }));
  return user;
}

/* ── Admin Toggle Availability — targeted write ── */
function adminToggleAvailability(workerId, available) {
  const users = adminGetUsers();
  const idx = users.findIndex(u => u.id === workerId);
  if (idx === -1) return null;
  users[idx].availability = available;
  window._wfcUsersCache = [...users];
  localStorage.setItem('wfc_users', JSON.stringify(users));
  _adminWriteUser(users[idx]);
  return users[idx];
}

/* ── Admin Delete Review — targeted write ── */
function adminDeleteReview(workerId, reviewIndex) {
  const users = adminGetUsers();
  const idx = users.findIndex(u => u.id === workerId);
  if (idx === -1 || !users[idx].ratings) return null;
  const removed = users[idx].ratings.splice(reviewIndex, 1)[0];
  window._wfcUsersCache = [...users];
  localStorage.setItem('wfc_users', JSON.stringify(users));
  _adminWriteUser(users[idx]);
  return removed;
}

/* ── Admin Flag/Unflag Review — targeted write ── */
function adminToggleReviewFlag(workerId, reviewIndex) {
  const users = adminGetUsers();
  const idx = users.findIndex(u => u.id === workerId);
  if (idx === -1 || !users[idx].ratings || !users[idx].ratings[reviewIndex]) return null;
  const r = users[idx].ratings[reviewIndex];
  r.flagged = !r.flagged;
  window._wfcUsersCache = [...users];
  localStorage.setItem('wfc_users', JSON.stringify(users));
  _adminWriteUser(users[idx]);
  return r;
}

/* ── Rating Helpers ── */
function adminGetAverageRating(worker) {
  if (!worker.ratings || worker.ratings.length === 0) return 0;
  const sum = worker.ratings.reduce((a, r) => a + r.stars, 0);
  return Math.round((sum / worker.ratings.length) * 10) / 10;
}
function adminGetAllReviews() {
  const workers = adminGetWorkers();
  const reviews = [];
  workers.forEach(w => {
    if (w.ratings) {
      w.ratings.forEach((r, i) => {
        reviews.push({ ...r, workerId: w.id, workerName: w.name, workerCategory: w.category, workerPicture: w.profilePicture, reviewIndex: i });
      });
    }
  });
  return reviews;
}
function adminGetFlaggedCount() {
  return adminGetAllReviews().filter(r => r.flagged).length;
}

/* ═══════════════════════════════════════
   ADMIN PAYMENT MANAGEMENT
   ═══════════════════════════════════════ */

/* ── Assignments CRUD for admin ── */
function adminGetAssignments() {
  return window._wfcAssignmentsCache || [];
}

function adminGetAssignmentById(id) {
  return adminGetAssignments().find(a => a.id === id) || null;
}

function adminUpdateAssignment(id, updates) {
  const assignments = adminGetAssignments();
  const idx = assignments.findIndex(a => a.id === id);
  if (idx === -1) return false;
  assignments[idx] = { ...assignments[idx], ...updates };
  window._wfcAssignmentsCache = [...assignments];
  localStorage.setItem('wfc_assignments', JSON.stringify(assignments));
  // Write single assignment doc
  const { doc, setDoc } = window._fs;
  setDoc(doc(window._db, 'assignments', id), JSON.parse(JSON.stringify(assignments[idx])))
    .then(() => console.log('Admin assignment write OK:', id))
    .catch(e => console.error('Admin assignment write error:', e));
  return true;
}

/* ── Get all payments (assignments with payment activity) ── */
function adminGetPayments() {
  return adminGetAssignments().filter(a => a.paymentScreenshot || a.paymentStatus);
}

/* ── Payment Settings (admin can manage QR codes) ── */
function adminGetPaymentSettings() {
  return window._wfcPaymentSettingsCache || {
    esewaQR: '', khaltiQR: '', bankQR: '',
    bankAccountNumber: '', bankName: '',
    esewaName: '', khaltiName: ''
  };
}

function adminSavePaymentSettings(settings) {
  window._wfcPaymentSettingsCache = { ...settings };
  localStorage.setItem('wfc_payment_settings', JSON.stringify(settings));
  const { doc, setDoc } = window._fs;
  setDoc(doc(window._db, 'config', 'payment_settings'), settings)
    .then(() => console.log('Admin payment settings sync OK'))
    .catch(e => console.error('Admin payment settings sync error:', e));
}

/* ── Site Settings (brand/about/contact/founders) ── */
function adminGetSiteSettings() {
  if (typeof getSiteSettings === 'function') return getSiteSettings();
  return window._wfcSiteSettingsCache || {
    brand: { nepali: 'काम', latin: 'Khoj.com' },
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
}

function adminSaveSiteSettings(settings) {
  if (typeof saveSiteSettings === 'function') {
    saveSiteSettings(settings);
    return;
  }
  window._wfcSiteSettingsCache = { ...settings };
  localStorage.setItem('wfc_site_settings', JSON.stringify(settings));
  const { doc, setDoc } = window._fs;
  setDoc(doc(window._db, 'config', 'site_settings'), settings)
    .then(() => console.log('Admin site settings sync OK'))
    .catch(e => console.error('Admin site settings sync error:', e));
}

/* ── Get workers with payment info ── */
function adminGetWorkersWithPaymentInfo() {
  return adminGetWorkers().filter(w => w.paymentInfo &&
    (w.paymentInfo.esewa || w.paymentInfo.khalti || w.paymentInfo.bankAccount));
}

/* ── Activity Log (Firestore + localStorage write-through) ── */
function getAdminActivity() {
  return window._wfcActivityCache || [];
}
function logAdminActivity(type, message) {
  const activities = getAdminActivity();
  activities.unshift({ type, message, timestamp: new Date().toISOString() });
  if (activities.length > 50) activities.length = 50;
  window._wfcActivityCache = [...activities];
  localStorage.setItem('wfc_admin_activity', JSON.stringify(activities));
  _syncActivityToFirestore(activities);
}
async function _syncActivityToFirestore(activities) {
  const { doc, setDoc } = window._fs;
  try {
    await setDoc(doc(window._db, 'config', 'admin_activity'), { activities });
  } catch (e) {
    console.error('Activity sync error:', e);
  }
}

/* ── Avatar Helpers ── */
function adminGetInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function adminNameToColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#F4A820','#1E90FF','#22C55E','#A855F7','#EC4899','#D97706','#818CF8','#EF4444'];
  return colors[Math.abs(hash) % colors.length];
}
function adminGenerateAvatarSVG(name, size = 80) {
  const initials = adminGetInitials(name);
  const color = adminNameToColor(name);
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${size/2}" fill="${color}"/><text x="50%" y="50%" dy=".1em" fill="#0D0D0D" font-family="sans-serif" font-size="${size*0.38}" font-weight="700" text-anchor="middle" dominant-baseline="central">${initials}</text></svg>`)}`;
}
function adminGetAvatarSrc(user) {
  return user.profilePicture || adminGenerateAvatarSVG(user.name);
}

/* ── Category Map ── */
const ADMIN_CATEGORY_MAP = {
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
const ADMIN_CATEGORIES = Object.keys(ADMIN_CATEGORY_MAP);

function adminGetCategoryBadgeClass(category) {
  const entry = ADMIN_CATEGORY_MAP[category];
  return entry ? `badge badge-category ${entry.badge}` : 'badge badge-category badge-other';
}

/* ── Date / Time Helpers ── */
function adminFormatDate(isoString) {
  const d = new Date(isoString);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function adminRelativeTime(isoString) {
  const now = Date.now();
  const diff = now - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return adminFormatDate(isoString);
}

/* ── Stars Renderer ── */
function adminRenderStars(rating, max = 5) {
  let html = '<span class="star-rating">';
  for (let i = 1; i <= max; i++) {
    html += `<span class="star ${i <= Math.round(rating) ? 'filled' : ''}">★</span>`;
  }
  html += '</span>';
  return html;
}

/* ── Export Data ── */
function adminExportData() {
  const users = adminGetUsers();
  const blob = new Blob([JSON.stringify(users, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kaam-khoj-export-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
