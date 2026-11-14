import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const topbar = document.getElementById("topbar");
const pins = document.querySelectorAll(".pin");
const items = document.querySelectorAll(".branch-item");
const navProfileImg = document.getElementById("navProfileImg");

// Sync User Profile Avatar in Top Bar across pages
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().avatar) {
        if (navProfileImg) {
          navProfileImg.src = docSnap.data().avatar;
        }
      }
    } catch (error) {
      console.error("Failed to load profile avatar in top bar", error);
    }
  }
});

function setActive(id, state) {
  document
    .querySelectorAll('[data-branch="' + id + '"]')
    .forEach((el) => el.classList.toggle("active", state));
}

[...pins, ...items].forEach((el) => {
  const id = el.dataset.branch;
  el.addEventListener("mouseenter", () => setActive(id, true));
  el.addEventListener("mouseleave", () => setActive(id, false));
});

pins.forEach((pin) => {
  const id = pin.dataset.branch;
  pin.addEventListener("focus", () => setActive(id, true));
  pin.addEventListener("blur", () => setActive(id, false));
});

window.addEventListener(
  "scroll",
  () => topbar.classList.toggle("scrolled", window.scrollY > 40),
  { passive: true }
);