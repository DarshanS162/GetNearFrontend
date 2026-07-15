import { ORDER_STATUS_LABELS } from './orderStatus';
import { mapAddress, formatAddressLine } from './address';

export function mapOrderItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    productName: row.product_name,
    foodType: row.food_type,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    totalPrice: Number(row.total_price),
  };
}

export function mapOrder(row) {
  if (!row) return null;
  const items = Array.isArray(row.order_items)
    ? row.order_items.map(mapOrderItem).filter(Boolean)
    : [];
  const address = row.addresses ? mapAddress(row.addresses) : null;

  return {
    id: row.id,
    orderNumber: row.order_number,
    restaurantId: row.restaurant_id,
    branchId: row.branch_id,
    customerId: row.customer_id,
    addressId: row.address_id,
    couponId: row.coupon_id,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    deliveryCharge: Number(row.delivery_charge),
    taxAmount: Number(row.tax_amount),
    grandTotal: Number(row.grand_total),
    paymentStatus: row.payment_status,
    orderStatus: row.order_status,
    statusLabel: ORDER_STATUS_LABELS[row.order_status] || row.order_status,
    paymentMethod: row.payment_method,
    customerNotes: row.customer_notes || '',
    cancelledReason: row.cancelled_reason || '',
    placedAt: row.placed_at,
    createdAt: row.created_at,
    items,
    address,
    addressLine: address ? formatAddressLine(address) : '',
    restaurantName: row.restaurants?.name || '',
  };
}
