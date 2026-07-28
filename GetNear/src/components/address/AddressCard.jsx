import { formatAddressLine } from '../../domain/address';

export function AddressCard({
  address,
  selected = false,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
  showActions = true,
}) {
  const interactive = typeof onSelect === 'function';

  const body = (
    <>
      <div className="address-card-top">
        <strong className="address-label">{address.label}</strong>
        {address.isDefault && <span className="badge badge-success">Default</span>}
        {selected && <span className="badge badge-recommended">Selected</span>}
      </div>
      <p className="address-name">
        {address.fullName} · {address.phone}
      </p>
      <p className="address-line">{formatAddressLine(address)}</p>
      {showActions && (
        <div className="address-actions">
          {!address.isDefault && onSetDefault && (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                onSetDefault(address.id);
              }}
            >
              Set default
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(address);
              }}
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(address.id);
              }}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className={`address-card card ${selected ? 'address-card--selected' : ''}`}
        onClick={() => onSelect(address)}
      >
        {body}
      </button>
    );
  }

  return <div className="address-card card">{body}</div>;
}
