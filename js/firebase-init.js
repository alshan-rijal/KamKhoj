/* ========================================
   काम Khoj.com — Firebase Initialization
   This module initializes Firebase and loads
   data from Firestore into memory cache.
   ======================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, getDoc }
  from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDECdLqZ6cXZPLH0GnXgSQdjRk0pD49dHE",
  authDomain: "project-daf66.firebaseapp.com",
  projectId: "project-daf66",
  storageBucket: "project-daf66.firebasestorage.app",
  messagingSenderId: "584622787001",
  appId: "1:584622787001:web:aef883db276354d1054e68",
  measurementId: "G-517EYWY52H"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ── Expose Firestore helpers globally FIRST so writes work even if load fails ──
window._db = db;
window._fs = { collection, getDocs, doc, setDoc, deleteDoc, getDoc };

// ── Fast local cache warm-up (instant first paint) ──
function readLocalJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_e) {
    return fallback;
  }
}

let users = readLocalJson('wfc_users', []);
let assignments = readLocalJson('wfc_assignments', []);
let paymentSettings = readLocalJson('wfc_payment_settings', {
  esewaQR: '', khaltiQR: '', bankQR: '', bankAccountNumber: '', bankName: '', esewaName: '', khaltiName: ''
});
let activities = readLocalJson('wfc_admin_activity', []);
let contactQueries = readLocalJson('wfc_contact_queries', []);

window._wfcUsersCache = users;
window._wfcAssignmentsCache = assignments;
window._wfcPaymentSettingsCache = paymentSettings;
window._wfcActivityCache = activities;
window._wfcContactQueriesCache = contactQueries;

// ── Firestore refresh (parallel to reduce load latency) ──
const [usersRes, assignmentsRes, payRes, activityRes, contactRes] = await Promise.allSettled([
  getDocs(collection(db, 'users')),
  getDocs(collection(db, 'assignments')),
  getDoc(doc(db, 'config', 'payment_settings')),
  getDoc(doc(db, 'config', 'admin_activity')),
  getDoc(doc(db, 'config', 'contact_queries'))
]);

if (usersRes.status === 'fulfilled') {
  users = usersRes.value.docs.map((d) => d.data());
  window._wfcUsersCache = users;
  localStorage.setItem('wfc_users', JSON.stringify(users));
}

if (assignmentsRes.status === 'fulfilled') {
  assignments = assignmentsRes.value.docs.map((d) => d.data());
  window._wfcAssignmentsCache = assignments;
  localStorage.setItem('wfc_assignments', JSON.stringify(assignments));
}

if (payRes.status === 'fulfilled' && payRes.value.exists()) {
  paymentSettings = payRes.value.data();
  window._wfcPaymentSettingsCache = paymentSettings;
  localStorage.setItem('wfc_payment_settings', JSON.stringify(paymentSettings));
}

if (activityRes.status === 'fulfilled' && activityRes.value.exists()) {
  activities = activityRes.value.data().activities || [];
  window._wfcActivityCache = activities;
  localStorage.setItem('wfc_admin_activity', JSON.stringify(activities));
}

if (contactRes.status === 'fulfilled' && contactRes.value.exists()) {
  contactQueries = contactRes.value.data().queries || [];
  window._wfcContactQueriesCache = contactQueries;
  localStorage.setItem('wfc_contact_queries', JSON.stringify(contactQueries));
}

// ── Script loader utility ──
export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
}
