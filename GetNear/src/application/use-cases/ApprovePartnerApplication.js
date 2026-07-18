export class ApprovePartnerApplication {
  constructor({ partnerRepository }) {
    this.partnerRepository = partnerRepository;
  }

  async execute(restaurantId) {
    if (!restaurantId) throw new Error('Restaurant id is required');
    return this.partnerRepository.approve(restaurantId);
  }
}
