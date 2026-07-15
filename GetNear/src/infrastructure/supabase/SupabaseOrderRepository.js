import { mapOrder } from '../../domain/order';

const ORDER_SELECT = `
  *,
  order_items (*),
  addresses (*),
  restaurants ( name )
`;

/**
 * Order infrastructure adapter — NestJS-portable interface.
 * @implements {import('../../application/ports/OrderRepositoryPort').OrderRepositoryPort}
 */
export class SupabaseOrderRepository {
  /** @param {import('@supabase/supabase-js').SupabaseClient} client */
  constructor(client) {
    this.client = client;
  }

  async createWithItems({ orderRow, items, paymentRow }) {
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
      await this.client.from('orders').delete().eq('id', order.id);
      throw itemsError;
    }

    if (paymentRow) {
      const { error: payError } = await this.client.from('payments').insert({
        ...paymentRow,
        order_id: order.id,
      });
      if (payError) {
        console.warn('payment insert failed:', payError.message);
      }
    }

    return this.findById(order.id);
  }

  async findById(id) {
    const { data, error } = await this.client
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    return mapOrder(data);
  }

  async findByOrderNumber(orderNumber) {
    const { data, error } = await this.client
      .from('orders')
      .select(ORDER_SELECT)
      .eq('order_number', orderNumber)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    return mapOrder(data);
  }

  async listByCustomerId(customerId) {
    const { data, error } = await this.client
      .from('orders')
      .select(ORDER_SELECT)
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .order('placed_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapOrder);
  }

  async listByRestaurantId(restaurantId) {
    const { data, error } = await this.client
      .from('orders')
      .select(ORDER_SELECT)
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null)
      .order('placed_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapOrder);
  }

  async updateStatus(orderId, orderStatus, extra = {}) {
    const { data, error } = await this.client
      .from('orders')
      .update({
        order_status: orderStatus,
        ...extra,
      })
      .eq('id', orderId)
      .is('deleted_at', null)
      .select(ORDER_SELECT)
      .single();

    if (error) throw error;
    return mapOrder(data);
  }
}
