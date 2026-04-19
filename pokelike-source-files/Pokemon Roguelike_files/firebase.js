// Firebase cloud save sync
// Before deploying: replace FIREBASE_CONFIG with your project's config from
// Firebase Console → Project Settings → Your apps → SDK setup and configuration
//
// Also set Firestore security rules:
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /saves/{userId} {
//       allow read, write: if request.auth != null && request.auth.uid == userId;
//     }
//   }
// }

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC0yX7q8218G1zyIvAMfh1ciObZBuXu6Bc",
  authDomain: "pokelike-9320b.firebaseapp.com",
  projectId: "pokelike-9320b",
  storageBucket: "pokelike-9320b.firebasestorage.app",
  messagingSenderId: "887999533437",
  appId: "1:887999533437:web:849c7fbfcd04bf052e3c14"
};

const SYNC_KEYS = [
  'poke_trainer', 'poke_tutorial_seen', 'poke_settings',
  'poke_achievements', 'poke_dex', 'poke_shiny_dex',
  'poke_elite_wins', 'poke_hall_of_fame', 'poke_last_run_won'
];

let _db = null;
let _auth = null;
let _currentUser = null;
let _firebaseReady = false;

function initFirebase() {
  if (_firebaseReady) return;
  _firebaseReady = true;
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.firestore();
    _auth = firebase.auth();
    _auth.onAuthStateChanged(user => {
      _currentUser = user;
      _updateAuthUI(user);
      if (user) _loadFromCloud();
    });
  } catch (e) {
    console.error('Firebase init failed:', e);
  }
}

function _updateAuthUI(user) {
  const btn = document.getElementById('btn-cloud-sync');
  const info = document.getElementById('cloud-sync-info');
  if (!btn) return;
  if (user) {
    btn.textContent = '☁ ' + (user.email || user.displayName || 'Signed in');
    btn.onclick = signOutCloud;
    if (info) { info.textContent = 'click to sign out'; info.style.display = 'block'; }
  } else {
    btn.textContent = '☁ Sign In to Sync Saves';
    btn.onclick = signInCloud;
    if (info) info.style.display = 'none';
  }
}

async function signInCloud() {
  if (!_auth) return;
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await _auth.signInWithPopup(provider);
  } catch (e) {
    console.error('Sign in failed:', e);
  }
}

async function signOutCloud() {
  if (!_auth) return;
  try {
    await _auth.signOut();
  } catch (e) {
    console.error('Sign out failed:', e);
  }
}

function _getLocalSave() {
  const save = { lastSaved: Date.now() };
  for (const key of SYNC_KEYS) {
    const val = localStorage.getItem(key);
    if (val !== null) save[key] = val;
  }
  return save;
}

function _applyCloudSave(save) {
  for (const key of SYNC_KEYS) {
    if (save[key] !== undefined) localStorage.setItem(key, save[key]);
  }
  localStorage.setItem('poke_last_cloud_sync', String(save.lastSaved));
  if (typeof applyDarkMode === 'function') applyDarkMode();
}

async function syncToCloud() {
  if (!_currentUser || !_db) return;
  try {
    const save = _getLocalSave();
    localStorage.setItem('poke_last_cloud_sync', String(save.lastSaved));
    await _db.collection('saves').doc(_currentUser.uid).set(save);
  } catch (e) {
    console.error('Cloud sync failed:', e);
  }
}

async function _loadFromCloud() {
  if (!_currentUser || !_db) return;
  try {
    const doc = await _db.collection('saves').doc(_currentUser.uid).get();
    if (!doc.exists) {
      await syncToCloud();
      return;
    }
    const cloudSave = doc.data();
    const localSyncTime = parseInt(localStorage.getItem('poke_last_cloud_sync') || '0');
    const cloudTime = cloudSave.lastSaved || 0;

    if (cloudTime > localSyncTime) {
      const hasLocalData = SYNC_KEYS.some(k => localStorage.getItem(k) !== null);
      if (hasLocalData && localSyncTime === 0) {
        if (confirm('A cloud save was found. Load it? (Your local progress will be overwritten)')) {
          _applyCloudSave(cloudSave);
        } else {
          await syncToCloud();
        }
      } else {
        _applyCloudSave(cloudSave);
      }
    } else {
      await syncToCloud();
    }
  } catch (e) {
    console.error('Load from cloud failed:', e);
  }
}
