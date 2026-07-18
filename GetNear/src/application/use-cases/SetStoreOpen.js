export class SetStoreOpen {
  constructor({ partnerRepository }) {
    this.partnerRepository = partnerRepository;
  }

  async execute(restaurantId, isOpen) {
    if (!restaurantId) throw new Error('Restaurant not linked');
    return this.partnerRepository.setStoreOpen(restaurantId, isOpen);
  }
}
