import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAZtufy7-MAc6_97Yy7Ilj1TRUtgzFWtjY",
  authDomain: "cobelgrano-36019.firebaseapp.com",
  projectId: "cobelgrano-36019",
  storageBucket: "cobelgrano-36019.firebasestorage.app",
  messagingSenderId: "386444843080",
  appId: "1:386444843080:web:a6fe7b771b28bda91ba07d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
