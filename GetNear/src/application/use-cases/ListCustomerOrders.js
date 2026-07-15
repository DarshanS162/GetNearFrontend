export class ListCustomerOrders {
  constructor({ orderRepository }) {
    this.orderRepository = orderRepository;
  }

  async execute(customerId) {
    if (!customerId) throw new Error('Login required');
    return this.orderRepository.listByCustomerId(customerId);
  }
}
