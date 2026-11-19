import { doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const REFUND_STATUSES = ["Rejected", "Cancelled", "Canceled", "Declined"];

export const REWARD_COSTS = {
  food: 150,
  dessert: 100,
  drink: 50
};

export function normalizeCategory(category) {
  const val = String(category || "").trim().toLowerCase();
  if (val === "foods" || val === "food" || val === "main course") return "Foods";
  if (val === "desserts" || val === "dessert") return "Desserts";
  if (val === "drinks" || val === "drink") return "Drinks";
  return category || "Foods";
}

export function countDishes(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((total, item) => {
    const qty = Number(item && item.qty ? item.qty : 1);
    return total + (Number.isFinite(qty) && qty > 0 ? qty : 1);
  }, 0);
}

export async function syncOrderDoc(db, orderId, order) {
  if (!db || !orderId || !order || !order.uid) return;

  const status = String(order.status || "Pending");
  const dishes = countDishes(order.items);
  const pointsToAward = Number(order.pointsEarned) > 0 ? Number(order.pointsEarned) : dishes;
  const pointsUsed = Math.max(0, Number(order.pointsUsed) || 0);
  const isRefundedStatus = REFUND_STATUSES.includes(status);

  const alreadyAwarded = order.pointsAwarded === true;
  const alreadyRefunded = order.pointsRefunded === true;

  if (status === "Accepted" && alreadyAwarded) return;
  if (isRefundedStatus && (!pointsUsed || alreadyRefunded)) return;
  if (status !== "Accepted" && !isRefundedStatus) return;

  const orderRef = doc(db, "orders", orderId);
  const userRef = doc(db, "users", order.uid);

  try {
    await runTransaction(db, async (transaction) => {
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists()) return;

      const latestOrder = orderSnap.data();
      const latestStatus = String(latestOrder.status || "Pending");
      const latestDishes = countDishes(latestOrder.items);
      const latestEarned = Number(latestOrder.pointsEarned) > 0 ? Number(latestOrder.pointsEarned) : latestDishes;
      const latestUsed = Math.max(0, Number(latestOrder.pointsUsed) || 0);
      const latestRefundedStatus = REFUND_STATUSES.includes(latestStatus);

      const userSnap = await transaction.get(userRef);
      const currentPoints = userSnap.exists() ? Math.max(0, Number(userSnap.data().points) || 0) : 0;

      if (latestStatus === "Accepted" && latestOrder.pointsAwarded !== true) {
        transaction.set(
          userRef,
          {
            points: currentPoints + latestEarned,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
        transaction.update(orderRef, {
          pointsEarned: latestEarned,
          pointsAwarded: true,
          pointsAwardedAt: serverTimestamp()
        });
      } else if (latestRefundedStatus && latestUsed > 0 && latestOrder.pointsRefunded !== true) {
        transaction.set(
          userRef,
          {
            points: currentPoints + latestUsed,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
        transaction.update(orderRef, {
          pointsRefunded: true,
          pointsRefundedAt: serverTimestamp()
        });
      }
    });
  } catch (err) {
    console.error("Points sync error:", err);
  }
}

export async function redeemRewardPoints(db, uid, pointsCost, rewardLabel = "Reward") {
  const cost = Math.max(0, Number(pointsCost) || 0);
  if (!db || !uid || cost <= 0) {
    return { ok: false, message: "Invalid reward points cost." };
  }

  const userRef = doc(db, "users", uid);

  try {
    const result = await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const currentPoints = userSnap.exists() ? Math.max(0, Number(userSnap.data().points) || 0) : 0;

      if (currentPoints < cost) {
        return { ok: false, points: currentPoints, message: "Not enough points." };
      }

      const nextPoints = currentPoints - cost;
      transaction.set(
        userRef,
        {
          points: nextPoints,
          lastRedeemedReward: rewardLabel,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      return { ok: true, points: nextPoints, message: `Redeemed ${rewardLabel} for ${cost} pts!` };
    });

    return result;
  } catch (err) {
    console.error("Redeem reward error:", err);
    return { ok: false, message: "Could not redeem points." };
  }
}