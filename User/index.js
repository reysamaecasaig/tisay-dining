import { auth } from "../firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

const MAX_ATTEMPTS = 3;
const BASE_LOCK_SECONDS = 5 * 60;
const MAX_LOCK_SECONDS = 15 * 60;
const STORAGE_KEY = "tisayLoginGuard";
const WRONG_CREDENTIAL_CODES = [
  "auth/invalid-credential",
  "auth/wrong-password",
  "auth/user-not-found",
  "auth/invalid-login-credentials"
];

const loginForm = document.getElementById("loginForm");
const emailField = document.getElementById("username");
const passwordField = document.getElementById("loginPassword");
const submitBtn = loginForm.querySelector(".primary-btn");
const submitLabel = submitBtn.textContent;

const alertModal = document.getElementById("alertModal");
const alertCard = document.getElementById("alertCard");
const alertTitle = document.getElementById("alertTitle");
const alertMessage = document.getElementById("alertMessage");
const alertTimer = document.getElementById("alertTimer");
const alertClose = document.getElementById("alertClose");

let countdownTimer = null;

function readGuard() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      failures: Number(stored && stored.failures) || 0,
      lockouts: Number(stored && stored.lockouts) || 0,
      lockedUntil: Number(stored && stored.lockedUntil) || 0
    };
  } catch (e) {
    return { failures: 0, lockouts: 0, lockedUntil: 0 };
  }
}

function writeGuard(guard) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(guard));
  } catch (e) {}
}

function clearGuard() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

function formatWait(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? minutes + ":" + String(rest).padStart(2, "0") : rest + "s";
}

function showAlert(title, message, locked) {
  alertTitle.textContent = title;
  alertMessage.textContent = message;
  alertCard.classList.toggle("locked", Boolean(locked));
  alertTimer.hidden = !locked;
  alertModal.classList.add("show");
  alertClose.focus();
}

function closeAlert() {
  alertModal.classList.remove("show");
}

alertClose.addEventListener("click", closeAlert);
alertModal.addEventListener("click", (e) => {
  if (e.target === alertModal) closeAlert();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAlert();
});

function setLocked(locked) {
  submitBtn.disabled = locked;
  emailField.disabled = locked;
  passwordField.disabled = locked;
  if (!locked) submitBtn.textContent = submitLabel;
}

function startCountdown() {
  clearInterval(countdownTimer);

  const tick = () => {
    const remaining = Math.ceil((readGuard().lockedUntil - Date.now()) / 1000);
    if (remaining <= 0) {
      clearInterval(countdownTimer);
      const guard = readGuard();
      writeGuard({ failures: 0, lockouts: guard.lockouts, lockedUntil: 0 });
      setLocked(false);
      closeAlert();
      return;
    }
    setLocked(true);
    submitBtn.textContent = "Try again in " + formatWait(remaining);
    alertTimer.textContent = "Try again in " + formatWait(remaining);
  };

  tick();
  countdownTimer = setInterval(tick, 500);
}

function registerFailure() {
  const guard = readGuard();
  guard.failures += 1;

  if (guard.failures >= MAX_ATTEMPTS) {
    guard.lockouts += 1;
    const seconds = Math.min(BASE_LOCK_SECONDS * Math.pow(2, guard.lockouts - 1), MAX_LOCK_SECONDS);
    guard.lockedUntil = Date.now() + seconds * 1000;
    writeGuard(guard);
    startCountdown();
    showAlert(
      "Too many failed attempts",
      "For your security, your account is temporarily locked. You can try again when the timer ends.",
      true
    );
    return;
  }

  writeGuard(guard);
  const left = MAX_ATTEMPTS - guard.failures;
  showAlert(
    "Incorrect email or password",
    "You have " + left + (left === 1 ? " attempt" : " attempts") + " left before login is temporarily locked.",
    false
  );
}

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

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (readGuard().lockedUntil > Date.now()) {
    startCountdown();
    return;
  }

  const emailInput = emailField.value.trim();
  const password = passwordField.value;

  if (!emailInput || !password) {
    showToast("Please enter email and password.");
    return;
  }

  submitBtn.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, emailInput, password);
    clearGuard();
    showToast("Login successful!");
    setTimeout(() => {
      window.location.href = "home.html";
    }, 800);
  } catch (error) {
    submitBtn.disabled = false;

    if (WRONG_CREDENTIAL_CODES.includes(error.code)) {
      registerFailure();
    } else if (error.code === "auth/too-many-requests") {
      showAlert("Too many attempts", "Please wait a few minutes before trying to log in again.", false);
    } else if (error.code === "auth/network-request-failed") {
      showToast("Network problem. Check your connection and try again.");
    } else {
      showToast("Could not log in. Please try again.");
    }
  }
});

if (readGuard().lockedUntil > Date.now()) startCountdown();