export class ListPendingApplications {
  constructor({ partnerRepository }) {
    this.partnerRepository = partnerRepository;
  }

  async execute() {
    return this.partnerRepository.listPending();
  }
}
