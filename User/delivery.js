import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, query, where, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const topbar = document.getElementById("topbar");
const orderList = document.getElementById("orderList");
const navProfileImg = document.getElementById("navProfileImg");

const CHECK_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>';
const CROSS_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"></path></svg>';

let currentUid = null;

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function millis(order) {
  return order.createdAt && order.createdAt.toMillis ? order.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
}

function formatDate(order) {
  if (!order.createdAt || !order.createdAt.toDate) return order.time || "";
  return order.createdAt.toDate().toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusInfo(status) {
  if (status === "Accepted") return { key: "accepted", label: "Confirmed" };
  if (status === "Declined" || status === "Rejected" || status === "Cancelled" || status === "Canceled") {
    return { key: "declined", label: "Declined" };
  }
  return { key: "pending", label: "Pending" };
}

function trackerHtml(key) {
  const confirmedClass = key === "accepted" ? "done" : key === "declined" ? "fail" : "waiting";
  const confirmedLabel = key === "declined" ? "Declined" : "Confirmed";
  const confirmedIcon = key === "declined" ? CROSS_ICON : CHECK_ICON;

  return `
    <div class="tracker">
      <div class="step done"><span class="step-dot">${CHECK_ICON}</span>Order Placed</div>
      <span class="step-line${key === "accepted" ? " done" : ""}"></span>
      <div class="step ${confirmedClass}"><span class="step-dot">${confirmedIcon}</span>${confirmedLabel}</div>
    </div>
  `;
}

function noteFor(key, order) {
  if (key === "accepted") {
    return `Your order was confirmed and is being prepared for delivery to ${escapeHtml(order.address || "your address")}.`;
  }
  if (key === "declined") {
    return Number(order.pointsUsed) > 0
      ? "This order was declined. The points you used were returned to your account."
      : "This order was declined by the restaurant.";
  }
  return "Waiting for the restaurant to confirm your order.";
}

function orderCard(id, order) {
  const info = statusInfo(order.status);
  const items = Array.isArray(order.items) ? order.items : [];

  const rows = items.map((item) => {
    const qty = Number(item.qty) || 1;
    const price = item.redeemed === true
      ? `${Number(item.pointsCost || 0).toLocaleString()} pts`
      : `₱${((Number(item.price) || 0) * qty).toFixed(2)}`;

    return `
      <div class="order-item">
        <img src="${escapeHtml(item.image || "logo.jpg")}" alt="${escapeHtml(item.name || "Dish")}" onerror="this.onerror=null;this.src='logo.jpg'">
        <span class="order-item-name">${escapeHtml(item.name || "Item")}<small>Qty: ${qty}</small></span>
        <span class="order-item-price">${price}</span>
      </div>
    `;
  }).join("");

  return `
    <article class="order-card">
      <div class="order-top">
        <div>
          <div class="order-id">Order #${escapeHtml(id.slice(0, 6).toUpperCase())}</div>
          <div class="order-time">${escapeHtml(formatDate(order))}</div>
        </div>
        <span class="status-chip ${info.key}">${info.label}</span>
      </div>
      ${trackerHtml(info.key)}
      <p class="order-note">${noteFor(info.key, order)}</p>
      <div class="order-items">${rows}</div>
      <div class="order-meta">
        <div><span>Deliver to</span><strong>${escapeHtml(order.address || "N/A")}</strong></div>
        <div><span>Contact</span><strong>${escapeHtml(order.contact || "N/A")}</strong></div>
      </div>
      <div class="order-foot">
        <span>Total Payment</span>
        <span class="order-total">${escapeHtml(order.total || "₱0.00")}</span>
      </div>
    </article>
  `;
}

function render(orders) {
  if (orders.length === 0) {
    orderList.innerHTML = `
      <div class="order-empty">
        <h3>No orders yet</h3>
        <p>Once you place an order, you can follow it here.</p>
        <a href="home.html" class="btn-link">Browse Menu</a>
      </div>
    `;
    return;
  }

  orders.sort((a, b) => millis(b) - millis(a));
  orderList.innerHTML = orders.map((order) => orderCard(order.id, order)).join("");
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  if (currentUid === user.uid) return;
  currentUid = user.uid;

  onSnapshot(doc(db, "users", user.uid), (snap) => {
    const data = snap.exists() ? snap.data() : {};
    if (data.avatar && navProfileImg) navProfileImg.src = data.avatar;
  });

  onSnapshot(
    query(collection(db, "orders"), where("uid", "==", user.uid)),
    (snapshot) => {
      render(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    },
    () => {
      orderList.innerHTML = '<div class="order-empty"><p>Could not load your orders. Please try again.</p></div>';
    }
  );
});

window.addEventListener(
  "scroll",
  () => {
    if (topbar) topbar.classList.toggle("scrolled", window.scrollY > 40);
  },
  { passive: true }
);