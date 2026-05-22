import { initializeApp } from "firebase/app";
import { secureWipe } from '../utils/storage';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};

export const logoutAndClearSession = async () => {
  try {
    await signOutUser();
    secureWipe();
    window.location.href = '/';
  } catch (error) {
    console.error("Error clearing session", error);
  }
};
