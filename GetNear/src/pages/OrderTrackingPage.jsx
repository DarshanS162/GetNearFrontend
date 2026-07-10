import { Link, useParams } from 'react-router-dom';
import { IconBack, IconCheck, IconMap, IconPhone } from '../components/ui/Icons';
import './OrderTrackingPage.css';

const steps = [
  { id: 'placed', label: 'Placed' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready' },
  { id: 'delivery', label: 'Out for delivery' },
  { id: 'delivered', label: 'Delivered' },
];

export default function OrderTrackingPage() {
  const { id = 'GN2481' } = useParams();
  const activeIndex = 3;

  return (
    <div className="app-shell animate-in">
      <main className="page-container tracking-page">
        <div className="page-header">
          <Link to="/" className="back-btn" aria-label="Go back">
            <IconBack />
          </Link>
          <h1>Order #{id}</h1>
        </div>

        <div className="map-placeholder card">
          <IconMap />
          <span>Live map</span>
        </div>

        <div className="status-banner card">
          <strong>Out for delivery</strong>
          <span>Arriving in 8 min</span>
        </div>

        <div className="timeline card">
          {steps.map((step, index) => {
            let state = '';
            if (index < activeIndex) state = 'done';
            else if (index === activeIndex) state = 'active';

            return (
              <div key={step.id} className={`timeline-step ${state}`}>
                <div className="timeline-dot">
                  {state === 'done' ? <IconCheck /> : index === 3 ? '🛵' : index + 1}
                </div>
                <span className="timeline-label">{step.label}</span>
              </div>
            );
          })}
        </div>

        <div className="partner-card card">
          <div className="partner-avatar">R</div>
          <div className="partner-info">
            <strong>Ramesh K.</strong>
            <span>Your delivery partner</span>
          </div>
          <button type="button" className="btn-icon" aria-label="Call delivery partner">
            <IconPhone size={18} />
          </button>
        </div>
      </main>
    </div>
  );
}
