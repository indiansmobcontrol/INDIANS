// ============================================================================
// FIREBASE SIGN-IN (optional). Leave `config` empty to keep the site as it is.
// To restrict the records to approved Google accounts:
//   1. Firebase console -> Project settings -> Your apps -> your web app -> "Config"
//   2. Paste the values below, and put YOUR Gmail in `admins`.
// The values in `config` are NOT secrets (every Firebase website shows them);
// what protects the data is the Firestore rules you paste in the Firebase console.
// ============================================================================
export const FIREBASE = {
  config: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },
  // Gmail addresses allowed to open the Data page and publish. Lowercase.
  // (The real restriction is the same address inside the Firestore rules.)
  admins: ['you@gmail.com'],
};
