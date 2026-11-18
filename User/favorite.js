import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, doc, onSnapshot, setDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { normalizeCategory } from "../points.js";

const topbar = document.getElementById("topbar");
const grid = document.getElementById("favoriteGrid");
const cartCountEl = document.getElementById("cartCount");
const navProfileImg = document.getElementById("navProfileImg");
const toast = document.getElementById("toast");

const STAR_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';

let currentUid = null;
let favoriteIds = null;
let dishes = null;
let toastTimer;

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function readCart() {
  try {
    const cart = JSON.parse(localStorage.getItem("tisayCart"));
    return Array.isArray(cart) ? cart : [];
  } catch (err) {
    return [];
  }
}

function updateCartCount() {
  const count = readCart().reduce((sum, item) => sum + item.qty, 0);
  if (cartCountEl) cartCountEl.textContent = count;
}

function addToCart(dish) {
  if (dish.soldOut === true) return;

  const cart = readCart();
  const existing = cart.find((item) => item.name === dish.name);

  if (existing) {
    existing.qty += 1;
    if (!existing.category) existing.category = normalizeCategory(dish.category);
  } else {
    cart.push({
      name: dish.name,
      price: Number(dish.price) || 0,
      image: dish.image || "logo.jpg",
      qty: 1,
      category: normalizeCategory(dish.category)
    });
  }

  localStorage.setItem("tisayCart", JSON.stringify(cart));
  updateCartCount();
  showToast(`${dish.name} added to cart!`);
}

async function removeFavorite(dish) {
  if (!currentUid) return;
  try {
    await setDoc(doc(db, "users", currentUid), { favorites: arrayRemove(dish.id) }, { merge: true });
    showToast(`${dish.name} removed from favorites`);
  } catch (err) {
    showToast("Could not remove this favorite.");
  }
}

function render() {
  if (favoriteIds === null || dishes === null) return;

  const items = dishes.filter((dish) => favoriteIds.has(dish.id));

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="fav-empty">
        <h3>No favorites yet</h3>
        <p>Tap the star on any dish to save it here.</p>
        <a href="home.html" class="btn-link">Browse Menu</a>
      </div>
    `;
    return;
  }

  grid.innerHTML = "";

  items.forEach((dish) => {
    const soldOut = dish.soldOut === true;
    const card = document.createElement("article");
    card.className = "dish-card" + (soldOut ? " sold-out" : "");

    card.innerHTML = `
      <div class="dish-photo">
        <img src="${escapeHtml(dish.image || "logo.jpg")}" alt="${escapeHtml(dish.name)}" loading="lazy" onerror="this.onerror=null;this.src='logo.jpg'">
        ${soldOut ? '<span class="soldout-tag">Sold Out</span>' : ""}
      </div>
      <div class="dish-info">
        <h3 class="dish-name">${escapeHtml(dish.name)}</h3>
        <p class="dish-price">₱${Number(dish.price || 0).toFixed(2)}</p>
        <div class="fav-row">
          <button type="button" class="fav-btn active" aria-label="Remove from favorites">${STAR_ICON}</button>
        </div>
        <button type="button" class="add-btn"${soldOut ? " disabled" : ""}>${soldOut ? "Sold Out" : "Add to Cart"}</button>
      </div>
    `;

    card.querySelector(".add-btn").addEventListener("click", () => addToCart(dish));
    card.querySelector(".fav-btn").addEventListener("click", () => removeFavorite(dish));
    grid.appendChild(card);
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  if (currentUid === user.uid) return;
  currentUid = user.uid;

  onSnapshot(
    doc(db, "users", user.uid),
    (snap) => {
      const data = snap.exists() ? snap.data() : {};
      favoriteIds = new Set(Array.isArray(data.favorites) ? data.favorites : []);
      if (data.avatar && navProfileImg) navProfileImg.src = data.avatar;
      render();
    },
    () => showToast("Could not load your favorites.")
  );

  onSnapshot(
    collection(db, "dishes"),
    (snapshot) => {
      dishes = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      render();
    },
    () => showToast("Could not load dishes.")
  );
});

window.addEventListener("storage", (event) => {
  if (event.key === "tisayCart") updateCartCount();
});

window.addEventListener(
  "scroll",
  () => {
    if (topbar) topbar.classList.toggle("scrolled", window.scrollY > 40);
  },
  { passive: true }
);

updateCartCount();