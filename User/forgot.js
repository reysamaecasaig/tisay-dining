import { auth } from "../firebase-config.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const forgotForm = document.getElementById("forgotForm");
const resetEmailInput = document.getElementById("resetEmail");
const sendResetBtn = document.getElementById("sendResetBtn");

function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3200);
}

if (forgotForm) {
  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = resetEmailInput.value.trim();

    if (!email) {
      showToast("Please enter your email address.");
      return;
    }

    sendResetBtn.disabled = true;
    sendResetBtn.textContent = "Sending...";

    try {
      await sendPasswordResetEmail(auth, email);
      showToast("Password reset link sent! Check your email inbox.");
      forgotForm.reset();
    } catch (error) {
      if (error.code === "auth/invalid-email") {
        showToast("Please enter a valid email address.");
      } else if (error.code === "auth/user-not-found") {
        showToast("No account found with this email.");
      } else {
        showToast("Failed to send reset link. Please try again.");
      }
    } finally {
      sendResetBtn.disabled = false;
      sendResetBtn.textContent = "Send Reset Link";
    }
  });
}