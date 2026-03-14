import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { closeTable } from '@/services/orderService';
import { RefreshCw, XCircle, IndianRupee, ShoppingBag, CalendarDays } from 'lucide-react';

export default function AdminDashboard() {
    const [tables, setTables] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dailyStats, setDailyStats] = useState({ revenue: 0, bills: 0, pending: 0 });

    const fetchTables = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('tables')
            .select(`
        *,
        sessions!sessions_table_id_fkey(id, customer_name, customer_phone, status, 
          orders(id, total_amount, status,
            order_items(quantity, price, menu_items(name))
          )
        )
      `)
            .order('table_number');

        if (data) setTables(data);

        const todayStr = new Date().toISOString().split('T')[0];
        const { data: todayOrders } = await supabase
            .from('orders')
            .select('total_amount, status')
            .gte('created_at', `${todayStr}T00:00:00Z`)
            .lte('created_at', `${todayStr}T23:59:59Z`);

        if (todayOrders) {
            const completedOrders = todayOrders.filter(o => o.status === 'completed');
            const pendingOrders = todayOrders.filter(o => o.status === 'pending');
            setDailyStats({
                bills: completedOrders.length,
                pending: pendingOrders.length,
                revenue: completedOrders.reduce((acc, order) => acc + Number(order.total_amount), 0),
            });
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchTables();

        const channel = supabase
            .channel('dashboard_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchTables())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => fetchTables())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, () => fetchTables())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleCloseTable = async (tableId: string, sessionId: string) => {
        if (!confirm('Are you sure you want to close this table? Normally the customer does this themselves.')) return;

        try {
            await closeTable(sessionId, tableId);
            fetchTables();
        } catch (err) {
            alert('Error closing table.');
        }
    };

    return (
        <div className="p-8">
            <div className="max-w-6xl mx-auto">
                <header className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Staff Dashboard</h1>
                        <p className="text-gray-500 mt-1">Live Overview of Active Tables</p>
                    </div>
                    <button
                        onClick={fetchTables}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700 transition"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </header>

                {/* Daily Summary Widget */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-md mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4 text-white/90">
                        <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                            <CalendarDays size={28} />
                        </div>
                        <div>
                            <p className="text-sm font-medium uppercase tracking-wider text-blue-100">Today's Performance</p>
                            <h2 className="text-2xl font-bold">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h2>
                        </div>
                    </div>

                    <div className="flex gap-4 md:gap-8 w-full md:w-auto">
                        <div>
                            <p className="text-blue-100 text-sm font-medium mb-1">Total Revenue</p>
                            <p className="text-3xl font-extrabold flex items-center">
                                <IndianRupee size={24} className="opacity-80 mt-1 mr-1" />
                                {dailyStats.revenue.toFixed(2)}
                            </p>
                        </div>
                        <div className="w-px bg-white/20 hidden md:block"></div>
                        <div>
                            <p className="text-blue-100 text-sm font-medium mb-1">Pending Orders</p>
                            <p className="text-3xl font-extrabold whitespace-nowrap text-yellow-300">
                                {dailyStats.pending}
                            </p>
                        </div>
                        <div className="w-px bg-white/20 hidden md:block"></div>
                        <div>
                            <p className="text-blue-100 text-sm font-medium mb-1">Bills Completed</p>
                            <p className="text-3xl font-extrabold whitespace-nowrap">
                                {dailyStats.bills} <span className="text-lg font-normal opacity-80">orders</span>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tables.map((table) => {
                        const activeSession = table.sessions?.find((s: any) => s.status === 'open');
                        const pendingOrders = activeSession?.orders?.filter((o: any) => o.status === 'pending') || [];
                        const completedOrders = activeSession?.orders?.filter((o: any) => o.status === 'completed') || [];

                        const totalPending = pendingOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount), 0);
                        const totalCompleted = completedOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount), 0);
                        const totalBill = totalPending + totalCompleted;

                        const pendingItemsList = pendingOrders.flatMap((o: any) => o.order_items || []);

                        return (
                            <div key={table.id} className="bg-white rounded-xl shadow-sm border p-6 flex flex-col justify-between h-full">
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <h2 className="text-2xl font-bold">Table {table.table_number}</h2>
                                        <span className={`px-3 py-1 rounded-full text-sm font-semibold uppercase tracking-wider ${table.status === 'free' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {table.status}
                                        </span>
                                    </div>

                                    {table.status === 'free' && (
                                        <div className="text-gray-500 text-center py-6 bg-gray-50 border border-dashed rounded-lg">
                                            <p>Table is currently empty.</p>
                                        </div>
                                    )}

                                    {table.status === 'occupied' && activeSession && (
                                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4">
                                            <p className="font-semibold text-blue-900 mb-2">Customer Details</p>
                                            <p className="text-blue-800 text-sm">Name: <span className="font-bold">{activeSession.customer_name}</span></p>
                                            <p className="text-blue-800 text-sm">Phone: <span className="font-bold">{activeSession.customer_phone}</span></p>

                                            <div className="mt-4 pt-4 border-t border-blue-200 space-y-2">
                                                <div className="flex justify-between items-center text-green-700 font-bold">
                                                    <span>Completed Orders</span>
                                                    <span>₹{totalCompleted.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-yellow-600 font-bold">
                                                    <span>Running Tab (Pending)</span>
                                                    <span>₹{totalPending.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-blue-900 font-black text-lg pt-2 border-t border-blue-200">
                                                    <span>Total Bill</span>
                                                    <span>₹{totalBill.toFixed(2)}</span>
                                                </div>

                                                {pendingItemsList.length > 0 ? (
                                                    <div className="bg-white/50 rounded p-3 text-sm border border-blue-100 mt-4">
                                                        <div className="flex items-center gap-1 font-semibold text-blue-800 mb-2">
                                                            <ShoppingBag size={14} /> Uncompleted Items Waiting:
                                                        </div>
                                                        <ul className="space-y-1">
                                                            {pendingItemsList.map((item: any, idx: number) => (
                                                                <li key={idx} className="flex justify-between text-blue-900">
                                                                    <span>{item.quantity}x {item.menu_items?.name}</span>
                                                                    <span className="text-blue-700">₹{item.price}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ) : (
                                                    <div className="text-center mt-4">
                                                        {totalCompleted > 0 ? (
                                                            <p className="text-xs text-green-600 font-bold italic">All current orders are completed! ✔️</p>
                                                        ) : (
                                                            <p className="text-xs text-blue-600 italic">No items ordered yet.</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-6 border-t pt-4 flex gap-2">
                                    {table.status === 'occupied' && activeSession ? (
                                        <button
                                            onClick={() => handleCloseTable(table.id, activeSession.id)}
                                            className="w-full flex justify-center items-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 py-2.5 rounded-lg font-semibold transition hover:scale-[1.02]"
                                        >
                                            <XCircle size={18} /> Force Close Table
                                        </button>
                                    ) : (
                                        <div className="w-full grid grid-cols-1 gap-2 text-sm font-medium">
                                            <div className="w-full text-center py-2.5 bg-gray-50 text-gray-400 rounded-lg border">
                                                No Active Orders
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
