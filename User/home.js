import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

onAuthStateChanged(auth, async (user) => {
  if (user) {
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
  const name = card.dataset.name;
  const price = parseFloat(card.dataset.price);
  const image = card.dataset.image;

  let cart = readCart();
  const existing = cart.find(item => item.name === name);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ name, price, image, qty: 1 });
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
    card.dataset.name = dish.name;
    card.dataset.price = dish.price;
    card.dataset.image = dish.image || 'logo.jpg';

    card.innerHTML = `
      <div class="dish-photo">
        <img src="${dish.image || 'logo.jpg'}" alt="${dish.name}" loading="lazy" onerror="this.src='logo.jpg'">
      </div>
      <div class="dish-info">
        <h3 class="dish-name">${dish.name}</h3>
        <p class="dish-price">₱${Number(dish.price || 0).toFixed(2)}</p>
        <button type="button" class="add-btn">Add to Cart</button>
      </div>
    `;

    card.querySelector(".add-btn").addEventListener("click", () => {
      addToCart(card);
    });

    gridEl.appendChild(card);
  });
}

async function fetchAndRenderHomeDishes() {
  try {
    const cachedDishes = localStorage.getItem("tisayCachedDishes");
    if (cachedDishes) {
      const parsed = JSON.parse(cachedDishes);
      if (Array.isArray(parsed) && parsed.length > 0) {
        renderDishesData(parsed);
      }
    }
  } catch (err) {}

  try {
    const querySnapshot = await getDocs(collection(db, "dishes"));
    const dishes = [];
    querySnapshot.forEach((docSnap) => {
      dishes.push({ id: docSnap.id, ...docSnap.data() });
    });

    localStorage.setItem("tisayCachedDishes", JSON.stringify(dishes));
    renderDishesData(dishes);
  } catch (error) {
    const gridFoods = document.getElementById("grid-Foods");
    if (gridFoods && !localStorage.getItem("tisayCachedDishes")) {
      gridFoods.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #dc2626; padding: 40px;">Failed to load dishes from Firebase.</div>`;
    }
  }
}

window.addEventListener("storage", (e) => {
  if (e.key === "tisayCart") updateCartCount();
});

window.addEventListener("scroll", () => {
  if (topbar) topbar.classList.toggle("scrolled", window.scrollY > 40);
}, { passive: true });

updateCartCount();
fetchAndRenderHomeDishes();