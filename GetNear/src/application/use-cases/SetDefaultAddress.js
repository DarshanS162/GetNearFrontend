export class SetDefaultAddress {
  constructor({ addressRepository }) {
    this.addressRepository = addressRepository;
  }

  async execute(userId, addressId) {
    if (!userId) throw new Error('Login required');
    return this.addressRepository.setDefault(userId, addressId);
  }
}
