import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue } from "firebase/database";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA9OxHS-p_458IoxUQLIPmZ6_AM1JZMH2Q",
  authDomain: "padel-americano19.firebaseapp.com",
  databaseURL: "https://padel-americano19-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "padel-americano19",
  storageBucket: "padel-americano19.firebasestorage.app",
  messagingSenderId: "955161797764",
  appId: "1:955161797764:web:6b996657ab7a6153cc0ed1"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]);
}

export const fbSet = async (path, data) => {
  await withTimeout(set(ref(db, path), data));
};

export const fbGet = async (path) => {
  const snap = await withTimeout(get(ref(db, path)));
  return snap.exists() ? snap.val() : null;
};

export const fbListen = (path, cb) =>
  onValue(ref(db, path), snap => { if (snap.exists()) cb(snap.val()); });

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signOutUser = () => signOut(auth);

export const fbSaveP = async (profile) => {
  const key = profile.uid || profile.username;
  await fbSet(`players/${key}`, profile);
};

export const fbLoadP = async (uidOrUsername) => {
  try {
    let data = await fbGet(`players/${uidOrUsername}`);
    if (data && !data.redirectTo) return data;
    const all = await fbGet('players');
    if (!all) return null;
    return Object.values(all).find(p => !p.redirectTo && p.username === uidOrUsername) || null;
  } catch (e) { return null; }
};