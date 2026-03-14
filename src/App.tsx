import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TablePage from './pages/TablePage';
import MenuPage from './pages/MenuPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import ForgotPasswordPage from './pages/admin/ForgotPasswordPage';
import VerifyOTPPage from './pages/admin/VerifyOTPPage';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminTables from './pages/admin/AdminTables';
import AdminMenuManager from './pages/admin/AdminMenuManager';
import AdminSettings from './pages/admin/AdminSettings';

export default function App() {
    return (
        <Routes>
            {/* Public Customer Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/:table_uuid" element={<TablePage />} />
            <Route path="/menu" element={<MenuPage />} />

            {/* Public Admin Auth Routes */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/login/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/admin/login/verify-otp" element={<VerifyOTPPage />} />

            {/* Protected Admin Routes — wrapped in AdminLayout */}
            <Route element={<AdminLayout />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/orders" element={<AdminOrders />} />
                <Route path="/admin/tables" element={<AdminTables />} />
                <Route path="/admin/menu" element={<AdminMenuManager />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
        </Routes>
    );
}
