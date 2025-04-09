// 👉 여기에 Firebase 설정을 붙여넣으세요
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyABqMIsdZkz-cnkY_RapmZXcop5uWWN2B8",
  authDomain: "encryptalk-8a9a1.firebaseapp.com",
  projectId: "encryptalk-8a9a1",
  storageBucket: "encryptalk-8a9a1.firebasestorage.app",
  messagingSenderId: "832873643653",
  appId: "1:832873643653:web:22d5393ca327be10efb3ec",
  measurementId: "G-717PD1YCLV"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
