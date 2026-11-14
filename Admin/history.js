import { db } from "../firebase-config.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const logoutBtn = document.getElementById("logoutBtn");
const historyContainer = document.getElementById("historyContainer");

const orderModal = document.getElementById("orderModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalCustomerName = document.getElementById("modalCustomerName");
const modalOrderTime = document.getElementById("modalOrderTime");
const modalCustomerContact = document.getElementById("modalCustomerContact");
const modalCustomerAddress = document.getElementById("modalCustomerAddress");
const modalItemsList = document.getElementById("modalItemsList");
const modalTotalAmount = document.getElementById("modalTotalAmount");
const modalStatusBadge = document.getElementById("modalStatusBadge");

let cachedHistory = [];

function toggleMenu() {
  sidebar.classList.toggle("open");
  overlay.classList.toggle("show");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", sidebar.classList.contains("open"));
}

if (menuBtn) menuBtn.addEventListener("click", toggleMenu);
if (overlay) overlay.addEventListener("click", toggleMenu);

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}

function openOrderModal(orderId) {
  const ord = cachedHistory.find(item => item.id === orderId);
  if (!ord) return;

  if (modalCustomerName) modalCustomerName.textContent = ord.customer || "Guest Customer";
  if (modalOrderTime) modalOrderTime.textContent = `Time: ${ord.time || "Just now"}`;
  if (modalCustomerContact) modalCustomerContact.textContent = ord.contact || "N/A";
  if (modalCustomerAddress) modalCustomerAddress.textContent = ord.address || "N/A";
  if (modalTotalAmount) modalTotalAmount.textContent = ord.total || "₱0.00";

  const status = ord.status || "Accepted";
  if (modalStatusBadge) {
    modalStatusBadge.textContent = status;
    if (status === "Declined") {
      modalStatusBadge.style.cssText = "background: rgba(239, 68, 68, 0.12); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.3);";
    } else {
      modalStatusBadge.style.cssText = "";
    }
  }

  if (modalItemsList) {
    modalItemsList.innerHTML = "";
    if (Array.isArray(ord.items) && ord.items.length > 0) {
      ord.items.forEach(item => {
        let imgSrc = item.image && item.image.trim() !== "" ? item.image : "logo.jpg";

        const row = document.createElement("div");
        row.className = "detail-item-row";
        row.innerHTML = `
          <img class="detail-item-img" src="${imgSrc}" alt="${item.name || 'Dish'}" onerror="this.src='logo.jpg'">
          <div class="detail-item-meta">
            <h4 class="detail-item-name">${item.name || 'Item'}</h4>
            <span class="detail-item-qty">Qty: ${item.qty || 1} &bull; ₱${Number(item.price || 0).toFixed(2)} each</span>
          </div>
          <span class="detail-item-price">₱${((item.price || 0) * (item.qty || 1)).toFixed(2)}</span>
        `;
        modalItemsList.appendChild(row);
      });
    } else {
      modalItemsList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 10px;">No item details available.</p>`;
    }
  }

  if (orderModal) orderModal.classList.add("show");
}

function closeOrderModal() {
  if (orderModal) orderModal.classList.remove("show");
}

if (closeModalBtn) closeModalBtn.addEventListener("click", closeOrderModal);
if (orderModal) {
  orderModal.addEventListener("click", (e) => {
    if (e.target === orderModal) closeOrderModal();
  });
}

function renderHistory(history) {
  if (!historyContainer) return;

  historyContainer.innerHTML = "";
  if (history.length === 0) {
    historyContainer.innerHTML = `<div class="empty-state" style="text-align: center; color: var(--text-muted); padding: 40px;">No order history available yet.</div>`;
    return;
  }

  history.forEach((ord) => {
    const status = ord.status || "Accepted";
    const statusClass = status === "Declined" ? "declined" : "accepted";
    const badgeStyle = status === "Declined" 
      ? "background: rgba(239, 68, 68, 0.12); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.3);" 
      : "";

    const card = document.createElement("div");
    card.className = "request-card";
    card.innerHTML = `
      <div class="request-info" style="flex: 1;">
        <h3>${ord.customer || "Guest Customer"}</h3>
        <p>Contact: ${ord.contact || "N/A"} &bull; Time: ${ord.time || "Just now"} &bull; Total: <strong>${ord.total || "₱0.00"}</strong></p>
        <div class="request-items">Click to view order details</div>
      </div>
      <div>
        <span class="status-badge ${statusClass}" style="${badgeStyle}">${status}</span>
      </div>
    `;

    card.addEventListener("click", () => {
      openOrderModal(ord.id);
    });

    historyContainer.appendChild(card);
  });
}

const q = query(
  collection(db, "orders"),
  where("status", "!=", "Pending")
);

onSnapshot(q, (snapshot) => {
  cachedHistory = snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
  renderHistory(cachedHistory);
}, (error) => {
  console.error("Firestore history snapshot error:", error);
});