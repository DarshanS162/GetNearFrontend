export class UpdateOwnerStoreSettings {
  constructor({ partnerRepository }) {
    this.partnerRepository = partnerRepository;
  }

  async execute(restaurantId, patch) {
    if (!restaurantId) throw new Error('Restaurant not linked');
    if (!String(patch.name || '').trim()) throw new Error('Store name is required');
    return this.partnerRepository.updateStoreSettings(restaurantId, patch);
  }
}
