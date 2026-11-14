import { auth, db } from "../firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const eyeOpenSVG = `
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>`;

const eyeOffSVG = `
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  </svg>`;

function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

document.querySelectorAll(".eye-btn").forEach(btn => {
  btn.innerHTML = eyeOpenSVG;
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    btn.innerHTML = isHidden ? eyeOffSVG : eyeOpenSVG;
  });
});

document.getElementById("signStep2Form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("createPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (!email || !password || !confirmPassword) {
    showToast("Please fill out all fields.");
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast("Please enter a valid email address.");
    return;
  }

  if (password.length < 6) {
    showToast("Password must be at least 6 characters.");
    return;
  }

  if (password !== confirmPassword) {
    showToast("Passwords do not match.");
    return;
  }

  const step1Data = JSON.parse(sessionStorage.getItem("signupStep1") || "{}");

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Save registered user details in Firestore 'users' collection
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      fullName: step1Data.fullName || "",
      age: step1Data.age || "",
      birthdate: step1Data.birthdate || "",
      mobile: step1Data.mobile || "",
      address: step1Data.address || "",
      email: email,
      createdAt: serverTimestamp()
    });

    sessionStorage.removeItem("signupStep1");
    showToast("Account created successfully!");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1200);
  } catch (error) {
    showToast(error.message || "Registration failed.");
  }
});