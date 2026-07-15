export class GetOrder {
  constructor({ orderRepository }) {
    this.orderRepository = orderRepository;
  }

  async execute({ id, orderNumber }) {
    if (orderNumber) {
      return this.orderRepository.findByOrderNumber(orderNumber);
    }
    if (id) {
      return this.orderRepository.findById(id);
    }
    throw new Error('Order id is required');
  }
}
