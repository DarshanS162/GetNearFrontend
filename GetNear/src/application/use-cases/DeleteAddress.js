export class DeleteAddress {
  constructor({ addressRepository }) {
    this.addressRepository = addressRepository;
  }

  async execute(userId, addressId) {
    if (!userId) throw new Error('Login required');
    await this.addressRepository.softDelete(userId, addressId);
  }
}
