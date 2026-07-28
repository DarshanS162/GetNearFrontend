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

function mapDeliverySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  return mapAddress({
    id: null,
    user_id: null,
    label: snapshot.label,
    full_name: snapshot.full_name,
    phone: snapshot.phone,
    address_line1: snapshot.address_line1,
    address_line2: snapshot.address_line2,
    landmark: snapshot.landmark,
    city: snapshot.city,
    state: snapshot.state,
    pincode: snapshot.pincode,
    country: snapshot.country,
    formatted_address: snapshot.formatted_address,
    latitude: snapshot.latitude,
    longitude: snapshot.longitude,
    is_default: false,
    created_at: null,
  });
}

export function mapOrder(row) {
  if (!row) return null;
  const items = Array.isArray(row.order_items)
    ? row.order_items.map(mapOrderItem).filter(Boolean)
    : [];
  const liveAddress = row.addresses ? mapAddress(row.addresses) : null;
  const snapshotAddress = mapDeliverySnapshot(row.delivery_snapshot);
  const address = snapshotAddress || liveAddress;

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
    deliveryDistanceM:
      row.delivery_distance_m != null ? Number(row.delivery_distance_m) : null,
    items,
    address,
    addressLine: address ? formatAddressLine(address) : '',
    restaurantName: row.restaurants?.name || '',
  };
}
