const birthdateInput = document.getElementById("birthdate");
const ageInput = document.getElementById("age");
const calendarPopup = document.getElementById("calendarPopup");
const calendarToggle = document.getElementById("calendarToggle");
const calMonth = document.getElementById("calMonth");
const calYear = document.getElementById("calYear");
const calDays = document.getElementById("calDays");

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const today = new Date();
let viewYear = 2000;
let viewMonth = 0;
let selectedDate = null;

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

months.forEach((m, idx) => {
  const opt = document.createElement("option");
  opt.value = idx;
  opt.textContent = m.slice(0, 3);
  calMonth.appendChild(opt);
});

for (let y = today.getFullYear(); y >= 1920; y--) {
  const opt = document.createElement("option");
  opt.value = y;
  opt.textContent = y;
  calYear.appendChild(opt);
}

function calculateAge(birthDate) {
  let age = today.getFullYear() - birthDate.getFullYear();
  const mDiff = today.getMonth() - birthDate.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : 0;
}

function renderCalendar() {
  calMonth.value = viewMonth;
  calYear.value = viewYear;
  calDays.innerHTML = "";

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("button");
    empty.type = "button";
    empty.className = "cal-day";
    empty.disabled = true;
    calDays.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cal-day";
    btn.textContent = d;

    if (
      selectedDate &&
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === d
    ) {
      btn.classList.add("selected");
    }

    btn.addEventListener("click", () => {
      selectedDate = new Date(viewYear, viewMonth, d);
      const formatted = `${months[viewMonth]} ${String(d).padStart(2, "0")}, ${viewYear}`;
      birthdateInput.value = formatted;
      ageInput.value = calculateAge(selectedDate);
      calendarPopup.classList.remove("open");
      renderCalendar();
    });

    calDays.appendChild(btn);
  }
}

function toggleCalendar() {
  calendarPopup.classList.toggle("open");
  renderCalendar();
}

birthdateInput.addEventListener("click", toggleCalendar);
calendarToggle.addEventListener("click", toggleCalendar);

calMonth.addEventListener("change", () => {
  viewMonth = parseInt(calMonth.value, 10);
  renderCalendar();
});

calYear.addEventListener("change", () => {
  viewYear = parseInt(calYear.value, 10);
  renderCalendar();
});

document.getElementById("prevMonth").addEventListener("click", () => {
  viewMonth--;
  if (viewMonth < 0) {
    viewMonth = 11;
    viewYear--;
  }
  renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  viewMonth++;
  if (viewMonth > 11) {
    viewMonth = 0;
    viewYear++;
  }
  renderCalendar();
});

document.addEventListener("click", (e) => {
  if (!document.getElementById("birthdateGroup").contains(e.target)) {
    calendarPopup.classList.remove("open");
  }
});

const savedData = JSON.parse(sessionStorage.getItem("signupStep1") || "null");
if (savedData) {
  document.getElementById("fullName").value = savedData.fullName || "";
  ageInput.value = savedData.age || "";
  birthdateInput.value = savedData.birthdate || "";
  document.getElementById("mobile").value = savedData.mobile || "";
  document.getElementById("address").value = savedData.address || "";
}

document.getElementById("signStep1Form").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = {
    fullName: document.getElementById("fullName").value.trim(),
    age: ageInput.value.trim(),
    birthdate: birthdateInput.value.trim(),
    mobile: document.getElementById("mobile").value.trim(),
    address: document.getElementById("address").value.trim()
  };

  if (!data.fullName || !data.age || !data.birthdate || !data.mobile || !data.address) {
    showToast("Please complete all fields.");
    return;
  }

  sessionStorage.setItem("signupStep1", JSON.stringify(data));
  window.location.href = "sign2.html";
});