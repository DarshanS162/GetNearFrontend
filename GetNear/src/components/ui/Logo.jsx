export function Logo({ size = 'md' }) {
  const fontSize = size === 'sm' ? 20 : 24;
  return (
    <div className="logo" style={{ fontSize }}>
      <svg
        width={size === 'sm' ? 28 : 32}
        height={size === 'sm' ? 28 : 32}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="16" cy="14" r="10" fill="#FF6B35" opacity="0.15" />
        <path
          d="M16 6C11.58 6 8 9.58 8 14c0 6 8 12 8 12s8-6 8-12c0-4.42-3.58-8-8-8z"
          fill="#FF6B35"
        />
        <circle cx="16" cy="14" r="3" fill="white" />
      </svg>
      <span className="logo-text">
        <span className="logo-get">Get</span>
        <span className="logo-near">Near</span>
      </span>
      <style>{`
        .logo { display: flex; align-items: center; gap: 8px; }
        .logo-text { font-family: var(--font-heading); font-weight: 700; letter-spacing: -0.02em; }
        .logo-get { color: var(--color-text); }
        .logo-near { color: var(--color-primary); }
      `}</style>
    </div>
  );
}
