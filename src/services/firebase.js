// src/services/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDQJqHqomC-qXRcAzhpJnQBcxv-6KsBd_M",
  authDomain: "web-pkm-6c1e1.firebaseapp.com",
  projectId: "web-pkm-6c1e1",
  storageBucket: "web-pkm-6c1e1.firebasestorage.app",
  messagingSenderId: "39119738920",
  appId: "1:39119738920:web:2a056385a0c9c2a4e93d1d"
};

//init app dulu
export const app = initializeApp(firebaseConfig);

// baru init services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// bikin login tetap nempel walau refresh
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("❌ setPersistence error:", err);
});






