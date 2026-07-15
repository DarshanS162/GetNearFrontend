export class ListAddresses {
  /** @param {{ addressRepository: import('../ports/AddressRepositoryPort').AddressRepositoryPort }} deps */
  constructor({ addressRepository }) {
    this.addressRepository = addressRepository;
  }

  async execute(userId) {
    if (!userId) throw new Error('Login required');
    return this.addressRepository.listByUserId(userId);
  }
}
