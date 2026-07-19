export class ManageReferrals {
  constructor({ referralRepository }) {
    this.referralRepository = referralRepository;
  }

  claim(code) {
    if (!String(code || '').trim()) throw new Error('Enter a referral code');
    return this.referralRepository.claim(code);
  }

  getMyProfile(userId) {
    if (!userId) throw new Error('Login required');
    return this.referralRepository.getMyReferralProfile(userId);
  }

  listCampaigns() {
    return this.referralRepository.listCampaigns();
  }

  listReferrals() {
    return this.referralRepository.listReferrals();
  }

  saveCampaign(input) {
    if (String(input.name || '').trim().length < 3) {
      throw new Error('Campaign name is required');
    }
    if (input.rewardType === 'coupon' && !input.referrerCouponId) {
      throw new Error('Select the referrer reward coupon');
    }
    return this.referralRepository.saveCampaign(input);
  }

  setCampaignActive(id, isActive) {
    return this.referralRepository.setCampaignActive(id, isActive);
  }
}
