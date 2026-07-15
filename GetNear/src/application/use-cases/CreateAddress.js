import { validateAddressInput } from '../../domain/address';

export class CreateAddress {
  constructor({ addressRepository }) {
    this.addressRepository = addressRepository;
  }

  async execute(userId, input) {
    if (!userId) throw new Error('Login required');
    const errors = validateAddressInput(input);
    if (errors.length) throw new Error(errors[0]);

    const existing = await this.addressRepository.listByUserId(userId);
    const payload = {
      ...input,
      isDefault: existing.length === 0 ? true : Boolean(input.isDefault),
    };

    return this.addressRepository.create(userId, payload);
  }
}
