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
const dishFileInput = document.getElementById("dishFile");
const imagePreviewImg = document.getElementById("imagePreviewImg");
const imagePlaceholder = document.getElementById("imagePlaceholder");
const imagePickerTitle = document.getElementById("imagePickerTitle");
const imagePickerName = document.getElementById("imagePickerName");

let loadedDishes = [];

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

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showPreview(src, label) {
  const hasImage = Boolean(src);
  imagePreviewImg.hidden = !hasImage;
  imagePlaceholder.hidden = hasImage;
  if (hasImage) imagePreviewImg.src = src;
  else imagePreviewImg.removeAttribute("src");
  imagePickerTitle.textContent = hasImage ? "Change picture" : "Choose a picture";
  imagePickerName.textContent = label;
}

function compressImage(file, maxSize = 480) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

if (dishFileInput) {
  dishFileInput.addEventListener("change", async () => {
    const file = dishFileInput.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file.");
      dishFileInput.value = "";
      return;
    }

    try {
      const dataUrl = await compressImage(file);
      dishImageInput.value = dataUrl;
      showPreview(dataUrl, file.name);
    } catch (error) {
      showToast("Could not read that image.");
    }
    dishFileInput.value = "";
  });
}

function openModal(isEdit = false, dish = null) {
  if (isEdit && dish) {
    modalTitle.textContent = "Edit Dish";
    dishIdInput.value = dish.id;
    dishNameInput.value = dish.name;
    dishPriceInput.value = dish.price;
    dishCategoryInput.value = dish.category;
    dishImageInput.value = dish.image || "";
    showPreview(dish.image, dish.image && dish.image.startsWith("data:") ? "Current picture" : "Current picture link");
  } else {
    modalTitle.textContent = "Add New Dish";
    dishForm.reset();
    dishIdInput.value = "";
    dishImageInput.value = "";
    showPreview("", "From your device");
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

    loadedDishes = dishes;
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
        <span class="dish-category-badge">${escapeHtml(dish.category || 'General')}</span>
        <img src="${escapeHtml(dish.image || 'logo.jpg')}" alt="${escapeHtml(dish.name || '')}" onerror="this.onerror=null;this.src='logo.jpg'">
      </div>
      <div class="dish-body">
        <h3 class="dish-title">${escapeHtml(dish.name || '')}</h3>
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
    btn.addEventListener("click", () => {
      const targetDish = loadedDishes.find(dish => dish.id === btn.dataset.id);
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
    e.preventDefault();
    const id = dishIdInput.value;
    const name = dishNameInput.value.trim();
    const price = parseFloat(dishPriceInput.value);
    const category = dishCategoryInput.value;
    const image = dishImageInput.value.trim();

    if (!image) {
      showToast("Please choose a picture for the dish.");
      return;
    }

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