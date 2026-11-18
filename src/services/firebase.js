// Firebase Cloud Backend Configuration for Hotel PMS Pro
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import {
  initializeFirestore,
  getFirestore,
  memoryLocalCache
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: env.VITE_FIREBASE_APP_ID || "",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
export const isFirebaseAuthEnabled =
  isFirebaseConfigured && String(env.VITE_ENABLE_FIREBASE_AUTH || '').toLowerCase() === 'true';

if (!isFirebaseConfigured && typeof console !== 'undefined') {
  console.warn('[Firebase] Missing VITE_FIREBASE_* environment variables in .env. Running in local offline mode.');
}

// Initialize Firebase App only when environment credentials are provided
export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

// Clean up stale Firestore multi-tab state keys from localStorage that exceed the 5MB browser quota
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const keysToPurge = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('firestore_') || k.startsWith('firebase:'))) {
        keysToPurge.push(k);
      }
    }
    keysToPurge.forEach((k) => localStorage.removeItem(k));
  } catch (_) {}
}

// Initialize Cloud Firestore using memory cache to eliminate multi-tab IndexedDB lock contention
// and prevent localStorage quota exhaustion. The PMS maintains its own instant offline persistence
// in localStorage (hotel_astha_pms_v5), while Firestore operates purely as a live cloud synchronization engine.
let firestoreInstance = null;
if (app) {
  try {
    firestoreInstance = initializeFirestore(app, {
      localCache: memoryLocalCache()
    });
  } catch (e) {
    try {
      firestoreInstance = getFirestore(app);
    } catch (err) {
      console.warn('[Firebase] Firestore fallback initialization error:', err);
    }
  }
}
export const db = firestoreInstance;

// Initialize Firebase Auth only when explicitly enabled via VITE_ENABLE_FIREBASE_AUTH=true
// to prevent Firebase's hidden auth iframe from throwing 400 CONFIGURATION_NOT_FOUND
// when Authentication has not yet been activated in the Firebase Console.
let _authInstance = null;
export const getFirebaseAuth = () => {
  if (!isFirebaseAuthEnabled) return null;
  if (!_authInstance && app && typeof window !== 'undefined') {
    try {
      _authInstance = getAuth(app);
    } catch (e) {
      console.warn('Firebase Auth initialization deferred:', e);
    }
  }
  return _authInstance;
};

export const auth = new Proxy({}, {
  get(target, prop) {
    const instance = getFirebaseAuth();
    if (!instance) return undefined;
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

// Initialize Cloud Storage
export const storage = app ? getStorage(app) : null;

// Initialize Analytics safely
export let analytics = null;
if (app && typeof window !== 'undefined') {
  isAnalyticsSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Analytics optional fallback
  });
}

export default app;
