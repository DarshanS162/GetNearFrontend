import { validateAddressInput } from '../../domain/address';

export class UpdateAddress {
  constructor({ addressRepository }) {
    this.addressRepository = addressRepository;
  }

  async execute(userId, addressId, input) {
    if (!userId) throw new Error('Login required');
    const errors = validateAddressInput(input);
    if (errors.length) throw new Error(errors[0]);
    return this.addressRepository.update(userId, addressId, input);
  }
}
