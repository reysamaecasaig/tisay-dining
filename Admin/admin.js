import { db } from "../firebase-config.js";
import { collection, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const logoutBtn = document.getElementById("logoutBtn");

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

async function fetchRegisteredUsersCount() {
  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    const countEl = document.getElementById("visitorCount");
    if (countEl) {
      countEl.textContent = querySnapshot.size.toLocaleString();
    }
  } catch (e) {
    console.error("Error fetching users count:", e);
  }
}

fetchRegisteredUsersCount();

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const totalRevenueEl = document.getElementById("totalRevenue");
const totalBuyersEl = document.getElementById("totalBuyers");
const subtitleEl = document.getElementById("analyticsSubtitle");
const chartEl = document.getElementById("chart");
const svgEl = document.getElementById("chartSvg");
const tipEl = document.getElementById("chartTip");
const emptyEl = document.getElementById("chartEmpty");
const filterBtns = document.querySelectorAll(".filter-btn");

const margin = { top: 16, right: 14, bottom: 32, left: 56 };

let cachedOrders = [];
let currentFilter = "week";
let series = [];
let geometry = null;

function money(value) {
  return "₱" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function compactMoney(value) {
  if (value >= 1000000) return "₱" + +(value / 1000000).toFixed(1) + "M";
  if (value >= 1000) return "₱" + +(value / 1000).toFixed(1) + "k";
  return "₱" + value;
}

function orderTotal(order) {
  return parseFloat(String(order.total || "").replace(/[^\d.]/g, "")) || 0;
}

function orderDate(order) {
  if (order.createdAt && typeof order.createdAt.toDate === "function") return order.createdAt.toDate();
  if (order.timestamp) return new Date(order.timestamp);
  return new Date();
}

function dayKey(date) {
  return date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate();
}

function buildSeries(type) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const accepted = cachedOrders.filter((order) => order.status === "Accepted");
  let buckets = [];
  let subtitle = "";

  if (type === "week") {
    subtitle = "Last 7 days, by day";
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      buckets.push({
        key: dayKey(date),
        axis: WEEKDAYS[date.getDay()].slice(0, 3),
        title: WEEKDAYS[date.getDay()] + ", " + MONTHS[date.getMonth()].slice(0, 3) + " " + date.getDate(),
        future: false,
        revenue: 0,
        buyers: 0
      });
    }
  } else if (type === "month") {
    subtitle = MONTHS[today.getMonth()] + " " + today.getFullYear() + ", by day";
    const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const date = new Date(today.getFullYear(), today.getMonth(), d);
      buckets.push({
        key: dayKey(date),
        axis: String(d),
        title: WEEKDAYS[date.getDay()] + ", " + MONTHS[date.getMonth()].slice(0, 3) + " " + d,
        future: date > today,
        revenue: 0,
        buyers: 0
      });
    }
  } else {
    subtitle = today.getFullYear() + ", by month";
    for (let m = 0; m < 12; m++) {
      buckets.push({
        key: today.getFullYear() + "-" + m,
        axis: MONTHS[m].slice(0, 3),
        title: MONTHS[m] + " " + today.getFullYear(),
        future: m > today.getMonth(),
        revenue: 0,
        buyers: 0
      });
    }
  }

  const lookup = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  accepted.forEach((order) => {
    const date = orderDate(order);
    const key = type === "year" ? date.getFullYear() + "-" + date.getMonth() : dayKey(date);
    const bucket = lookup.get(key);
    if (!bucket) return;
    bucket.revenue += orderTotal(order);
    bucket.buyers += 1;
  });

  return { buckets, subtitle };
}

function niceStep(raw) {
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const base = raw / power;
  const nice = base <= 1 ? 1 : base <= 2 ? 2 : base <= 2.5 ? 2.5 : base <= 5 ? 5 : 10;
  return nice * power;
}

function linePath(points) {
  return points
    .map((point, index) => (index ? "L" : "M") + point.x.toFixed(1) + " " + point.y.toFixed(1))
    .join(" ");
}

function draw() {
  const width = chartEl.clientWidth;
  const height = chartEl.clientHeight;
  if (!width || !series.length) return;

  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const count = series.length;
  const stepX = plotW / (count - 1);
  const maxValue = Math.max(...series.map((item) => item.revenue), 0);
  const step = niceStep((maxValue || 400) / 4);
  const yMax = step * 4;
  const baseY = margin.top + plotH;

  const xAt = (index) => margin.left + index * stepX;
  const yAt = (value) => margin.top + plotH - (value / yMax) * plotH;

  const points = [];
  series.forEach((item, index) => {
    if (!item.future) points.push({ x: xAt(index), y: yAt(item.revenue), index });
  });

  let grid = "";
  for (let i = 0; i <= 4; i++) {
    const value = step * i;
    const y = yAt(value);
    grid += `<line class="grid-line${i === 0 ? " base" : ""}" x1="${margin.left}" x2="${width - margin.right}" y1="${y}" y2="${y}"></line>`;
    grid += `<text class="axis-label y" x="${margin.left - 10}" y="${y + 4}">${compactMoney(value)}</text>`;
  }

  const labelStep = Math.max(1, Math.ceil(count / Math.max(1, Math.floor(plotW / 54))));
  let labels = "";
  series.forEach((item, index) => {
    if (index % labelStep !== 0) return;
    labels += `<text class="axis-label x" x="${xAt(index)}" y="${height - 8}">${item.axis}</text>`;
  });

  const line = linePath(points);
  const area = line + ` L${points[points.length - 1].x.toFixed(1)} ${baseY} L${points[0].x.toFixed(1)} ${baseY} Z`;

  let dots = "";
  if (count <= 12) {
    points.forEach((point) => {
      dots += `<circle class="point" cx="${point.x}" cy="${point.y}" r="4"></circle>`;
    });
  }

  svgEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svgEl.innerHTML = `
    <defs>
      <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.16"></stop>
        <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"></stop>
      </linearGradient>
    </defs>
    ${grid}
    ${labels}
    <path class="series-area" d="${area}"></path>
    <path class="series-line" d="${line}"></path>
    ${dots}
    <line class="guide" id="guide" y1="${margin.top}" y2="${baseY}" visibility="hidden"></line>
    <circle class="hover-dot" id="hoverDot" r="5" visibility="hidden"></circle>`;

  geometry = { width, height, stepX, xAt, yAt, lastIndex: points[points.length - 1].index };
}

function hideTip() {
  tipEl.hidden = true;
  const guide = document.getElementById("guide");
  const dot = document.getElementById("hoverDot");
  if (guide) guide.setAttribute("visibility", "hidden");
  if (dot) dot.setAttribute("visibility", "hidden");
}

function showTip(clientX) {
  if (!geometry) return;
  const rect = chartEl.getBoundingClientRect();
  const raw = Math.round((clientX - rect.left - margin.left) / geometry.stepX);
  const index = Math.min(Math.max(raw, 0), geometry.lastIndex);
  const item = series[index];
  if (!item) return;

  const x = geometry.xAt(index);
  const y = geometry.yAt(item.revenue);
  const guide = document.getElementById("guide");
  const dot = document.getElementById("hoverDot");

  guide.setAttribute("x1", x);
  guide.setAttribute("x2", x);
  guide.setAttribute("visibility", "visible");
  dot.setAttribute("cx", x);
  dot.setAttribute("cy", y);
  dot.setAttribute("visibility", "visible");

  tipEl.innerHTML = `<span>${item.title}</span><strong>${money(item.revenue)}</strong><span>${item.buyers} ${item.buyers === 1 ? "buyer" : "buyers"}</span>`;
  tipEl.hidden = false;
  const half = tipEl.offsetWidth / 2;
  tipEl.style.left = Math.min(Math.max(x, half + 4), geometry.width - half - 4) + "px";
  tipEl.style.top = Math.max(y - 14, tipEl.offsetHeight + 4) + "px";
}

function render(type) {
  currentFilter = type;
  const { buckets, subtitle } = buildSeries(type);
  series = buckets;

  const totalRevenue = buckets.reduce((sum, item) => sum + item.revenue, 0);
  const totalBuyers = buckets.reduce((sum, item) => sum + item.buyers, 0);

  totalRevenueEl.textContent = money(totalRevenue);
  totalBuyersEl.textContent = totalBuyers.toLocaleString();
  subtitleEl.textContent = subtitle;
  emptyEl.hidden = totalRevenue > 0;

  hideTip();
  draw();
}

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((item) => item.classList.remove("active"));
    btn.classList.add("active");
    render(btn.dataset.filter);
  });
});

chartEl.addEventListener("pointermove", (event) => showTip(event.clientX));
chartEl.addEventListener("pointerleave", hideTip);

new ResizeObserver(() => {
  hideTip();
  draw();
}).observe(chartEl);

onSnapshot(
  collection(db, "orders"),
  (snapshot) => {
    cachedOrders = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    render(currentFilter);
  },
  (error) => {
    console.error("Firestore orders analytics snapshot error:", error);
  }
);

render("week");