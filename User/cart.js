import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const topbar = document.getElementById("topbar");
const cartItemsContainer = document.getElementById("cartItems");
const itemCountEl = document.getElementById("itemCount");
const totalAmountEl = document.getElementById("totalAmount");
const orderForm = document.getElementById("orderForm");
const nameInput = document.getElementById("name");
const contactInput = document.getElementById("contact");
const addressInput = document.getElementById("address");

const nameError = document.getElementById("nameError");
const contactError = document.getElementById("contactError");
const addressError = document.getElementById("addressError");

const thanksModal = document.getElementById("thanksModal");
const thanksMessage = document.getElementById("thanksMessage");
const thanksTotal = document.getElementById("thanksTotal");

let currentUserUid = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserUid = user.uid;
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (nameInput && !nameInput.value) nameInput.value = data.fullName || "";
        if (contactInput && !contactInput.value) contactInput.value = data.mobile || "";
        if (addressInput && !addressInput.value) addressInput.value = data.address || "";
      }
    } catch (err) {}
  } else {
    window.location.href = "index.html";
  }
});

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

function getTotal(cart) {
  return cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

function renderCart() {
  if (!cartItemsContainer) return;
  const cart = readCart();

  cartItemsContainer.innerHTML = "";

  const totalItemsCount = cart.reduce((sum, item) => sum + item.qty, 0);
  if (itemCountEl) itemCountEl.textContent = totalItemsCount;

  const totalAmt = getTotal(cart);
  if (totalAmountEl) totalAmountEl.textContent = formatPrice(totalAmt);

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

  cart.forEach((item, index) => {
    const itemEl = document.createElement("div");
    itemEl.className = "cart-item";
    itemEl.innerHTML = `
      <div class="item-photo">
        <img src="${item.image || 'logo.jpg'}" alt="${item.name}" onerror="this.src='logo.jpg'">
      </div>
      <div>
        <h3 class="item-name">${item.name}</h3>
        <p class="item-price">${formatPrice(item.price)}</p>
        <div class="qty">
          <button type="button" class="decrease-btn" data-index="${index}" aria-label="Decrease quantity">&minus;</button>
          <span class="qty-value">${item.qty}</span>
          <button type="button" class="increase-btn" data-index="${index}" aria-label="Increase quantity">&plus;</button>
        </div>
      </div>
      <div class="item-side">
        <div class="item-total">${formatPrice(item.price * item.qty)}</div>
        <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove item">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    `;
    cartItemsContainer.appendChild(itemEl);
  });

  attachListeners();
}

function updateQty(index, delta) {
  const cart = readCart();
  if (!cart[index]) return;
  cart[index].qty += delta;
  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
  }
  writeCart(cart);
  renderCart();
}

function removeItem(index) {
  const cart = readCart();
  cart.splice(index, 1);
  writeCart(cart);
  renderCart();
}

function attachListeners() {
  document.querySelectorAll(".decrease-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      updateQty(parseInt(e.currentTarget.dataset.index, 10), -1);
    });
  });

  document.querySelectorAll(".increase-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      updateQty(parseInt(e.currentTarget.dataset.index, 10), 1);
    });
  });

  document.querySelectorAll(".remove-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      removeItem(parseInt(e.currentTarget.dataset.index, 10));
    });
  });
}

function validateForm() {
  let isValid = true;
  
  if (nameError) nameError.textContent = "";
  if (contactError) contactError.textContent = "";
  if (addressError) addressError.textContent = "";

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

    const customerName = nameInput.value.trim();
    const customerContact = contactInput.value.trim();
    const customerAddress = addressInput.value.trim();
    const totalAmt = getTotal(cart);

    const newOrder = {
      uid: currentUserUid,
      customer: customerName,
      contact: customerContact,
      address: customerAddress,
      items: cart.map(i => ({
        name: i.name,
        price: i.price,
        image: i.image,
        qty: i.qty
      })),
      total: formatPrice(totalAmt),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "Pending",
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, "orders"), newOrder);
    } catch (err) {
      console.error("Error writing order to Firestore:", err);
    }

    writeCart([]);
    renderCart();
    orderForm.reset();

    if (thanksMessage && thanksTotal) {
      thanksMessage.textContent = `Thank you for your order, ${customerName}! Your order has been placed and is now pending admin approval.`;
      thanksTotal.textContent = `Total Payment: ${formatPrice(totalAmt)}`;
    }
    if (thanksModal) {
      thanksModal.classList.add("show");
    }
  });
}

window.addEventListener("scroll", () => {
  if (topbar) topbar.classList.toggle("scrolled", window.scrollY > 40);
}, { passive: true });

renderCart();