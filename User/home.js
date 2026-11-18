import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, doc, getDoc, setDoc, onSnapshot, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { normalizeCategory } from "../points.js";
import { createPromoCenter } from "./promos.js";

const topbar = document.getElementById("topbar");
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const logoutBtn = document.getElementById("logoutBtn");
const categoryBtns = document.querySelectorAll(".category-list button");
const dishGrids = document.querySelectorAll(".dish-grid");
const sectionTitle = document.getElementById("sectionTitle");
const cartCountEl = document.getElementById("cartCount");
const toast = document.getElementById("toast");
const userNameEl = document.getElementById("userName");
const navProfileImg = document.getElementById("navProfileImg");
const sidebarProfileImg = document.getElementById("sidebarProfileImg");

const promoElements = {
  button: document.getElementById("promoBtn"),
  dot: document.getElementById("promoDot"),
  modal: document.getElementById("promoModal"),
  close: document.getElementById("promoClose"),
  list: document.getElementById("weekList"),
  range: document.getElementById("promoRange"),
  limited: document.getElementById("limitedPromo")
};

const STAR_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';

let currentUid = null;
let watching = false;
let favorites = new Set();

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

function toggleMenu() {
  sidebar.classList.toggle("open");
  overlay.classList.toggle("show");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", sidebar.classList.contains("open"));
}

if (menuBtn) menuBtn.addEventListener("click", toggleMenu);
if (overlay) overlay.addEventListener("click", toggleMenu);

function refreshFavorites() {
  document.querySelectorAll(".dish-card").forEach((card) => {
    const button = card.querySelector(".fav-btn");
    if (!button) return;
    const active = favorites.has(card.dataset.id);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", active ? "Remove from favorites" : "Add to favorites");
  });
}

async function toggleFavorite(card) {
  const id = card.dataset.id;
  if (!id || !currentUid) return;

  const userRef = doc(db, "users", currentUid);

  if (favorites.has(id)) {
    favorites.delete(id);
    refreshFavorites();
    try {
      await setDoc(userRef, { favorites: arrayRemove(id) }, { merge: true });
      showToast(`${card.dataset.name} removed from favorites`);
    } catch (err) {
      favorites.add(id);
      refreshFavorites();
      showToast("Could not update favorites.");
    }
    return;
  }

  favorites.add(id);
  refreshFavorites();

  try {
    await Promise.race([
      setDoc(userRef, { favorites: arrayUnion(id) }, { merge: true }),
      new Promise((resolve) => setTimeout(resolve, 1500))
    ]);
  } catch (err) {
    favorites.delete(id);
    refreshFavorites();
    showToast("Could not save to favorites.");
    return;
  }

  setTimeout(() => {
    window.location.href = "favorite.html";
  }, 350);
}

function watchUser(uid) {
  if (watching) return;
  watching = true;

  const promos = createPromoCenter(db, uid, promoElements, showToast);

  onSnapshot(
    doc(db, "users", uid),
    (snap) => {
      const data = snap.exists() ? snap.data() : {};
      favorites = new Set(Array.isArray(data.favorites) ? data.favorites : []);
      refreshFavorites();
      promos.update(data);
    },
    (error) => console.error("Could not load user data", error)
  );
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUid = user.uid;
    watchUser(user.uid);
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userNameEl) userNameEl.textContent = userData.fullName || user.email;
        if (userData.avatar) {
          if (navProfileImg) navProfileImg.src = userData.avatar;
          if (sidebarProfileImg) sidebarProfileImg.src = userData.avatar;
        }
      } else {
        if (userNameEl) userNameEl.textContent = user.email;
      }
    } catch (err) {
      if (userNameEl) userNameEl.textContent = user.email;
    }
  } else {
    window.location.href = "index.html";
  }
});

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "index.html";
    } catch (error) {
      showToast("Logout failed.");
    }
  });
}

categoryBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    categoryBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const category = btn.dataset.category;
    sectionTitle.textContent = category;

    dishGrids.forEach(grid => {
      if (grid.dataset.category === category) {
        grid.removeAttribute("hidden");
      } else {
        grid.setAttribute("hidden", "");
      }
    });

    toggleMenu();
  });
});

function readCart() {
  try {
    const cart = JSON.parse(localStorage.getItem("tisayCart"));
    return Array.isArray(cart) ? cart : [];
  } catch (err) {
    return [];
  }
}

function updateCartCount() {
  const cart = readCart();
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  if (cartCountEl) cartCountEl.textContent = count;
}

function addToCart(card) {
  if (card.classList.contains("sold-out")) return;
  const name = card.dataset.name;
  const price = parseFloat(card.dataset.price);
  const image = card.dataset.image;
  const category = card.dataset.category;

  let cart = readCart();
  const existing = cart.find(item => item.name === name);

  if (existing) {
    existing.qty += 1;
    if (!existing.category) existing.category = category;
  } else {
    cart.push({ name, price, image, qty: 1, category });
  }

  localStorage.setItem("tisayCart", JSON.stringify(cart));
  updateCartCount();

  if (cartCountEl) {
    cartCountEl.classList.add("bump");
    setTimeout(() => cartCountEl.classList.remove("bump"), 400);
  }

  showToast(`${name} added to cart!`);
}

function renderDishesData(dishes) {
  const gridFoods = document.getElementById("grid-Foods");
  const gridDesserts = document.getElementById("grid-Desserts");
  const gridDrinks = document.getElementById("grid-Drinks");

  if (!gridFoods || !gridDesserts || !gridDrinks) return;

  const foods = dishes.filter(d => (d.category || "").toLowerCase() === "foods" || (d.category || "").toLowerCase() === "main course");
  const desserts = dishes.filter(d => (d.category || "").toLowerCase() === "desserts" || (d.category || "").toLowerCase() === "dessert");
  const drinks = dishes.filter(d => (d.category || "").toLowerCase() === "drinks" || (d.category || "").toLowerCase() === "drink");

  renderGrid(gridFoods, foods, "No foods available.");
  renderGrid(gridDesserts, desserts, "No desserts available.");
  renderGrid(gridDrinks, drinks, "No drinks available.");
}

function renderGrid(gridEl, items, emptyMessage) {
  gridEl.innerHTML = "";

  if (items.length === 0) {
    gridEl.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 40px;">${emptyMessage}</div>`;
    return;
  }

  items.forEach(dish => {
    const card = document.createElement("article");
    card.className = "dish-card";
    card.dataset.id = dish.id || "";
    card.dataset.name = dish.name;
    card.dataset.price = dish.price;
    card.dataset.image = dish.image || 'logo.jpg';
    card.dataset.category = normalizeCategory(dish.category);
    card.classList.toggle("sold-out", dish.soldOut === true);

    const photo = dish.image || "logo.jpg";
    const soldOut = dish.soldOut === true;

    card.innerHTML = `
      <div class="dish-photo">
        <img src="${escapeHtml(photo)}" alt="${escapeHtml(dish.name)}" loading="lazy" onerror="this.onerror=null;this.src='logo.jpg'">
        ${soldOut ? '<span class="soldout-tag">Sold Out</span>' : ""}
      </div>
      <div class="dish-info">
        <h3 class="dish-name">${escapeHtml(dish.name)}</h3>
        <p class="dish-price">₱${Number(dish.price || 0).toFixed(2)}</p>
        <div class="fav-row">
          <button type="button" class="fav-btn" aria-pressed="false" aria-label="Add to favorites">${STAR_ICON}</button>
        </div>
        <button type="button" class="add-btn"${soldOut ? " disabled" : ""}>${soldOut ? "Sold Out" : "Add to Cart"}</button>
      </div>
    `;

    card.querySelector(".add-btn").addEventListener("click", () => {
      addToCart(card);
    });

    card.querySelector(".fav-btn").addEventListener("click", () => {
      toggleFavorite(card);
    });

    gridEl.appendChild(card);
  });

  refreshFavorites();
}

function fetchAndRenderHomeDishes() {
  try {
    const cachedDishes = localStorage.getItem("tisayCachedDishes");
    if (cachedDishes) {
      const parsed = JSON.parse(cachedDishes);
      if (Array.isArray(parsed) && parsed.length > 0) {
        renderDishesData(parsed);
      }
    }
  } catch (err) {}

  onSnapshot(
    collection(db, "dishes"),
    (querySnapshot) => {
      const dishes = [];
      querySnapshot.forEach((docSnap) => {
        dishes.push({ id: docSnap.id, ...docSnap.data() });
      });

      try {
        localStorage.setItem("tisayCachedDishes", JSON.stringify(dishes));
      } catch (err) {}
      renderDishesData(dishes);
    },
    () => {
      const gridFoods = document.getElementById("grid-Foods");
      if (gridFoods && !localStorage.getItem("tisayCachedDishes")) {
        gridFoods.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #dc2626; padding: 40px;">Failed to load dishes from Firebase.</div>`;
      }
    }
  );
}

window.addEventListener("storage", (e) => {
  if (e.key === "tisayCart") updateCartCount();
});

window.addEventListener("scroll", () => {
  if (topbar) topbar.classList.toggle("scrolled", window.scrollY > 40);
}, { passive: true });

updateCartCount();
fetchAndRenderHomeDishes();