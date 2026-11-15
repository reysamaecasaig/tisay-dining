import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, updateDoc, setDoc, onSnapshot, collection, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { syncOrderDoc, countDishes, REFUND_STATUSES } from "../points.js";

const userFullName = document.getElementById("userFullName");
const userPhone = document.getElementById("userPhone");
const userAddress = document.getElementById("userAddress");
const userPoints = document.getElementById("userPoints");
const pointsPending = document.getElementById("pointsPending");
const userEarned = document.getElementById("userEarned");
const activityList = document.getElementById("activityList");
const rewardRows = document.querySelectorAll(".reward-row");
const profileAvatarImg = document.getElementById("profileAvatarImg");
const navProfileImg = document.getElementById("navProfileImg");

const avatarTrigger = document.getElementById("avatarTrigger");
const avatarFileInput = document.getElementById("avatarFileInput");
const cropModal = document.getElementById("cropModal");
const cropCanvas = document.getElementById("cropCanvas");
const cropCtx = cropCanvas.getContext("2d");
const zoomSlider = document.getElementById("zoomSlider");
const cancelCropBtn = document.getElementById("cancelCropBtn");
const saveCropBtn = document.getElementById("saveCropBtn");
const cropArea = document.getElementById("cropArea");

const logoutBtn = document.getElementById("logoutBtn");
const openEditModalBtn = document.getElementById("openEditModalBtn");
const editModal = document.getElementById("editModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const editProfileForm = document.getElementById("editProfileForm");

const editFullName = document.getElementById("editFullName");
const editPhone = document.getElementById("editPhone");
const editAddress = document.getElementById("editAddress");

let currentUid = null;
let watching = false;
let balance = 0;
let loadedImage = null;
let imgScale = 1;
let imgX = 0;
let imgY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;

function renderBalance(points) {
  balance = points;
  userPoints.textContent = points.toLocaleString();

  rewardRows.forEach((row) => {
    const cost = Number(row.dataset.cost);
    const bar = row.querySelector(".reward-bar span");
    const state = row.querySelector(".reward-state");
    const ready = points >= cost;
    bar.style.width = Math.min(100, (points / cost) * 100) + "%";
    row.classList.toggle("ready", ready);
    state.textContent = ready
      ? "Ready to use at checkout"
      : (cost - points).toLocaleString() + " more points to go";
  });
}

function formatDate(order) {
  const stamp = order.createdAt && order.createdAt.toDate ? order.createdAt.toDate() : null;
  if (!stamp) return order.time || "";
  return stamp.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function renderActivity(orders) {
  const sorted = orders.slice().sort((a, b) => {
    const left = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
    const right = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
    return right - left;
  });

  let pending = 0;
  let earned = 0;

  sorted.forEach((order) => {
    const dishes = countDishes(order.items);
    if (order.status === "Accepted") earned += Number(order.pointsEarned) || dishes;
    if (order.status === "Pending") pending += dishes;
  });

  userEarned.textContent = earned.toLocaleString() + " pts";
  pointsPending.textContent = pending
    ? pending.toLocaleString() + (pending === 1 ? " point" : " points") + " pending admin approval"
    : "Earn 1 point for every dish you order.";

  if (!sorted.length) {
    activityList.innerHTML = '<li class="activity-empty">No orders yet.</li>';
    return;
  }

  activityList.innerHTML = sorted.map((order) => {
    const dishes = countDishes(order.items);
    const used = Number(order.pointsUsed) || 0;
    const status = order.status || "Pending";
    const refunded = REFUND_STATUSES.includes(status);
    const chipClass = status === "Accepted" ? "accepted" : refunded ? "rejected" : "";

    let gain = '<span class="activity-pts wait">+' + dishes + ' pending</span>';
    if (status === "Accepted") gain = '<span class="activity-pts">+' + (Number(order.pointsEarned) || dishes) + ' pts</span>';
    if (refunded) gain = '<span class="activity-pts wait">No points</span>';

    let spent = "";
    if (used) {
      spent = refunded
        ? '<span class="activity-pts wait">' + used + ' pts refunded</span>'
        : '<span class="activity-pts minus">-' + used + ' pts</span>';
    }

    return '<li><div class="activity-main"><strong>' + dishes + (dishes === 1 ? " dish" : " dishes") +
      '</strong><small>' + formatDate(order) + '</small></div><div class="activity-side">' +
      gain + spent + '<span class="chip ' + chipClass + '">' + status + '</span></div></li>';
  }).join("");
}

function watchLoyalty(uid) {
  if (watching) return;
  watching = true;

  onSnapshot(doc(db, "users", uid), (snap) => {
    renderBalance(snap.exists() ? Number(snap.data().points) || 0 : 0);
  });

  onSnapshot(query(collection(db, "orders"), where("uid", "==", uid)), (snap) => {
    const orders = [];
    snap.forEach((docSnap) => {
      const order = docSnap.data();
      orders.push(order);
      syncOrderDoc(db, docSnap.id, order);
    });
    renderActivity(orders);
  }, () => {
    showToast("Could not load points activity.");
  });
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUid = user.uid;
    watchLoyalty(user.uid);
    try {
      const docRef = doc(db, "users", currentUid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        userFullName.textContent = data.fullName || user.email;
        userPhone.textContent = data.mobile || "No phone added";
        userAddress.textContent = data.address || "No address added";
        renderBalance(Number(data.points) || 0);

        if (data.avatar) {
          profileAvatarImg.src = data.avatar;
          navProfileImg.src = data.avatar;
        }

        editFullName.value = data.fullName || "";
        editPhone.value = data.mobile || "";
        editAddress.value = data.address || "";
      } else {
        userFullName.textContent = user.email;
      }
    } catch (error) {
      showToast("Failed to load user profile data.");
    }
  } else {
    window.location.href = "index.html";
  }
});

avatarTrigger.addEventListener("click", () => {
  avatarFileInput.click();
});

avatarFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      loadedImage = img;
      imgScale = 1;
      imgX = 0;
      imgY = 0;
      zoomSlider.value = "1";
      drawCropCanvas();
      cropModal.classList.add("show");
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
  avatarFileInput.value = "";
});

function drawCropCanvas() {
  if (!loadedImage) return;
  const size = cropCanvas.width;
  cropCtx.clearRect(0, 0, size, size);

  const aspect = loadedImage.width / loadedImage.height;
  let baseW, baseH;

  if (aspect >= 1) {
    baseH = size;
    baseW = size * aspect;
  } else {
    baseW = size;
    baseH = size / aspect;
  }

  const drawW = baseW * imgScale;
  const drawH = baseH * imgScale;
  const centerX = (size - drawW) / 2 + imgX;
  const centerY = (size - drawH) / 2 + imgY;

  cropCtx.drawImage(loadedImage, centerX, centerY, drawW, drawH);
}

zoomSlider.addEventListener("input", () => {
  imgScale = parseFloat(zoomSlider.value);
  drawCropCanvas();
});

function startDrag(clientX, clientY) {
  isDragging = true;
  startX = clientX - imgX;
  startY = clientY - imgY;
}

function moveDrag(clientX, clientY) {
  if (!isDragging) return;
  imgX = clientX - startX;
  imgY = clientY - startY;
  drawCropCanvas();
}

function endDrag() {
  isDragging = false;
}

cropArea.addEventListener("mousedown", (e) => startDrag(e.clientX, e.clientY));
window.addEventListener("mousemove", (e) => moveDrag(e.clientX, e.clientY));
window.addEventListener("mouseup", endDrag);

cropArea.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1) {
    startDrag(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: true });

window.addEventListener("touchmove", (e) => {
  if (isDragging && e.touches.length === 1) {
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: true });

window.addEventListener("touchend", endDrag);

cancelCropBtn.addEventListener("click", () => {
  cropModal.classList.remove("show");
  loadedImage = null;
});

saveCropBtn.addEventListener("click", async () => {
  if (!loadedImage || !currentUid) return;

  const dataUrl = cropCanvas.toDataURL("image/jpeg", 0.85);

  try {
    await setDoc(doc(db, "users", currentUid), { avatar: dataUrl }, { merge: true });
    profileAvatarImg.src = dataUrl;
    navProfileImg.src = dataUrl;
    cropModal.classList.remove("show");
    loadedImage = null;
    showToast("Profile picture updated!");
  } catch (error) {
    showToast("Failed to save profile picture.");
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

if (openEditModalBtn) {
  openEditModalBtn.addEventListener("click", () => editModal.classList.add("show"));
}

if (closeModalBtn) {
  closeModalBtn.addEventListener("click", () => editModal.classList.remove("show"));
}

if (editProfileForm) {
  editProfileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUid) return;

    const updatedData = {
      fullName: editFullName.value.trim(),
      mobile: editPhone.value.trim(),
      address: editAddress.value.trim()
    };

    try {
      await updateDoc(doc(db, "users", currentUid), updatedData);
      userFullName.textContent = updatedData.fullName;
      userPhone.textContent = updatedData.mobile;
      userAddress.textContent = updatedData.address;
      editModal.classList.remove("show");
      showToast("Profile updated successfully!");
    } catch (error) {
      showToast("Failed to update profile.");
    }
  });
}