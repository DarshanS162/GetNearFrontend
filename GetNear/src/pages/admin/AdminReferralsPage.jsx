import { useCallback, useEffect, useState } from 'react';
import { couponUseCases, referralUseCases } from '../../application/container';
import '../../components/admin/CouponManager.css';

function localDate(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const initialForm = {
  name: 'Share & Earn',
  referrerCouponId: '',
  referredCouponId: '',
  rewardType: 'coupon',
  rewardValue: '0',
  validFrom: localDate(new Date()),
  validUntil: '',
  isActive: true,
};

export default function AdminReferralsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [campaignRows, referralRows, couponRows] = await Promise.all([
        referralUseCases.manage.listCampaigns(),
        referralUseCases.manage.listReferrals(),
        couponUseCases.manage.list({ ownerType: 'platform' }),
      ]);
      setCampaigns(campaignRows);
      setReferrals(referralRows);
      setCoupons(couponRows);
    } catch (err) {
      setError(err.message || 'Could not load referrals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function save(event) {
    event.preventDefault();
    setError('');
    try {
      await referralUseCases.manage.saveCampaign({
        ...form,
        validFrom: new Date(form.validFrom).toISOString(),
        validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : '',
      });
      setFormOpen(false);
      setForm(initialForm);
      await refresh();
    } catch (err) {
      setError(err.message || 'Could not save campaign');
    }
  }

  return (
    <div>
      <div className="admin-page-header coupon-page-header">
        <div>
          <h1>Referrals</h1>
          <p>Reward only after the referred customer’s first delivered order.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)}>
          Create campaign
        </button>
      </div>

      {error && <div className="coupon-alert">{error}</div>}
      {loading && <p>Loading referrals…</p>}

      {!loading && (
        <>
          <h2 className="admin-section-title">Campaigns</h2>
          <div className="coupon-grid" style={{ marginBottom: 32 }}>
            {campaigns.map((campaign) => (
              <article className="card coupon-admin-card" key={campaign.id}>
                <div className="coupon-admin-top">
                  <h3>{campaign.name}</h3>
                  <span className={`badge ${campaign.is_active ? 'badge-success' : ''}`}>
                    {campaign.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p>
                  Referrer: {campaign.referrer_coupon?.code || campaign.reward_type}
                  {campaign.referred_coupon?.code
                    ? ` · New user: ${campaign.referred_coupon.code}`
                    : ''}
                </p>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={async () => {
                    await referralUseCases.manage.setCampaignActive(
                      campaign.id,
                      !campaign.is_active,
                    );
                    await refresh();
                  }}
                >
                  {campaign.is_active ? 'Disable' : 'Enable'}
                </button>
              </article>
            ))}
          </div>

          <h2 className="admin-section-title">Referral status</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Referrer</th>
                  <th>New customer</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((referral) => (
                  <tr key={referral.id}>
                    <td>{referral.referrer?.full_name || referral.referrer?.phone}</td>
                    <td>{referral.referred?.full_name || referral.referred?.phone}</td>
                    <td><span className="coupon-code">{referral.referral_code}</span></td>
                    <td>{referral.status.replaceAll('_', ' ')}</td>
                    <td>{new Date(referral.registered_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {referrals.length === 0 && <div className="coupon-empty">No referrals yet.</div>}
          </div>
        </>
      )}

      {formOpen && (
        <div className="modal-overlay" onClick={() => setFormOpen(false)}>
          <div className="modal coupon-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Create referral campaign</h2>
              <button type="button" onClick={() => setFormOpen(false)}>×</button>
            </div>
            <form onSubmit={save}>
              <div className="coupon-form-grid">
                <label>
                  Campaign name
                  <input className="form-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                </label>
                <label>
                  Referrer reward coupon
                  <select className="form-input" value={form.referrerCouponId} onChange={(event) => setForm({ ...form, referrerCouponId: event.target.value })} required>
                    <option value="">Select coupon</option>
                    {coupons.map((coupon) => <option key={coupon.id} value={coupon.id}>{coupon.code}</option>)}
                  </select>
                </label>
                <label>
                  New-user welcome coupon (optional)
                  <select className="form-input" value={form.referredCouponId} onChange={(event) => setForm({ ...form, referredCouponId: event.target.value })}>
                    <option value="">No welcome reward</option>
                    {coupons.map((coupon) => <option key={coupon.id} value={coupon.id}>{coupon.code}</option>)}
                  </select>
                </label>
                <label>
                  Starts
                  <input className="form-input" type="datetime-local" value={form.validFrom} onChange={(event) => setForm({ ...form, validFrom: event.target.value })} required />
                </label>
                <label>
                  Ends
                  <input className="form-input" type="datetime-local" value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} />
                </label>
              </div>
              <label className="coupon-switches">
                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save campaign</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
