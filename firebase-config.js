// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBEaFj7hFgb3hkXd3C7NtKTbcUbTMnSjRs",
  authDomain: "tisay-dining-f3cf3.firebaseapp.com",
  projectId: "tisay-dining-f3cf3",
  storageBucket: "tisay-dining-f3cf3.firebasestorage.app",
  messagingSenderId: "526624113165",
  appId: "1:526624113165:web:5bfcc73eaf622edff6cb44",
  measurementId: "G-XS0HR2FRE8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, app };