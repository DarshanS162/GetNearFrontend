export class ListRestaurantOrders {
  constructor({ orderRepository }) {
    this.orderRepository = orderRepository;
  }

  async execute(restaurantId) {
    if (!restaurantId) throw new Error('Restaurant not linked');
    return this.orderRepository.listByRestaurantId(restaurantId);
  }
}
