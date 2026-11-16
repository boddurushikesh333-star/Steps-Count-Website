/**
 * FirebaseService - Cloud sync and real-time persistence with Google Cloud Firestore
 */

class FirebaseService {
  static CONFIG_KEY = 'step_pulse_firebase_config_v1';
  static USER_DATA_COLLECTION = 'steppulse_users';

  constructor(storageManager, onStateChange) {
    this.storage = storageManager;
    this.onStateChange = onStateChange || (() => {});
    this.isInitialized = false;
    this.db = null;
    this.auth = null;
    this.currentUser = null;
    this.syncStatus = 'unconfigured'; // 'unconfigured' | 'connecting' | 'connected' | 'syncing' | 'error'
    this.syncError = null;
    this.unsubscribeSnapshot = null;
    this.debounceTimer = null;

    this.init();
  }

  // Load stored config or default template
  getConfig() {
    try {
      // 1. Check window.FIREBASE_CONFIG if defined in firebase-config.js
      if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId) {
        return window.FIREBASE_CONFIG;
      }
      // 2. Check localStorage
      const saved = localStorage.getItem(FirebaseService.CONFIG_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Error reading Firebase config:', e);
    }
    return null;
  }

  saveConfig(configObj) {
    try {
      localStorage.setItem(FirebaseService.CONFIG_KEY, JSON.stringify(configObj));
      this.reconnect(configObj);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  clearConfig() {
    localStorage.removeItem(FirebaseService.CONFIG_KEY);
    if (this.auth) {
      this.auth.signOut();
    }
    this.isInitialized = false;
    this.currentUser = null;
    this.syncStatus = 'unconfigured';
    this.notifyState();
  }

  init() {
    const config = this.getConfig();
    if (!config || !config.apiKey || !config.projectId) {
      this.syncStatus = 'unconfigured';
      this.notifyState();
      return;
    }

    this.connect(config);
  }

  reconnect(config) {
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = null;
    }
    this.connect(config);
  }

  connect(config) {
    if (typeof firebase === 'undefined') {
      this.syncStatus = 'error';
      this.syncError = 'Firebase SDK not loaded in browser.';
      this.notifyState();
      return;
    }

    try {
      this.syncStatus = 'connecting';
      this.notifyState();

      // Initialize or reuse default app
      let app;
      if (!firebase.apps.length) {
        app = firebase.initializeApp(config);
      } else {
        app = firebase.app();
      }

      this.db = firebase.firestore();
      this.auth = firebase.auth();
      this.isInitialized = true;

      // Enable offline persistence in Firestore if possible
      try {
        this.db.enablePersistence({ synchronizeTabs: true }).catch(err => {
          if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
            console.warn('Firestore persistence notice:', err);
          }
        });
      } catch (e) {
        // Ignore persistence setup warnings
      }

      // Listen for authentication changes
      this.auth.onAuthStateChanged(async (user) => {
        if (user) {
          this.currentUser = user;
          const name = user.displayName || (user.email ? user.email.split('@')[0] : 'Walker');
          this.storage.switchUser(user.uid, name);
          this.syncStatus = 'connected';
          this.syncError = null;
          this.notifyState();
          await this.syncFromCloud();
          this.listenToRealtimeToday();
          window.dispatchEvent(new CustomEvent('steppulse:user_changed', { detail: { user } }));
        } else {
          this.currentUser = null;
          this.storage.switchUser('guest');
          this.syncStatus = this.getConfig() ? 'connected' : 'unconfigured';
          this.notifyState();
          window.dispatchEvent(new CustomEvent('steppulse:user_changed', { detail: { user: null } }));
        }
      });

    } catch (err) {
      console.error('Firebase initialization error:', err);
      this.syncStatus = 'error';
      this.syncError = err.message;
      this.notifyState();
    }
  }

  notifyState() {
    this.onStateChange({
      isConfigured: !!this.getConfig(),
      isInitialized: this.isInitialized,
      syncStatus: this.syncStatus,
      syncError: this.syncError,
      currentUser: this.currentUser ? {
        uid: this.currentUser.uid,
        email: this.currentUser.email,
        isAnonymous: this.currentUser.isAnonymous,
        displayName: this.currentUser.displayName || (this.currentUser.isAnonymous ? 'Guest Walker' : 'User')
      } : null
    });
  }

  // Email & Password Sign Up
  async signUpWithEmail(email, password, displayName) {
    if (!this.auth) throw new Error('Firebase is not connected. Please enter your Firebase configuration first.');
    const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
    if (displayName && userCredential.user) {
      await userCredential.user.updateProfile({ displayName: displayName });
    }
    return userCredential.user;
  }

  // Email & Password Sign In
  async signInWithEmail(email, password) {
    if (!this.auth) throw new Error('Firebase is not connected. Please enter your Firebase configuration first.');
    const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
    return userCredential.user;
  }

  // Google Sign-In
  async signInWithGoogle() {
    if (!this.auth) throw new Error('Firebase is not connected. Please enter your Firebase configuration first.');
    const provider = new firebase.auth.GoogleAuthProvider();
    return this.auth.signInWithPopup(provider);
  }

  // Sign out
  async signOut() {
    if (this.auth) {
      if (this.unsubscribeSnapshot) {
        this.unsubscribeSnapshot();
        this.unsubscribeSnapshot = null;
      }
      await this.auth.signOut();
      this.currentUser = null;
      this.storage.switchUser('guest');
      this.notifyState();
      window.dispatchEvent(new CustomEvent('steppulse:user_changed', { detail: { user: null } }));
    }
  }

  getUserDocRef() {
    if (!this.db || !this.currentUser) return null;
    return this.db.collection(FirebaseService.USER_DATA_COLLECTION).doc(this.currentUser.uid);
  }

  // Listen to today's document for real-time live sync across devices (e.g. phone walking -> desktop updates)
  listenToRealtimeToday() {
    const userDoc = this.getUserDocRef();
    if (!userDoc) return;

    const todayStr = this.storage.getTodayKey();
    const dayDoc = userDoc.collection('days').doc(todayStr);

    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
    }

    this.unsubscribeSnapshot = dayDoc.onSnapshot(doc => {
      if (doc.exists && !doc.metadata.hasPendingWrites) {
        const cloudData = doc.data();
        const local = this.storage.getTodayRecord();
        
        // If cloud has more steps or newer update, merge into local
        if (cloudData.steps !== undefined && cloudData.steps > (local.steps || 0)) {
          this.storage.setStepsForDate(todayStr, cloudData.steps, cloudData.activeSeconds || 0);
          window.dispatchEvent(new CustomEvent('steppulse:cloud_update', { detail: cloudData }));
        }
      }
    }, err => {
      console.warn('Realtime listener notice:', err);
    });
  }

  // Pull all past days & profile from Firestore
  async syncFromCloud() {
    const userDoc = this.getUserDocRef();
    if (!userDoc) return;

    try {
      this.syncStatus = 'syncing';
      this.notifyState();

      // 1. Fetch user profile
      const profSnap = await userDoc.get();
      if (profSnap.exists) {
        const cloudProfile = profSnap.data().profile;
        if (cloudProfile) {
          this.storage.updateProfile(cloudProfile);
        }
      } else {
        // Upload initial local profile to cloud
        await userDoc.set({
          profile: this.storage.getProfile(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastActive: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      // 2. Fetch history records
      const daysSnap = await userDoc.collection('days').limit(60).get();
      if (!daysSnap.empty) {
        daysSnap.forEach(d => {
          const dayData = d.data();
          const localRecord = this.storage.data.days[d.id];
          // Cloud merge strategy: keep the highest step count or cloud value
          if (!localRecord || (dayData.steps > (localRecord.steps || 0))) {
            this.storage.data.days[d.id] = dayData;
          }
        });
        this.storage.save();
      } else {
        // Push local history records to cloud
        await this.syncAllLocalToCloud();
      }

      this.syncStatus = 'connected';
      this.notifyState();
      window.dispatchEvent(new CustomEvent('steppulse:cloud_synced'));
    } catch (e) {
      console.warn('Cloud pull error:', e);
      this.syncStatus = 'error';
      this.syncError = e.message;
      this.notifyState();
    }
  }

  // Sync today's activity with debouncing to prevent excessive Firestore writes
  queueSyncToday() {
    if (!this.db || !this.currentUser) return;

    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.syncTodayToCloud();
    }, 1200); // 1.2s debounce
  }

  async syncTodayToCloud() {
    const userDoc = this.getUserDocRef();
    if (!userDoc) return;

    try {
      const todayStr = this.storage.getTodayKey();
      const todayData = this.storage.getTodayRecord();
      const profile = this.storage.getProfile();

      const batch = this.db.batch();

      // Update today doc
      const dayRef = userDoc.collection('days').doc(todayStr);
      batch.set(dayRef, {
        ...todayData,
        lastSyncedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Update user doc lastActive & streak
      batch.set(userDoc, {
        profile: profile,
        lastActive: firebase.firestore.FieldValue.serverTimestamp(),
        currentStreak: this.storage.calculateStreak()
      }, { merge: true });

      await batch.commit();
      this.syncStatus = 'connected';
      this.notifyState();
    } catch (e) {
      console.warn('Sync to cloud error:', e);
      this.syncStatus = 'error';
      this.syncError = e.message;
      this.notifyState();
    }
  }

  // Push all local data into cloud
  async syncAllLocalToCloud() {
    const userDoc = this.getUserDocRef();
    if (!userDoc) return;

    try {
      const allDays = this.storage.data.days;
      const batch = this.db.batch();

      Object.entries(allDays).forEach(([dateStr, record]) => {
        const ref = userDoc.collection('days').doc(dateStr);
        batch.set(ref, record, { merge: true });
      });

      batch.set(userDoc, {
        profile: this.storage.getProfile(),
        lastActive: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await batch.commit();
    } catch (e) {
      console.warn('Sync all error:', e);
    }
  }
}

window.FirebaseService = FirebaseService;
