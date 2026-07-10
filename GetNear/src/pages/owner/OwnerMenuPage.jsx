import { useAuth } from '../../context/AuthContext';
import MenuItemsManager from '../../components/admin/MenuItemsManager';

export default function OwnerMenuPage() {
  const { user } = useAuth();

  return (
    <MenuItemsManager
      lockedBusinessId={user?.restaurantId}
      showRestaurantPicker={false}
      title="My menu"
      description="Add and update items for your restaurant only."
    />
  );
}
