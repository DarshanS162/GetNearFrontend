/** Domain constants + status machine (portable to NestJS domain layer). */

export const ORDER_STATUS = {
  PLACED: 'placed',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  READY: 'ready', // legacy — no longer used in owner flow
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

export const ORDER_STATUS_LABELS = {
  [ORDER_STATUS.PLACED]: 'Placed',
  [ORDER_STATUS.CONFIRMED]: 'Confirmed',
  [ORDER_STATUS.PREPARING]: 'Preparing',
  [ORDER_STATUS.READY]: 'Preparing', // legacy orders map to Preparing
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'Out for delivery',
  [ORDER_STATUS.DELIVERED]: 'Delivered',
  [ORDER_STATUS.CANCELLED]: 'Cancelled',
};

/** Customer-facing timeline (excludes cancelled). */
export const ORDER_TIMELINE = [
  ORDER_STATUS.PLACED,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
];

const OWNER_TRANSITIONS = {
  [ORDER_STATUS.PLACED]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.CANCELLED],
  // Allow legacy "ready" orders to continue without a Ready button
  [ORDER_STATUS.READY]: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

export function canTransitionOrderStatus(from, to) {
  return (OWNER_TRANSITIONS[from] || []).includes(to);
}

export function nextOwnerStatuses(from) {
  return OWNER_TRANSITIONS[from] || [];
}

export function getTimelineIndex(status) {
  if (status === ORDER_STATUS.CANCELLED) return -1;
  // Legacy ready → show as Preparing on customer timeline
  if (status === ORDER_STATUS.READY) {
    return ORDER_TIMELINE.indexOf(ORDER_STATUS.PREPARING);
  }
  const idx = ORDER_TIMELINE.indexOf(status);
  return idx >= 0 ? idx : 0;
}

/** Order still in progress (not delivered / cancelled). */
export function isActiveOrderStatus(status) {
  return (
    status === ORDER_STATUS.PLACED ||
    status === ORDER_STATUS.CONFIRMED ||
    status === ORDER_STATUS.PREPARING ||
    status === ORDER_STATUS.READY ||
    status === ORDER_STATUS.OUT_FOR_DELIVERY
  );
}

export function generateOrderNumber(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GN-${y}${m}${d}-${suffix}`;
}

/** 4-digit handover PIN for delivery verification (1000–9999). */
export function generateDeliveryPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}
