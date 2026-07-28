import { AddressCard } from './AddressCard';

export function AddressList({
  addresses = [],
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
  emptyMessage = 'No saved addresses yet.',
  emptyHint = 'Add one to checkout faster.',
  showActions = true,
}) {
  if (!addresses.length) {
    return (
      <div className="empty-state card">
        <p>{emptyMessage}</p>
        {emptyHint && <span className="empty-state-sub">{emptyHint}</span>}
      </div>
    );
  }

  return (
    <div className="address-list">
      {addresses.map((address) => (
        <AddressCard
          key={address.id}
          address={address}
          selected={selectedId === address.id}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          onSetDefault={onSetDefault}
          showActions={showActions}
        />
      ))}
    </div>
  );
}
