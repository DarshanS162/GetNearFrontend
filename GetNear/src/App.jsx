import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CatalogProvider } from './context/CatalogContext';
import { CartProvider } from './context/CartContext';
import HomePage from './pages/HomePage';
import BusinessPage from './pages/BusinessPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderTrackingPage from './pages/OrderTrackingPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage, { OtpPage, SignupPage } from './pages/AuthPages';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminRestaurants from './pages/admin/AdminRestaurants';
import AdminProducts from './pages/admin/AdminProducts';
import OwnerLayout from './pages/owner/OwnerLayout';
import OwnerDashboard from './pages/owner/OwnerDashboard';
import OwnerMenuPage from './pages/owner/OwnerMenuPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import './pages/admin/AdminLayout.css';

export default function App() {
  return (
    <AuthProvider>
      <CatalogProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/business/:id" element={<BusinessPage />} />
              <Route path="/product/:id" element={<ProductDetailPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/order/:id" element={<OrderTrackingPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/otp" element={<OtpPage />} />

              <Route path="/admin/log-in" element={<AdminLoginPage />} />
              <Route path="/admin/login" element={<AdminLoginPage />} />

              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="restaurants" element={<AdminRestaurants />} />
                <Route path="products" element={<AdminProducts />} />
              </Route>

              <Route path="/owner" element={<OwnerLayout />}>
                <Route index element={<OwnerDashboard />} />
                <Route path="menu" element={<OwnerMenuPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </CatalogProvider>
    </AuthProvider>
  );
}
