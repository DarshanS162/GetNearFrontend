import logoImg from '../../assets/getnearlogo.svg';

export function Logo({ size = 'md' }) {
  const fontSize = size === 'sm' ? 20 : 24;
  const logoHeight = size === 'sm' ? 30 : 40;

  return (
    <div className="logo" style={{ fontSize }}>
      <img
        src={logoImg}
        alt=""
        aria-hidden="true"
        className="logo-img"
        style={{ height: logoHeight }}
      />
      <span className="logo-text">
        <span className="logo-get">Get</span>
        <span className="logo-near">Near</span>
      </span>
      <style>{`
        .logo { display: flex; align-items: center; gap: 4px; }
        .logo-img { width: auto; display: block; flex-shrink: 0; }
        .logo-text { font-family: var(--font-heading); font-weight: 700; letter-spacing: -0.02em; }
        .logo-get { color: var(--color-text); }
        .logo-near { color: var(--color-primary); }
      `}</style>
    </div>
  );
}
