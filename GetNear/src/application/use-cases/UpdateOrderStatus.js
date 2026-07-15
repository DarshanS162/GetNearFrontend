import {
  canTransitionOrderStatus,
  ORDER_STATUS,
} from '../../domain/orderStatus';

export class UpdateOrderStatus {
  constructor({ orderRepository }) {
    this.orderRepository = orderRepository;
  }

  async execute({ orderId, nextStatus, cancelledReason = '' }) {
    if (!orderId) throw new Error('Order id is required');
    if (!nextStatus) throw new Error('Status is required');

    const current = await this.orderRepository.findById(orderId);
    if (!current) throw new Error('Order not found');

    if (!canTransitionOrderStatus(current.orderStatus, nextStatus)) {
      throw new Error(
        `Cannot move order from ${current.orderStatus} to ${nextStatus}`,
      );
    }

    const extra = {};
    if (nextStatus === ORDER_STATUS.CANCELLED) {
      extra.cancelled_reason = cancelledReason || 'Cancelled by restaurant';
    }
    if (nextStatus === ORDER_STATUS.DELIVERED && current.paymentMethod === 'cod') {
      extra.payment_status = 'paid';
    }

    return this.orderRepository.updateStatus(orderId, nextStatus, extra);
  }
}
