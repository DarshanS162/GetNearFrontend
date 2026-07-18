export class RejectPartnerApplication {
  constructor({ partnerRepository }) {
    this.partnerRepository = partnerRepository;
  }

  async execute(restaurantId, reason = '') {
    if (!restaurantId) throw new Error('Restaurant id is required');
    return this.partnerRepository.reject(restaurantId, reason);
  }
}
