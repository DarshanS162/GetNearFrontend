export class GetOrder {
  constructor({ orderRepository }) {
    this.orderRepository = orderRepository;
  }

  async execute({ id, orderNumber }) {
    if (orderNumber) {
      return this.orderRepository.findByOrderNumber(orderNumber, { includePin: true });
    }
    if (id) {
      return this.orderRepository.findById(id, { includePin: true });
    }
    throw new Error('Order id is required');
  }
}
