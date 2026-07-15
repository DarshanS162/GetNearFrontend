import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CatalogProvider } from './context/CatalogContext';
import { CartProvider } from './context/CartContext';

import HomePage from './pages/catalog/HomePage';
import BusinessPage from './pages/catalog/BusinessPage';
import ProductDetailPage from './pages/catalog/ProductDetailPage';

import CartPage from './pages/cart/CartPage';
import CheckoutPage from './pages/cart/CheckoutPage';

import OrdersPage from './pages/orders/OrdersPage';
import OrderTrackingPage from './pages/orders/OrderTrackingPage';

import ProfilePage from './pages/account/ProfilePage';
import AddressesPage from './pages/account/AddressesPage';

import LoginPage, { OtpPage, SetPasswordPage, SignupPage } from './pages/auth/AuthPages';

import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminRestaurants from './pages/admin/AdminRestaurants';
import AdminProducts from './pages/admin/AdminProducts';
import AdminLoginPage from './pages/admin/AdminLoginPage';

import OwnerLayout from './pages/owner/OwnerLayout';
import OwnerDashboard from './pages/owner/OwnerDashboard';
import OwnerMenuPage from './pages/owner/OwnerMenuPage';
import OwnerOrdersPage from './pages/owner/OwnerOrdersPage';

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
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/order/:id" element={<OrderTrackingPage />} />
              <Route path="/addresses" element={<AddressesPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/otp" element={<OtpPage />} />
              <Route path="/set-password" element={<SetPasswordPage />} />

              <Route path="/admin/log-in" element={<AdminLoginPage />} />
              <Route path="/admin/login" element={<AdminLoginPage />} />

              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="restaurants" element={<AdminRestaurants />} />
                <Route path="products" element={<AdminProducts />} />
              </Route>

              <Route path="/owner" element={<OwnerLayout />}>
                <Route index element={<OwnerDashboard />} />
                <Route path="orders" element={<OwnerOrdersPage />} />
                <Route path="menu" element={<OwnerMenuPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </CatalogProvider>
    </AuthProvider>
  );
}
