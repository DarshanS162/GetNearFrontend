import MenuItemsManager from '../../components/admin/MenuItemsManager';

export default function AdminProducts() {
  return (
    <MenuItemsManager
      showRestaurantPicker
      title="Menu items"
      description="Add or remove menu items for any restaurant on the platform."
    />
  );
}
