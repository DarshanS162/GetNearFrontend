import {
  canTransitionOrderStatus,
  ORDER_STATUS,
} from '../../domain/orderStatus';
import { mapRlsError } from '../../infrastructure/supabase/resolveAppUserId';

export class UpdateOrderStatus {
  constructor({ orderRepository }) {
    this.orderRepository = orderRepository;
  }

  async execute({ orderId, nextStatus, cancelledReason = '', deliveryPin = '' }) {
    if (!orderId) throw new Error('Order id is required');
    if (!nextStatus) throw new Error('Status is required');

    try {
      const current = await this.orderRepository.findById(orderId, {
        includePin: false,
      });
      if (!current) throw new Error('Order not found');

      if (!canTransitionOrderStatus(current.orderStatus, nextStatus)) {
        throw new Error(
          `Cannot move order from ${current.orderStatus} to ${nextStatus}`,
        );
      }

      if (
        nextStatus === ORDER_STATUS.CANCELLED &&
        !String(cancelledReason || '').trim()
      ) {
        cancelledReason = 'Cancelled by restaurant';
      }

      if (nextStatus === ORDER_STATUS.DELIVERED) {
        const provided = String(deliveryPin || '').trim();
        if (!/^\d{4}$/.test(provided)) {
          throw new Error('Enter the 4-digit delivery code from the customer');
        }
      }

      return await this.orderRepository.advanceStatus({
        orderId,
        nextStatus,
        cancelledReason,
        deliveryPin,
      });
    } catch (err) {
      throw mapRlsError(err);
    }
  }
}
