// src/firebase.js
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
// (İstersen analytics'i kullanmaya devam edebilirsin ama şart değil)
// import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: 'AIzaSyBVOhRMfHv78RT8TP80VFtC1aCjdYwKNuk',
  authDomain: 'yazma-eser-sozlugu.firebaseapp.com',
  projectId: 'yazma-eser-sozlugu',
  storageBucket: 'yazma-eser-sozlugu.firebasestorage.app',
  messagingSenderId: '512521303057',
  appId: '1:512521303057:web:078b3061fa57672c84adb0',
  measurementId: 'G-K0RN9LKKFV',
}

// 🔹 Firebase'i başlat
const app = initializeApp(firebaseConfig)

// 🔹 Veritabanı ve kimlik doğrulama modüllerini başlat
export const db = getFirestore(app)
export const auth = getAuth(app)

// (Opsiyonel) Analytics istersen aktif et:
// const analytics = getAnalytics(app);
