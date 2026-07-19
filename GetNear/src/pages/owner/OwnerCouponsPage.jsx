import CouponManager from '../../components/admin/CouponManager';
import { useAuth } from '../../context/AuthContext';

export default function OwnerCouponsPage() {
  const { user } = useAuth();
  return (
    <CouponManager
      ownerType="business"
      lockedRestaurantId={user?.restaurantId}
      title="My coupons"
    />
  );
}
