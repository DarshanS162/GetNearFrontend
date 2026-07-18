import { useCallback, useEffect, useState } from 'react';
import { partnerUseCases } from '../../application/container';
import { useCatalog } from '../../context/CatalogContext';
import { BUSINESS_STATUS_LABELS } from '../../domain/restaurant';

export default function AdminApplicationsPage() {
  const { refreshCatalog } = useCatalog();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [rejectReason, setRejectReason] = useState({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await partnerUseCases.listPending.execute();
      setApps(rows);
    } catch (err) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleApprove(id) {
    setBusyId(id);
    setError('');
    try {
      await partnerUseCases.approve.execute(id);
      await refreshCatalog();
      await refresh();
    } catch (err) {
      setError(err.message || 'Approve failed');
    } finally {
      setBusyId('');
    }
  }

  async function handleReject(id) {
    setBusyId(id);
    setError('');
    try {
      await partnerUseCases.reject.execute(id, rejectReason[id] || '');
      await refreshCatalog();
      await refresh();
    } catch (err) {
      setError(err.message || 'Reject failed');
    } finally {
      setBusyId('');
    }
  }

  return (
    <>
      <div className="admin-page-header">
        <h1>Partner applications</h1>
        <p>Review restaurant self-registrations before they go live.</p>
      </div>

      {error && (
        <div className="card" style={{ padding: 16, marginBottom: 16, color: '#ef4444' }}>
          {error}
        </div>
      )}

      {loading && <p style={{ color: 'var(--color-text-secondary)' }}>Loading…</p>}

      {!loading && apps.length === 0 && (
        <div className="card" style={{ padding: 24 }}>
          <p style={{ margin: 0 }}>No pending applications.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {apps.map((app) => (
          <div key={app.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
              <strong>{app.name}</strong>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: 13 }}>
                {BUSINESS_STATUS_LABELS[app.businessStatus] || app.businessStatus}
              </span>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 14 }}>
              {app.ownerName || 'Owner'} · {app.ownerPhone || app.contactPhone || '—'}
            </p>
            <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
              {app.location || 'No area'} · {app.type || 'Cuisine TBD'}
            </p>
            {app.description && (
              <p style={{ margin: '0 0 12px', fontSize: 13 }}>{app.description}</p>
            )}
            <input
              className="form-input"
              placeholder="Reject reason (optional)"
              value={rejectReason[app.id] || ''}
              onChange={(e) =>
                setRejectReason((prev) => ({ ...prev, [app.id]: e.target.value }))
              }
              style={{ marginBottom: 12 }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busyId === app.id}
                onClick={() => handleApprove(app.id)}
              >
                Approve & go live
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busyId === app.id}
                onClick={() => handleReject(app.id)}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
