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
    apiKey: 'AIzaSyDrhDg4AVEeC1ARvjUyrSAEyfJLbMlPwiI',
    authDomain: 'indians-stat-center.firebaseapp.com',
    projectId: 'indians-stat-center',
    storageBucket: 'indians-stat-center.firebasestorage.app',
    messagingSenderId: '376412619168',
    appId: '1:376412619168:web:278cecf3da46bae75724c5',
  },
  // Gmail addresses allowed to open the Data page and publish. Lowercase.
  // (The real restriction is the same address inside the Firestore rules.)
  admins: ['indiansmobcontrol@gmail.com'],
};
