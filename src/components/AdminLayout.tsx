import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Coffee, LayoutDashboard, Settings, List, Grid, LogOut, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AdminLayout() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/admin/login', { replace: true });
            } else {
                setAuthenticated(true);
            }
            setLoading(false);
        };
        checkAuth();
    }, [navigate]);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    const navItems = [
        { name: 'Live Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
        { name: 'Live Orders', href: '/admin/orders', icon: List },
        { name: 'Table Manager', href: '/admin/tables', icon: Grid },
        { name: 'Menu Manager', href: '/admin/menu', icon: Coffee },
        { name: 'Settings', href: '/admin/settings', icon: Settings },
    ];

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/admin/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <p className="text-gray-500">Loading...</p>
            </div>
        );
    }

    if (!authenticated) return null;

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
            {/* Sidebar Navigation */}
            <aside className="w-full md:w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
                <div className="p-6 border-b border-gray-100">
                    <h1 className="text-2xl font-bold font-serif text-blue-900">Cafe Admin</h1>
                </div>

                <nav className="p-4 space-y-2 flex-grow">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <NavLink
                                key={item.name}
                                to={item.href}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive
                                        ? 'bg-blue-50 text-blue-700 font-semibold'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <Icon size={20} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                                        {item.name}
                                    </>
                                )}
                            </NavLink>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-100 flex flex-col gap-2">
                    {deferredPrompt && (
                        <button
                            onClick={handleInstallClick}
                            className="flex items-center gap-3 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition-colors w-full shadow-sm"
                        >
                            <Download size={20} />
                            Install App
                        </button>
                    )}
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors w-full"
                    >
                        <LogOut size={20} />
                        Logout
                    </button>
                    <div className="text-[10px] text-gray-400 text-center mt-2 uppercase tracking-widest font-bold">
                        Powered by VayuWebs
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-x-hidden overflow-y-auto w-full">
                <Outlet />
            </main>
        </div>
    );
}
