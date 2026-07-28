import { IconLocation } from '../ui/Icons';

export function CurrentLocationButton({
  onClick,
  loading = false,
  disabled = false,
  label = 'Use current location',
}) {
  return (
    <button
      type="button"
      className="btn btn-secondary btn-full address-loc-btn"
      onClick={onClick}
      disabled={disabled || loading}
    >
      <IconLocation size={18} />
      <span>{loading ? 'Detecting location…' : label}</span>
    </button>
  );
}
