import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAxGM8uwA8VVTUqbUaA3c1QLchMOj4Ckwg",
  authDomain: "smart-coach-d7951.firebaseapp.com",
  projectId: "smart-coach-d7951",
  storageBucket: "smart-coach-d7951.firebasestorage.app",
  messagingSenderId: "825422196394",
  appId: "1:825422196394:web:3919eecc9e16eba4962ad3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();