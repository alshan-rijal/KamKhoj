/* ========================================
   WorkForce Connect — Firebase Initialization
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

// ── ONE-TIME DATA WIPE — flag stored in Firestore so it's reliable across all browsers ──
try {
  const wipeFlag = await getDoc(doc(db, 'config', 'wipe_v3'));
  if (!wipeFlag.exists()) {
    console.log('Running one-time Firestore wipe...');
    const wipeSnap = await getDocs(collection(db, 'users'));
    await Promise.all(wipeSnap.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(doc(db, 'config', 'admin_activity'));
    await setDoc(doc(db, 'config', 'wipe_v3'), { done: true, at: new Date().toISOString() });
    console.log('Wipe complete.');
  }
} catch (e) {
  console.error('Wipe check failed:', e);
}
// Always clear stale localStorage user/session data on load
localStorage.removeItem('wfc_cleared_v1');
localStorage.removeItem('wfc_cleared_v2');
localStorage.removeItem('wfc_cleared_v3');

// ── Load users — Firestore is the ONLY source of truth ──
// If Firestore is empty, cache starts empty (no localStorage push-back).
// Only fall back to localStorage if Firestore is genuinely unreachable (network error).
let users = [];
try {
  const usersSnapshot = await getDocs(collection(db, 'users'));
  usersSnapshot.forEach(d => users.push(d.data()));
  // Keep localStorage in sync for instant reads on page reload
  localStorage.setItem('wfc_users', JSON.stringify(users));
  console.log('Loaded', users.length, 'users from Firestore.');
} catch (e) {
  // Genuine network failure — use localStorage as read-only emergency fallback
  console.warn('Firestore unreachable, using localStorage as emergency fallback:', e);
  const local = localStorage.getItem('wfc_users');
  if (local) users = JSON.parse(local);
}
window._wfcUsersCache = users;

// ── Load assignments — Firestore is source of truth ──
let assignments = [];
try {
  const assignSnap = await getDocs(collection(db, 'assignments'));
  assignSnap.forEach(d => assignments.push(d.data()));
  localStorage.setItem('wfc_assignments', JSON.stringify(assignments));
  console.log('Loaded', assignments.length, 'assignments from Firestore.');
} catch (e) {
  console.warn('Firestore assignments read failed, using localStorage:', e);
  const localAssign = localStorage.getItem('wfc_assignments');
  if (localAssign) assignments = JSON.parse(localAssign);
}
window._wfcAssignmentsCache = assignments;

// ── Load payment settings from Firestore ──
let paymentSettings = { esewaQR: '', khaltiQR: '', bankQR: '', bankAccountNumber: '', bankName: '', esewaName: '', khaltiName: '' };
try {
  const payDoc = await getDoc(doc(db, 'config', 'payment_settings'));
  if (payDoc.exists()) {
    paymentSettings = payDoc.data();
    localStorage.setItem('wfc_payment_settings', JSON.stringify(paymentSettings));
  }
} catch (e) {
  console.warn('Payment settings read failed, using localStorage:', e);
  const localPay = localStorage.getItem('wfc_payment_settings');
  if (localPay) paymentSettings = JSON.parse(localPay);
}
window._wfcPaymentSettingsCache = paymentSettings;

// ── Load admin activity — Firestore is source of truth ──
let activities = [];
try {
  const actDoc = await getDoc(doc(db, 'config', 'admin_activity'));
  if (actDoc.exists()) {
    activities = actDoc.data().activities || [];
    localStorage.setItem('wfc_admin_activity', JSON.stringify(activities));
  }
  // If Firestore has no activity doc, cache starts empty — that's correct after wipe
} catch (e) {
  // Network failure — emergency fallback
  console.warn('Firestore activity read failed, using localStorage:', e);
  const localAct = localStorage.getItem('wfc_admin_activity');
  if (localAct) activities = JSON.parse(localAct);
}
window._wfcActivityCache = activities;

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
