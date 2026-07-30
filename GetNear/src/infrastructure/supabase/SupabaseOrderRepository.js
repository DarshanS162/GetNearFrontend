import { mapOrder } from '../../domain/order';

const ORDER_SELECT = `
  *,
  order_items (*),
  addresses (*),
  restaurants ( name )
`;

/** Strip handover PIN before mapping — owners must not receive it over the wire. */
function stripDeliveryPin(row) {
  if (!row) return row;
  const { delivery_pin: _pin, ...rest } = row;
  return { ...rest, delivery_pin: null };
}

/**
 * Order infrastructure adapter — NestJS-portable interface.
 * @implements {import('../../application/ports/OrderRepositoryPort').OrderRepositoryPort}
 */
export class SupabaseOrderRepository {
  /** @param {import('@supabase/supabase-js').SupabaseClient} client */
  constructor(client) {
    this.client = client;
  }

  async createWithItems({ orderRow, items, paymentRow, couponCode = '' }) {
    const { data: order, error: orderError } = await this.client
      .from('orders')
      .insert(orderRow)
      .select('id, order_number')
      .single();

    if (orderError) throw orderError;

    const itemRows = items.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      product_name: item.productName,
      food_type: item.foodType || 'veg',
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
    }));

    const { error: itemsError } = await this.client
      .from('order_items')
      .insert(itemRows);

    if (itemsError) {
      await this.client.rpc('rollback_placed_order', { p_order_id: order.id });
      throw itemsError;
    }

    if (couponCode) {
      const { error: couponError } = await this.client.rpc(
        'redeem_coupon_for_order',
        {
          p_order_id: order.id,
          p_code: couponCode,
        },
      );
      if (couponError) {
        await this.client.rpc('rollback_placed_order', { p_order_id: order.id });
        throw couponError;
      }
    }

    if (paymentRow) {
      const { error: payError } = await this.client.from('payments').insert({
        ...paymentRow,
        order_id: order.id,
      });
      if (payError) {
        await this.client.rpc('rollback_placed_order', { p_order_id: order.id });
        throw new Error('Could not record payment. Please try again.');
      }
    }

    return this.findById(order.id, { includePin: true });
  }

  async findById(id, { includePin = false } = {}) {
    const { data, error } = await this.client
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const mapped = mapOrder(stripDeliveryPin(data));
    if (includePin) {
      mapped.deliveryPin = (await this.fetchMyDeliveryPin(id)) || '';
    }
    return mapped;
  }

  async findByOrderNumber(orderNumber, { includePin = false } = {}) {
    const { data, error } = await this.client
      .from('orders')
      .select(ORDER_SELECT)
      .eq('order_number', orderNumber)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const mapped = mapOrder(stripDeliveryPin(data));
    if (includePin) {
      mapped.deliveryPin = (await this.fetchMyDeliveryPin(mapped.id)) || '';
    }
    return mapped;
  }

  async fetchMyDeliveryPin(orderId) {
    const { data, error } = await this.client.rpc('get_my_order_delivery_pin', {
      p_order_id: orderId,
    });
    if (error) {
      // Migration may not be applied yet — fall back silently.
      return '';
    }
    return data || '';
  }

  async listByCustomerId(customerId) {
    const { data, error } = await this.client
      .from('orders')
      .select(ORDER_SELECT)
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .order('placed_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((row) => mapOrder(stripDeliveryPin(row)));
  }

  async listByRestaurantId(restaurantId) {
    const { data, error } = await this.client
      .from('orders')
      .select(ORDER_SELECT)
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null)
      .order('placed_at', { ascending: false });

    if (error) throw error;
    // Never expose handover PIN to restaurant owners in list payloads.
    return (data || []).map((row) => mapOrder(stripDeliveryPin(row)));
  }

  async advanceStatus({ orderId, nextStatus, cancelledReason = '', deliveryPin = '' }) {
    const { data, error } = await this.client.rpc('advance_order_status', {
      p_order_id: orderId,
      p_next_status: nextStatus,
      p_cancelled_reason: cancelledReason || null,
      p_delivery_pin: deliveryPin || null,
    });

    if (error) throw error;

    // RPC returns orders row without joins — reload full aggregate without PIN.
    return this.findById(orderId, { includePin: false });
  }

  /** @deprecated Prefer advanceStatus — direct updates are blocked in DB. */
  async updateStatus(orderId, orderStatus, extra = {}) {
    return this.advanceStatus({
      orderId,
      nextStatus: orderStatus,
      cancelledReason: extra.cancelled_reason || '',
      deliveryPin: extra.delivery_pin || '',
    });
  }
}
