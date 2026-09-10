const { initializeApp } = require("firebase/app");
const { getFirestore } = require("firebase/firestore");
const { getStorage } = require("firebase/storage");

const firebaseConfig = {
  apiKey: "AIzaSyAZtufy7-MAc6_97Yy7Ilj1TRUtgzFWtjY",
  authDomain: "cobelgrano-36019.firebaseapp.com",
  projectId: "cobelgrano-36019",
  storageBucket: "cobelgrano-36019.firebasestorage.app",
  messagingSenderId: "386444843080",
  appId: "1:386444843080:web:a6fe7b771b28bda91ba07d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

module.exports = { app, db, storage };
