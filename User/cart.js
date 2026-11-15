import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { POINT_COSTS, normalizeCategory, countDishes, placeOrder, syncUserOrders } from "../points.js";

const topbar = document.getElementById("topbar");
const navProfileImg = document.querySelector(".profile-img");
const cartItemsContainer = document.getElementById("cartItems");
const itemCountEl = document.getElementById("itemCount");
const totalAmountEl = document.getElementById("totalAmount");
const pointsBalanceEl = document.getElementById("pointsBalance");
const pointsUsedRow = document.getElementById("pointsUsedRow");
const pointsUsedEl = document.getElementById("pointsUsed");
const pointsLeftRow = document.getElementById("pointsLeftRow");
const pointsLeftEl = document.getElementById("pointsLeft");
const pointsEarnEl = document.getElementById("pointsEarn");
const orderForm = document.getElementById("orderForm");
const orderBtn = document.getElementById("orderBtn");
const nameInput = document.getElementById("name");
const contactInput = document.getElementById("contact");
const addressInput = document.getElementById("address");
const toast = document.getElementById("toast");

const nameError = document.getElementById("nameError");
const contactError = document.getElementById("contactError");
const addressError = document.getElementById("addressError");

const thanksModal = document.getElementById("thanksModal");
const thanksMessage = document.getElementById("thanksMessage");
const thanksTotal = document.getElementById("thanksTotal");

let currentUserUid = null;
let userPoints = 0;
let profileLoaded = false;
let toastTimer;
const redeemed = new Set();

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  if (currentUserUid === user.uid) return;
  currentUserUid = user.uid;
  syncUserOrders(db, user.uid);

  onSnapshot(
    doc(db, "users", user.uid),
    (snap) => {
      const data = snap.exists() ? snap.data() : {};
      userPoints = Number(data.points) || 0;

      if (!profileLoaded) {
        profileLoaded = true;
        if (nameInput && !nameInput.value) nameInput.value = data.fullName || "";
        if (contactInput && !contactInput.value) contactInput.value = data.mobile || "";
        if (addressInput && !addressInput.value) addressInput.value = data.address || "";
        if (data.avatar && navProfileImg) navProfileImg.src = data.avatar;
      }

      renderCart();
    },
    (error) => console.error("Could not load user points", error)
  );
});

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
  } catch (e) {
    return [];
  }
}

function writeCart(cart) {
  localStorage.setItem("tisayCart", JSON.stringify(cart));
}

function formatPrice(amount) {
  return `₱${Number(amount || 0).toFixed(2)}`;
}

function dishCategory(item) {
  if (item.category) return normalizeCategory(item.category);
  try {
    const dishes = JSON.parse(localStorage.getItem("tisayCachedDishes")) || [];
    const match = dishes.find((dish) => dish.name === item.name);
    return match ? normalizeCategory(match.category) : "";
  } catch (e) {
    return "";
  }
}

function pointCost(item) {
  const unit = POINT_COSTS[dishCategory(item)];
  return unit ? unit * item.qty : 0;
}

function settleRedeemed(cart) {
  const names = new Set(cart.map((item) => item.name));
  redeemed.forEach((name) => {
    if (!names.has(name)) redeemed.delete(name);
  });

  let spent = 0;
  cart.forEach((item) => {
    if (!redeemed.has(item.name)) return;
    const cost = pointCost(item);
    if (cost && spent + cost <= userPoints) {
      spent += cost;
    } else {
      redeemed.delete(item.name);
    }
  });
  return spent;
}

function getTotal(cart) {
  return cart.reduce((sum, item) => (redeemed.has(item.name) ? sum : sum + item.price * item.qty), 0);
}

function pointsButton(item, index, spent) {
  const cost = pointCost(item);
  if (!cost) return "";

  const star = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

  if (redeemed.has(item.name)) {
    return `<button type="button" class="points-btn active" data-action="points" data-index="${index}">${star}<span>Using ${cost} pts</span></button>`;
  }

  const locked = cost > userPoints - spent ? " locked" : "";
  return `<button type="button" class="points-btn${locked}" data-action="points" data-index="${index}">${star}<span>Use ${cost} pts</span></button>`;
}

function renderCart() {
  if (!cartItemsContainer) return;
  const cart = readCart();
  const spent = settleRedeemed(cart);
  const dishCount = countDishes(cart);

  if (pointsBalanceEl) pointsBalanceEl.textContent = userPoints.toLocaleString();
  if (itemCountEl) itemCountEl.textContent = dishCount;
  if (totalAmountEl) totalAmountEl.textContent = formatPrice(getTotal(cart));
  if (pointsEarnEl) pointsEarnEl.textContent = `+${dishCount} pts`;

  pointsUsedRow.hidden = spent === 0;
  pointsLeftRow.hidden = spent === 0;
  pointsUsedEl.textContent = `-${spent.toLocaleString()} pts`;
  pointsLeftEl.textContent = `${(userPoints - spent).toLocaleString()} pts`;

  if (orderBtn) orderBtn.disabled = cart.length === 0;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="empty-cart">
        <h3>Your cart is empty</h3>
        <p>Explore our delicious dishes and add them to your cart.</p>
        <a href="home.html" class="btn-link">Browse Menu</a>
      </div>
    `;
    return;
  }

  cartItemsContainer.innerHTML = cart
    .map((item, index) => {
      const isRedeemed = redeemed.has(item.name);
      const lineTotal = isRedeemed
        ? `<div class="item-total points">${pointCost(item).toLocaleString()} pts</div>`
        : `<div class="item-total">${formatPrice(item.price * item.qty)}</div>`;

      return `
      <div class="cart-item${isRedeemed ? " redeemed" : ""}">
        <div class="item-photo">
          <img src="${escapeHtml(item.image || "logo.jpg")}" alt="${escapeHtml(item.name)}" onerror="this.onerror=null;this.src='logo.jpg'">
        </div>
        <div>
          <h3 class="item-name">${escapeHtml(item.name)}</h3>
          <p class="item-price">${formatPrice(item.price)}</p>
          <div class="item-controls">
            <div class="qty">
              <button type="button" data-action="decrease" data-index="${index}" aria-label="Decrease quantity">&minus;</button>
              <span class="qty-value">${item.qty}</span>
              <button type="button" data-action="increase" data-index="${index}" aria-label="Increase quantity">&plus;</button>
            </div>
            ${pointsButton(item, index, spent)}
          </div>
        </div>
        <div class="item-side">
          ${lineTotal}
          <button type="button" class="remove-btn" data-action="remove" data-index="${index}" aria-label="Remove item">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>`;
    })
    .join("");
}

function updateQty(index, delta) {
  const cart = readCart();
  if (!cart[index]) return;
  cart[index].qty += delta;
  if (cart[index].qty <= 0) {
    redeemed.delete(cart[index].name);
    cart.splice(index, 1);
  }
  writeCart(cart);
  renderCart();
}

function removeItem(index) {
  const cart = readCart();
  if (!cart[index]) return;
  redeemed.delete(cart[index].name);
  cart.splice(index, 1);
  writeCart(cart);
  renderCart();
}

function togglePoints(index) {
  const cart = readCart();
  const item = cart[index];
  if (!item) return;

  if (redeemed.has(item.name)) {
    redeemed.delete(item.name);
    renderCart();
    return;
  }

  const cost = pointCost(item);
  const available = userPoints - settleRedeemed(cart);

  if (cost > available) {
    showToast(`You need ${(cost - available).toLocaleString()} more points for ${item.name}`);
    return;
  }

  redeemed.add(item.name);
  renderCart();
}

if (cartItemsContainer) {
  cartItemsContainer.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const index = parseInt(button.dataset.index, 10);
    if (button.dataset.action === "increase") updateQty(index, 1);
    if (button.dataset.action === "decrease") updateQty(index, -1);
    if (button.dataset.action === "remove") removeItem(index);
    if (button.dataset.action === "points") togglePoints(index);
  });
}

function validateForm() {
  let isValid = true;

  nameError.textContent = "";
  contactError.textContent = "";
  addressError.textContent = "";

  if (!nameInput.value.trim()) {
    nameError.textContent = "Please enter your name.";
    isValid = false;
  }
  if (!contactInput.value.trim()) {
    contactError.textContent = "Please enter your contact number.";
    isValid = false;
  }
  if (!addressInput.value.trim()) {
    addressError.textContent = "Please enter your delivery address.";
    isValid = false;
  }
  return isValid;
}

if (orderForm) {
  orderForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const cart = readCart();
    if (!cart.length) return;
    if (!validateForm()) return;

    if (!currentUserUid) {
      showToast("Still loading your account. Please try again.");
      return;
    }

    const customerName = nameInput.value.trim();
    const spent = settleRedeemed(cart);
    const totalAmt = getTotal(cart);
    const dishCount = countDishes(cart);

    const items = cart.map((item) => {
      const isRedeemed = redeemed.has(item.name);
      return {
        name: item.name,
        price: item.price,
        image: item.image,
        qty: item.qty,
        category: dishCategory(item),
        redeemed: isRedeemed,
        pointsCost: isRedeemed ? pointCost(item) : 0
      };
    });

    orderBtn.disabled = true;
    orderBtn.textContent = "Placing order...";

    try {
      await placeOrder(db, currentUserUid, {
        customer: customerName,
        contact: contactInput.value.trim(),
        address: addressInput.value.trim(),
        items: items,
        total: formatPrice(totalAmt),
        pointsUsed: spent,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      });
    } catch (err) {
      console.error("Error placing order:", err);
      showToast(
        err.message === "INSUFFICIENT_POINTS"
          ? "Your points balance changed. Please review your cart."
          : "We couldn't place your order. Please try again."
      );
      orderBtn.textContent = "Order";
      renderCart();
      return;
    }

    orderBtn.textContent = "Order";
    redeemed.clear();
    writeCart([]);
    renderCart();
    orderForm.reset();

    const pointsNote = spent ? ` ${spent.toLocaleString()} points were used.` : "";
    thanksMessage.textContent = `Thank you for your order, ${customerName}! Your order is now pending admin approval.${pointsNote} You will earn ${dishCount} ${dishCount === 1 ? "point" : "points"} once it is confirmed.`;
    thanksTotal.textContent = `Total Payment: ${formatPrice(totalAmt)}`;
    thanksModal.classList.add("show");
  });
}

window.addEventListener(
  "scroll",
  () => {
    if (topbar) topbar.classList.toggle("scrolled", window.scrollY > 40);
  },
  { passive: true }
);

renderCart();