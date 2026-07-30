export const BUSINESS_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING_APPROVAL: 'pending_approval',
  REJECTED: 'rejected',
};

export const BUSINESS_STATUS_LABELS = {
  [BUSINESS_STATUS.ACTIVE]: 'Active',
  [BUSINESS_STATUS.INACTIVE]: 'Inactive',
  [BUSINESS_STATUS.SUSPENDED]: 'Suspended',
  [BUSINESS_STATUS.PENDING_APPROVAL]: 'Pending approval',
  [BUSINESS_STATUS.REJECTED]: 'Rejected',
};

/** Customer catalog: approved stores (open or temporarily closed). */
export function isCustomerVisible(restaurant) {
  return restaurant?.businessStatus === BUSINESS_STATUS.ACTIVE;
}

/** True when the store can accept new orders right now.
 *  `scheduleOpen` optional: from operating_hours (null = unknown / ignore).
 */
export function isStoreOpen(restaurant, { scheduleOpen = null } = {}) {
  const base =
    restaurant?.businessStatus === BUSINESS_STATUS.ACTIVE &&
    restaurant?.isActive !== false;
  if (!base) return false;
  if (scheduleOpen === false) return false;
  return true;
}
