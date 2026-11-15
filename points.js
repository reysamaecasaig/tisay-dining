import {
  doc,
  collection,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const POINT_COSTS = { Foods: 150, Desserts: 100, Drinks: 50 };
export const REFUND_STATUSES = ["Rejected", "Declined", "Cancelled", "Canceled"];

const inFlight = new Set();

export function normalizeCategory(value) {
  const key = String(value || "").trim().toLowerCase();
  if (key === "foods" || key === "food" || key === "main course") return "Foods";
  if (key === "desserts" || key === "dessert") return "Desserts";
  if (key === "drinks" || key === "drink" || key === "beverage" || key === "beverages") return "Drinks";
  return "";
}

export function countDishes(items) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
}

export async function placeOrder(db, uid, order) {
  const userRef = doc(db, "users", uid);
  const orderRef = doc(collection(db, "orders"));

  await runTransaction(db, async (tx) => {
    if (order.pointsUsed > 0) {
      const snap = await tx.get(userRef);
      const balance = snap.exists() ? Number(snap.data().points) || 0 : 0;
      if (balance < order.pointsUsed) throw new Error("INSUFFICIENT_POINTS");
      tx.set(userRef, { points: balance - order.pointsUsed }, { merge: true });
    }

    tx.set(orderRef, {
      ...order,
      uid: uid,
      status: "Pending",
      pointsAwarded: false,
      createdAt: serverTimestamp()
    });
  });

  return orderRef.id;
}

export async function awardOrderPoints(db, orderId) {
  const orderRef = doc(db, "orders", orderId);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists()) return 0;

    const order = snap.data();
    if (order.status !== "Accepted" || order.pointsAwarded || !order.uid) return 0;

    const earned = countDishes(order.items);
    tx.set(doc(db, "users", order.uid), { points: increment(earned) }, { merge: true });
    tx.update(orderRef, { pointsAwarded: true, pointsEarned: earned });
    return earned;
  });
}

export async function refundOrderPoints(db, orderId) {
  const orderRef = doc(db, "orders", orderId);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists()) return 0;

    const order = snap.data();
    const used = Number(order.pointsUsed) || 0;
    if (!REFUND_STATUSES.includes(order.status) || !used || order.pointsRefunded || !order.uid) return 0;

    tx.set(doc(db, "users", order.uid), { points: increment(used) }, { merge: true });
    tx.update(orderRef, { pointsRefunded: true });
    return used;
  });
}

export async function syncOrderDoc(db, orderId, order) {
  const needsAward = order.status === "Accepted" && !order.pointsAwarded;
  const needsRefund =
    REFUND_STATUSES.includes(order.status) && Number(order.pointsUsed) > 0 && !order.pointsRefunded;

  if (!needsAward && !needsRefund) return;
  if (inFlight.has(orderId)) return;

  inFlight.add(orderId);
  try {
    if (needsAward) await awardOrderPoints(db, orderId);
    if (needsRefund) await refundOrderPoints(db, orderId);
  } catch (error) {
    console.error("Points sync failed for order " + orderId, error);
  } finally {
    inFlight.delete(orderId);
  }
}

export async function syncUserOrders(db, uid) {
  try {
    const snapshot = await getDocs(query(collection(db, "orders"), where("uid", "==", uid)));
    await Promise.all(snapshot.docs.map((docSnap) => syncOrderDoc(db, docSnap.id, docSnap.data())));
  } catch (error) {
    console.error("Could not sync order points", error);
  }
}