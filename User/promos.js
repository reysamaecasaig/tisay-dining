import { doc, runTransaction, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const WEEKLY_DISCOUNTS = [5, 10, 15, 20, 25];
export const CLAIM_DAYS = [1, 2, 3, 4, 5];
export const LIMITED_PROMO = {
  title: "Flash Deal",
  percent: 30,
  text: "off one order, valid this week only"
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const STATUS_LABEL = {
  claimed: "Claimed",
  missed: "Missed",
  current: "This week",
  upcoming: "Upcoming"
};

function mondayOf(date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day.getTime();
}

function randomBetween(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function computeState(data, now = new Date()) {
  const user = data || {};
  const needsStart = !Number(user.promoStart);
  const start = needsStart ? mondayOf(now) : Number(user.promoStart);
  const week = Math.max(1, Math.round((mondayOf(now) - start) / WEEK_MS) + 1);
  const claims = user.weeklyClaims || {};
  const size = WEEKLY_DISCOUNTS.length;
  const first = Math.floor((week - 1) / size) * size + 1;

  const weeks = WEEKLY_DISCOUNTS.map((percent, index) => {
    const number = first + index;
    let status = "upcoming";
    if (claims[number]) status = "claimed";
    else if (number < week) status = "missed";
    else if (number === week) status = "current";
    return { number, percent, status, isCurrent: number === week };
  });

  const claimOpen = CLAIM_DAYS.includes(now.getDay());
  const current = weeks.find((entry) => entry.isCurrent);
  const weeklyClaimable = Boolean(current) && current.status === "current" && claimOpen;

  const promo = user.limitedPromo;
  const needsPromo = !promo || typeof promo.week !== "number" || promo.week < week;
  let promoState = "hidden";
  if (!needsPromo && promo.week === week) promoState = promo.claimedAt ? "claimed" : "active";

  return { start, week, weeks, claimOpen, weeklyClaimable, promo: promoState, needsStart, needsPromo };
}

export function createPromoCenter(db, uid, ui, notify) {
  const userRef = doc(db, "users", uid);
  let data = {};
  let writing = false;

  function render(state) {
    ui.range.textContent = "Weeks " + state.weeks[0].number + " to " + state.weeks[state.weeks.length - 1].number;

    ui.list.innerHTML = state.weeks.map((week) => {
      let action = "";
      if (week.isCurrent && week.status === "current") {
        action = state.claimOpen
          ? '<button type="button" class="claim-btn" data-claim="weekly">Claim ' + week.percent + '% discount</button>'
          : '<button type="button" class="claim-btn" disabled>Available Monday to Friday</button>';
      }
      return '<li class="week-row ' + week.status + (week.isCurrent ? " now" : "") + '">' +
        '<div class="week-main"><span class="week-badge">Week ' + week.number + '</span>' +
        '<strong class="week-off">' + week.percent + '% OFF</strong>' +
        '<span class="week-chip">' + STATUS_LABEL[week.status] + '</span></div>' + action + '</li>';
    }).join("");

    if (state.promo === "hidden") {
      ui.limited.innerHTML = '<div class="promo-empty"><strong>Limited Time Promo</strong>' +
        '<p>No promo right now available, check again soon.</p></div>';
    } else {
      const claimed = state.promo === "claimed";
      ui.limited.innerHTML = '<div class="promo-offer"><span class="promo-tag">Limited Time</span>' +
        '<strong>' + LIMITED_PROMO.title + '</strong>' +
        '<p>' + LIMITED_PROMO.percent + '% ' + LIMITED_PROMO.text + '</p>' +
        (claimed
          ? '<button type="button" class="claim-btn" disabled>Claimed</button>'
          : '<button type="button" class="claim-btn" data-claim="promo">Claim promo</button>') +
        '</div>';
    }

    ui.dot.hidden = !(state.weeklyClaimable || state.promo === "active");
  }

  async function settle() {
    const state = computeState(data);

    if ((state.needsStart || state.needsPromo) && !writing) {
      writing = true;
      const patch = {};
      if (state.needsStart) patch.promoStart = state.start;
      if (state.needsPromo) {
        patch.limitedPromo = {
          week: state.week + randomBetween(data.limitedPromo ? 1 : 0, 3),
          claimedAt: null
        };
      }
      data = { ...data, ...patch };
      try {
        await setDoc(userRef, patch, { merge: true });
      } catch (error) {
        console.error("Could not save promo schedule", error);
      } finally {
        writing = false;
      }
    }

    render(computeState(data));
  }

  async function claimWeekly() {
    try {
      const claimed = await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        const state = computeState(snap.exists() ? snap.data() : {});
        const current = state.weeks.find((entry) => entry.isCurrent);
        if (!state.weeklyClaimable) return null;
        tx.set(userRef, { weeklyClaims: { [current.number]: Date.now() } }, { merge: true });
        return current;
      });
      notify(claimed
        ? "Week " + claimed.number + " discount claimed: " + claimed.percent + "% off"
        : "This discount can't be claimed right now.");
    } catch (error) {
      console.error("Weekly claim failed", error);
      notify("Could not claim the discount. Please try again.");
    }
  }

  async function claimPromo() {
    try {
      const claimed = await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        const fresh = snap.exists() ? snap.data() : {};
        const state = computeState(fresh);
        if (state.promo !== "active") return false;
        tx.set(userRef, { limitedPromo: { week: state.week, claimedAt: Date.now() } }, { merge: true });
        return true;
      });
      notify(claimed
        ? LIMITED_PROMO.title + " claimed: " + LIMITED_PROMO.percent + "% off"
        : "This promo is no longer available.");
    } catch (error) {
      console.error("Promo claim failed", error);
      notify("Could not claim the promo. Please try again.");
    }
  }

  function openModal() {
    settle();
    ui.modal.classList.add("show");
  }

  function closeModal() {
    ui.modal.classList.remove("show");
  }

  ui.button.addEventListener("click", openModal);
  ui.close.addEventListener("click", closeModal);
  ui.modal.addEventListener("click", (event) => {
    if (event.target === ui.modal) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
  ui.modal.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-claim]");
    if (!button) return;
    if (button.dataset.claim === "weekly") claimWeekly();
    if (button.dataset.claim === "promo") claimPromo();
  });

  setInterval(settle, 60000);

  return {
    update(userData) {
      data = userData || {};
      settle();
    }
  };
}