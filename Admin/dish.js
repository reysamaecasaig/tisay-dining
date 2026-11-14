import { db } from "../firebase-config.js";
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const logoutBtn = document.getElementById("logoutBtn");

const gridFoods = document.getElementById("grid-Foods");
const gridDesserts = document.getElementById("grid-Desserts");
const gridDrinks = document.getElementById("grid-Drinks");

const openAddModalBtn = document.getElementById("openAddModalBtn");
const dishModal = document.getElementById("dishModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const dishForm = document.getElementById("dishForm");
const modalTitle = document.getElementById("modalTitle");

const dishIdInput = document.getElementById("dishId");
const dishNameInput = document.getElementById("dishName");
const dishPriceInput = document.getElementById("dishPrice");
const dishCategoryInput = document.getElementById("dishCategory");
const dishImageInput = document.getElementById("dishImage");

function toggleMenu() {
  sidebar.classList.toggle("open");
  overlay.classList.toggle("show");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", sidebar.classList.contains("open"));
}

if (menuBtn) menuBtn.addEventListener("click", toggleMenu);
if (overlay) overlay.addEventListener("click", toggleMenu);

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "index.html";
  });
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

function openModal(isEdit = false, dish = null) {
  if (isEdit && dish) {
    modalTitle.textContent = "Edit Dish";
    dishIdInput.value = dish.id;
    dishNameInput.value = dish.name;
    dishPriceInput.value = dish.price;
    dishCategoryInput.value = dish.category;
    dishImageInput.value = dish.image;
  } else {
    modalTitle.textContent = "Add New Dish";
    dishForm.reset();
    dishIdInput.value = "";
  }
  dishModal.classList.add("show");
}

function closeModal() {
  dishModal.classList.remove("show");
}

if (openAddModalBtn) openAddModalBtn.addEventListener("click", () => openModal(false));
if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
if (dishModal) {
  dishModal.addEventListener("click", (e) => {
    if (e.target === dishModal) closeModal();
  });
}

async function fetchDishes() {
  if (gridFoods) gridFoods.innerHTML = `<div style="grid-column: 1 / -1; color: var(--text-muted); padding: 20px;">Loading foods...</div>`;
  if (gridDesserts) gridDesserts.innerHTML = `<div style="grid-column: 1 / -1; color: var(--text-muted); padding: 20px;">Loading desserts...</div>`;
  if (gridDrinks) gridDrinks.innerHTML = `<div style="grid-column: 1 / -1; color: var(--text-muted); padding: 20px;">Loading drinks...</div>`;

  try {
    const querySnapshot = await getDocs(collection(db, "dishes"));
    const dishes = [];
    querySnapshot.forEach((docSnap) => {
      dishes.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderCategorizedDishes(dishes);
  } catch (error) {
    console.error("Error fetching dishes: ", error);
    const errHtml = `<div style="grid-column: 1 / -1; color: #dc2626; padding: 20px;">Failed to load dishes.</div>`;
    if (gridFoods) gridFoods.innerHTML = errHtml;
    if (gridDesserts) gridDesserts.innerHTML = errHtml;
    if (gridDrinks) gridDrinks.innerHTML = errHtml;
  }
}

function renderCategorizedDishes(dishes) {
  const foods = dishes.filter(d => (d.category || "").toLowerCase() === "foods");
  const desserts = dishes.filter(d => (d.category || "").toLowerCase() === "desserts");
  const drinks = dishes.filter(d => (d.category || "").toLowerCase() === "drinks");

  renderGrid(gridFoods, foods, "No foods found.");
  renderGrid(gridDesserts, desserts, "No desserts found.");
  renderGrid(gridDrinks, drinks, "No drinks found.");

  attachCardEventListeners();
}

function renderGrid(container, items, emptyMessage) {
  if (!container) return;
  container.innerHTML = "";

  if (items.length === 0) {
    container.innerHTML = `<div style="grid-column: 1 / -1; color: var(--text-muted); padding: 20px;">${emptyMessage}</div>`;
    return;
  }

  items.forEach(dish => {
    const card = document.createElement("div");
    card.className = "dish-card";
    card.innerHTML = `
      <div class="dish-img-wrap">
        <span class="dish-category-badge">${dish.category || 'General'}</span>
        <img src="${dish.image || 'logo.jpg'}" alt="${dish.name}" onerror="this.src='logo.jpg'">
      </div>
      <div class="dish-body">
        <h3 class="dish-title">${dish.name}</h3>
        <div class="dish-price">₱${Number(dish.price || 0).toFixed(2)}</div>
        <div class="dish-actions">
          <button type="button" class="dish-action-btn edit-dish-btn" data-id="${dish.id}">Edit</button>
          <button type="button" class="dish-action-btn delete-dish-btn" data-id="${dish.id}">Delete</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function attachCardEventListeners() {
  document.querySelectorAll(".edit-dish-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const querySnapshot = await getDocs(collection(db, "dishes"));
      let targetDish = null;
      querySnapshot.forEach(docSnap => {
        if (docSnap.id === id) {
          targetDish = { id: docSnap.id, ...docSnap.data() };
        }
      });
      if (targetDish) openModal(true, targetDish);
    });
  });

  document.querySelectorAll(".delete-dish-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (confirm("Are you sure you want to delete this dish?")) {
        try {
          await deleteDoc(doc(db, "dishes", id));
          showToast("Dish deleted successfully.");
          fetchDishes();
        } catch (error) {
          console.error("Error deleting dish:", error);
          showToast("Failed to delete dish.");
        }
      }
    });
  });
}

if (dishForm) {
  dishForm.addEventListener("submit", async (e) => {
    const id = dishIdInput.value;
    const name = dishNameInput.value.trim();
    const price = parseFloat(dishPriceInput.value);
    const category = dishCategoryInput.value;
    const image = dishImageInput.value.trim();

    const dishData = { name, price, category, image };

    try {
      if (id) {
        await updateDoc(doc(db, "dishes", id), dishData);
        showToast("Dish updated successfully.");
      } else {
        await addDoc(collection(db, "dishes"), dishData);
        showToast("Dish added successfully.");
      }
      closeModal();
      fetchDishes();
    } catch (error) {
      console.error("Error saving dish:", error);
      alert("Failed to save dish to Firestore.");
    }
  });
}

fetchDishes();