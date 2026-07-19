import { normalizePhone } from '../../lib/utils';
import { notifyAdminsOfPartnerApplication } from '../../infrastructure/email/notifyAdminsOfPartnerApplication';

export class SubmitPartnerApplication {
  constructor({ partnerRepository }) {
    this.partnerRepository = partnerRepository;
  }

  async execute(input) {
    const restaurantName = String(input.restaurantName || '').trim();
    const ownerName = String(input.ownerName || '').trim();
    const phone = normalizePhone(input.phone);

    if (restaurantName.length < 2) throw new Error('Restaurant name is required');
    if (ownerName.length < 2) throw new Error('Owner name is required');
    if (phone.length !== 10) throw new Error('Valid 10-digit phone is required');

    const application = {
      restaurantName,
      ownerName,
      phone,
      location: String(input.location || '').trim(),
      cuisine: String(input.cuisine || '').trim(),
      description: String(input.description || '').trim(),
      gstNumber: String(input.gstNumber || '').trim(),
      fssaiNumber: String(input.fssaiNumber || '').trim(),
      contactEmail: String(input.contactEmail || '').trim(),
    };

    const restaurant = await this.partnerRepository.submitApplication(application);

    // Fire-and-forget — do not block / fail registration if mail fails
    void notifyAdminsOfPartnerApplication(application);

    return restaurant;
  }
}
