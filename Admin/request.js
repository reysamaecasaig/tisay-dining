import { db } from "../firebase-config.js";
import { collection, query, where, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { awardOrderPoints, refundOrderPoints } from "../points.js";

const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const logoutBtn = document.getElementById("logoutBtn");
const container = document.getElementById("requestsContainer");

const orderModal = document.getElementById("orderModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalCustomerName = document.getElementById("modalCustomerName");
const modalOrderTime = document.getElementById("modalOrderTime");
const modalCustomerContact = document.getElementById("modalCustomerContact");
const modalCustomerAddress = document.getElementById("modalCustomerAddress");
const modalItemsList = document.getElementById("modalItemsList");
const modalTotalAmount = document.getElementById("modalTotalAmount");
const modalPointsInfo = document.createElement("span");
modalPointsInfo.className = "detail-points-info";
modalPointsInfo.hidden = true;
if (modalTotalAmount) modalTotalAmount.insertAdjacentElement("afterend", modalPointsInfo);
const modalAcceptBtn = document.getElementById("modalAcceptBtn");
const modalDeclineBtn = document.getElementById("modalDeclineBtn");

let activeOrderId = null;
let cachedRequests = [];

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

function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

function openOrderModal(orderId) {
  const req = cachedRequests.find(r => r.id === orderId);
  if (!req) return;

  activeOrderId = orderId;
  if (modalCustomerName) modalCustomerName.textContent = req.customer || "Guest Customer";
  if (modalOrderTime) modalOrderTime.textContent = `Time: ${req.time || "Just now"}`;
  if (modalCustomerContact) modalCustomerContact.textContent = req.contact || "N/A";
  if (modalCustomerAddress) modalCustomerAddress.textContent = req.address || "N/A";
  if (modalTotalAmount) modalTotalAmount.textContent = req.total || "₱0.00";

  const pointsUsed = Number(req.pointsUsed) || 0;
  modalPointsInfo.hidden = pointsUsed === 0;
  modalPointsInfo.textContent = `+ ${pointsUsed.toLocaleString()} pts paid by customer`;

  if (modalItemsList) {
    modalItemsList.innerHTML = "";
    if (Array.isArray(req.items) && req.items.length > 0) {
      req.items.forEach(item => {
        let imgSrc = item.image && item.image.trim() !== "" ? item.image : "logo.jpg";
        
        const paidWithPoints = item.redeemed === true;
        const priceLabel = paidWithPoints
          ? `<span class="detail-item-price points">${Number(item.pointsCost || 0).toLocaleString()} pts</span>`
          : `<span class="detail-item-price">₱${((item.price || 0) * (item.qty || 1)).toFixed(2)}</span>`;

        const row = document.createElement("div");
        row.className = "detail-item-row";
        row.innerHTML = `
          <img class="detail-item-img" src="${imgSrc}" alt="${item.name || 'Dish'}" onerror="this.src='logo.jpg'">
          <div class="detail-item-meta">
            <h4 class="detail-item-name">${item.name || 'Item'}</h4>
            <span class="detail-item-qty">Qty: ${item.qty || 1} &bull; ₱${Number(item.price || 0).toFixed(2)} each</span>
            ${paidWithPoints ? '<span class="points-tag">Paid with points</span>' : ""}
          </div>
          ${priceLabel}
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
  activeOrderId = null;
}

if (closeModalBtn) closeModalBtn.addEventListener("click", closeOrderModal);
if (orderModal) {
  orderModal.addEventListener("click", (e) => {
    if (e.target === orderModal) closeOrderModal();
  });
}

async function updateOrderStatus(orderId, status) {
  if (!orderId) return;
  try {
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, { status: status });
  } catch (err) {
    console.error("Error updating order status:", err);
    showToast("Could not update the order. Please try again.");
    return;
  }

  let pointsMessage = "";
  try {
    if (status === "Accepted") {
      const earned = await awardOrderPoints(db, orderId);
      if (earned) pointsMessage = ` ${earned} ${earned === 1 ? "point" : "points"} credited.`;
    } else {
      const refunded = await refundOrderPoints(db, orderId);
      if (refunded) pointsMessage = ` ${refunded} points refunded.`;
    }
  } catch (err) {
    console.error("Error updating customer points:", err);
  }

  showToast(`Order ${status.toLowerCase()} and moved to history.${pointsMessage}`);
  closeOrderModal();
}

if (modalAcceptBtn) {
  modalAcceptBtn.addEventListener("click", () => {
    if (activeOrderId) {
      updateOrderStatus(activeOrderId, "Accepted");
    }
  });
}

if (modalDeclineBtn) {
  modalDeclineBtn.addEventListener("click", () => {
    if (activeOrderId) {
      updateOrderStatus(activeOrderId, "Declined");
    }
  });
}

function renderRequests(requests) {
  if (!container) return;
  container.innerHTML = "";

  if (requests.length === 0) {
    container.innerHTML = `<div class="empty-state">No pending requests at the moment.</div>`;
    return;
  }

  requests.forEach((req) => {
    const card = document.createElement("div");
    card.className = "request-card";
    
    card.innerHTML = `
      <div class="request-info" style="flex: 1;">
        <h3>${req.customer || "Guest Customer"}</h3>
        <p>Contact: ${req.contact || "N/A"} &bull; Time: ${req.time || "Just now"} &bull; Total: <strong>${req.total || "₱0.00"}</strong></p>
        <div class="request-items">Click to view order details &amp; pictures</div>
      </div>
      <div class="request-action">
        <button type="button" class="action-btn accept-btn" data-id="${req.id}">Accept</button>
        <button type="button" class="action-btn decline-btn" data-id="${req.id}">Decline</button>
      </div>
    `;

    card.addEventListener("click", () => {
      openOrderModal(req.id);
    });

    container.appendChild(card);
  });

  document.querySelectorAll(".accept-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      updateOrderStatus(e.target.dataset.id, "Accepted");
    });
  });

  document.querySelectorAll(".decline-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      updateOrderStatus(e.target.dataset.id, "Declined");
    });
  });
}

const q = query(
  collection(db, "orders"),
  where("status", "==", "Pending")
);

onSnapshot(q, (snapshot) => {
  cachedRequests = snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
  renderRequests(cachedRequests);
}, (error) => {
  console.error("Firestore snapshot error:", error);
});