"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Coffee, LayoutDashboard, Settings, List, Grid, LogOut } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    const navItems = [
        { name: "Live Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
        { name: "Live Orders", href: "/admin/orders", icon: List },
        { name: "Table Manager", href: "/admin/tables", icon: Grid },
        { name: "Menu Manager", href: "/admin/menu", icon: Coffee },
        { name: "Settings", href: "/admin/settings", icon: Settings },
    ];

    const isAuthPage = pathname.startsWith("/admin/login");

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/admin/login");
        router.refresh();
    };

    if (isAuthPage) {
        return <div className="min-h-screen bg-gray-50">{children}</div>;
    }

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
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${isActive
                                    ? "bg-blue-50 text-blue-700 font-semibold"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                    }`}
                            >
                                <Icon size={20} className={isActive ? "text-blue-600" : "text-gray-400"} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-100 flex flex-col gap-2">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors w-full"
                    >
                        <LogOut size={20} />
                        Logout
                    </button>
                    <div className="text-xs text-gray-400 text-center mt-2">
                        Staff Portal v2.0
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-x-hidden overflow-y-auto w-full">
                {children}
            </main>
        </div>
    );
}
