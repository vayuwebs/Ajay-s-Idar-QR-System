"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, Clock, XCircle, Grid } from "lucide-react";

export default function AdminOrders() {
    // We store all orders here
    const [orders, setOrders] = useState<any[]>([]);

    // We use a ref for orders so the realtime listener always has the latest state without closure stale data
    const ordersRef = useRef<any[]>([]);

    useEffect(() => {
        ordersRef.current = orders;
    }, [orders]);

    const fetchOrders = async () => {
        // Fetch orders and relate to sessions, tables and items
        const { data, error } = await supabase
            .from("orders")
            .select(`
                *,
                sessions(id, status, table_id, customer_name,
                    tables!sessions_table_id_fkey(id, table_number)    
                ),
                order_items(quantity, price, menu_items(name))
            `)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("fetchOrders error:", JSON.stringify(error, null, 2));
        }

        if (data) {
            // Filter manually: we only want orders where the session is still active
            const activeOrders = data.filter((o) => o.sessions && o.sessions.status === "open");
            setOrders(activeOrders);
        }
    };

    useEffect(() => {
        fetchOrders();

        // --- SUPABASE REALTIME MULTIPLEXING ---
        const channel = supabase
            .channel("live_orders")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "orders" },
                (payload) => {
                    const newOrder = payload.new;
                    console.log("Realtime INSERT triggered!", newOrder);

                    // AUDIO LOGIC: Check if this session already has orders in our state
                    try {
                        const existingOrdersForSession = ordersRef.current.filter(
                            (o) => o.session_id === newOrder.session_id
                        );

                        if (existingOrdersForSession.length > 0) {
                            // This table already ordered something before, so it's a running addition
                            console.log("Playing Running Order sound...");
                            const audio = new Audio('/running_order.mp3');
                            audio.play().catch(e => console.log("Autoplay blocked", e));
                        } else {
                            // Brand new customer order!
                            console.log("Playing New Order sound...");
                            const audio = new Audio('/new_order.mp3');
                            audio.play().catch(e => console.log("Autoplay blocked", e));
                        }
                    } catch (err) {
                        console.error("Audio error", err);
                    }

                    // Refetch to get the full relational data (names, items) gracefully
                    fetchOrders();
                }
            )
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "orders" },
                () => {
                    // E.g., if another device updates a status, we sync instantly
                    fetchOrders();
                }
            )
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "order_items" },
                () => {
                    // Catch the delayed order_items insertions to refresh the UI properly
                    fetchOrders();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const updateOrderStatus = async (orderId: string, status: string) => {
        await supabase.from("orders").update({ status }).eq("id", orderId);
        // fetchOrders is called automatically by Realtime UPDATE listener, but we can do it locally for instant feedback
        fetchOrders();
    };

    const handleCloseTable = async (sessionId: string, tableId: string) => {
        if (!confirm("Close this table? This clears their session from Live Orders.")) return;

        try {
            // We use the checkout API for consistency
            const response = await fetch(`/api/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, tableId })
            });

            if (!response.ok) throw new Error("Failed to close table");

            // Since checkout updates session status to 'closed', the fetchOrders filter `.eq("sessions.status", "open")`
            // will automatically drop this session from the UI.
            fetchOrders();
        } catch (err) {
            alert("Error closing table.");
        }
    };

    // --- GROUP BY SESSION (TABLE) ---
    // Instead of a flat list, we structure it by unique session ID.
    const groupedSessions: Record<string, { session: any; table: any; orders: any[] }> = {};

    orders.forEach((o) => {
        const sId = o.sessions.id;
        if (!groupedSessions[sId]) {
            groupedSessions[sId] = {
                session: o.sessions,
                table: o.sessions.tables,
                orders: []
            };
        }
        groupedSessions[sId].orders.push(o);
    });

    const activeSessions = Object.values(groupedSessions).sort((a, b) => {
        // Sort tables numerically roughly
        return (a.table?.table_number || 0) - (b.table?.table_number || 0);
    });

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-5xl mx-auto">
                <header className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <Grid className="text-blue-600" /> Live Kitchen Orders
                        </h1>
                        <p className="text-gray-500 mt-1">Real-time sync. Grouped by Table.</p>
                    </div>
                    <div className="text-sm px-4 py-2 bg-green-50 text-green-700 font-semibold rounded-lg border border-green-200 flex items-center gap-2 animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div> Connection Live
                    </div>
                </header>

                <div className="space-y-8">
                    {activeSessions.map((group) => {
                        const { session, table, orders: sessionOrders } = group;

                        // Calculate total uncompleted vs completed for this specific table view if needed
                        const totalSessionAmount = sessionOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

                        return (
                            <div key={session.id} className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
                                {/* Table Header Header */}
                                <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white text-blue-700 font-bold text-xl h-12 w-12 flex items-center justify-center rounded-xl shadow-sm">
                                            {table.table_number}
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold">{session.customer_name}</h2>
                                            <p className="text-blue-100 text-sm font-medium">Session ID: {session.id.substring(0, 6)}...</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-blue-100 text-xs uppercase tracking-wider font-bold mb-1">Session Total</p>
                                        <p className="text-2xl font-bold">₹{totalSessionAmount.toFixed(2)}</p>
                                    </div>
                                </div>

                                {/* Order Blocks Container */}
                                <div className="p-4 space-y-4 bg-gray-50">
                                    {sessionOrders.map((order, orderIndex) => (
                                        <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row gap-6 items-center">

                                            {/* Order Details */}
                                            <div className="flex-1 w-full">
                                                <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-gray-400 uppercase">Sub-Order #{sessionOrders.length - orderIndex}</span>
                                                        <span className="text-xs text-gray-400">• {new Date(order.created_at).toLocaleTimeString()}</span>
                                                    </div>
                                                    <span className="font-bold text-gray-900">₹{Number(order.total_amount).toFixed(2)}</span>
                                                </div>

                                                <ul className="space-y-1">
                                                    {(order.order_items || []).map((item: any, idx: number) => (
                                                        <li key={idx} className="flex justify-between items-center text-sm font-medium text-gray-700">
                                                            <span><span className="font-bold text-blue-600 mr-2">{item.quantity}x</span> {item.menu_items?.name || "Unknown Item"}</span>
                                                            <span className="text-gray-400">₹{(item.price * item.quantity).toFixed(2)}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {/* Order Status Action */}
                                            <div className="w-full md:w-48 shrink-0 flex flex-col justify-center">
                                                {order.status === 'pending' ? (
                                                    <button
                                                        onClick={() => updateOrderStatus(order.id, 'completed')}
                                                        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95"
                                                    >
                                                        <CheckCircle2 size={18} /> Mark Complete
                                                    </button>
                                                ) : (
                                                    <div className="w-full bg-gray-100 text-gray-500 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 border border-gray-200">
                                                        <CheckCircle2 size={18} className="text-green-500" /> Completed
                                                    </div>
                                                )}
                                            </div>

                                        </div>
                                    ))}
                                </div>

                                {/* Table Footer Actions */}
                                <div className="bg-white p-4 border-t border-gray-200 flex justify-end">
                                    <button
                                        onClick={() => handleCloseTable(session.id, session.table_id)}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-bold rounded-lg transition-colors border border-red-100"
                                    >
                                        <XCircle size={18} /> Close Table & Clear History
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {activeSessions.length === 0 && (
                        <div className="text-center p-16 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm">
                            <div className="w-20 h-20 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Clock size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">No Active Orders</h3>
                            <p className="text-gray-500">When a customer places an order, their table will automatically appear here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
