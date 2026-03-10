"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ShoppingCart, Plus, Minus, Coffee, XCircle, LogOut, History } from "lucide-react";

function MenuContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const sessionId = searchParams.get("session");
    const tableId = searchParams.get("table");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [categories, setCategories] = useState<any[]>([]);
    const [menuItems, setMenuItems] = useState<any[]>([]);

    // State for the seamless flow
    const [customerName, setCustomerName] = useState("");
    const [runningTotal, setRunningTotal] = useState(0);
    const [runningItems, setRunningItems] = useState<any[]>([]);

    const [cart, setCart] = useState<Record<string, number>>({});
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [tableNumber, setTableNumber] = useState<string | null>(null);

    // Local History State
    const [showHistory, setShowHistory] = useState(false);
    const [localHistory, setLocalHistory] = useState<any[]>([]);

    useEffect(() => {
        // Load local history on mount
        const savedHistory = localStorage.getItem("order_history");
        if (savedHistory) {
            setLocalHistory(JSON.parse(savedHistory));
        }
        async function loadMenuAndOrder() {
            if (!sessionId || !tableId) {
                setError("Invalid Session. Please scan your QR code again.");
                setLoading(false);
                return;
            }

            try {
                // 1. Verify the session
                const { data: session, error: sessionError } = await supabase
                    .from("sessions")
                    .select("status, table_id, customer_name, tables!sessions_table_id_fkey(table_number)")
                    .eq("id", sessionId)
                    .single();

                let fetchedTableNumber = session ? (session.tables as any)?.table_number?.toString() : null;

                // Fallback: If session was totally deleted/missing, fetch table_number using tableId
                if (!fetchedTableNumber && tableId) {
                    const { data: tData } = await supabase.from("tables").select("table_number").eq("id", tableId).single();
                    if (tData) {
                        fetchedTableNumber = tData.table_number.toString();
                    }
                }

                if (fetchedTableNumber) setTableNumber(fetchedTableNumber);

                if (sessionError || !session || session.status !== "open" || session.table_id !== tableId) {
                    setError("Session expired or invalid. Please scan the QR code to start a new session.");
                    localStorage.removeItem(`session_id_${tableId}`);
                    setLoading(false);
                    return;
                }
                setCustomerName(session.customer_name);

                // 2. Fetch Menu
                const { data: cats } = await supabase.from("menu_categories").select("*").order("sort_order");
                if (cats) setCategories(cats);

                const { data: items } = await supabase.from("menu_items").select("*").eq("is_available", true).order("sort_order", { ascending: true });
                if (items) setMenuItems(items);

                // 3. Auto-Recovery: Fetch Running Order if it exists
                await fetchRunningOrder();

            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        loadMenuAndOrder();
    }, [sessionId, tableId]);

    const fetchRunningOrder = async () => {
        if (!sessionId) return;
        const { data: existingOrder } = await supabase
            .from("orders")
            .select("id, total_amount")
            .eq("session_id", sessionId)
            .eq("status", "pending")
            .single();

        if (existingOrder) {
            setRunningTotal(Number(existingOrder.total_amount));
            // Fetch the relational items
            const { data: orderItems } = await supabase
                .from("order_items")
                .select("quantity, price, menu_items(name)")
                .eq("order_id", existingOrder.id);

            if (orderItems) {
                setRunningItems(orderItems.map(item => ({
                    name: (item.menu_items as any).name,
                    quantity: item.quantity,
                    price: item.price
                })));
            }
        }
    };

    const addToCart = (itemId: string) => {
        setCart((prev) => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
    };

    const removeFromCart = (itemId: string) => {
        setCart((prev) => {
            const newCart = { ...prev };
            if (newCart[itemId] > 1) {
                newCart[itemId]--;
            } else {
                delete newCart[itemId];
            }
            return newCart;
        });
    };

    const cartTotal = Object.entries(cart).reduce((total, [itemId, quantity]) => {
        const item = menuItems.find((i) => i.id === itemId);
        return total + (item?.price || 0) * quantity;
    }, 0);

    const handlePlaceOrder = async () => {
        if (Object.keys(cart).length === 0 || !sessionId || !tableId) return;
        setIsPlacingOrder(true);

        const orderItemsList = Object.entries(cart).map(([itemId, quantity]) => {
            const item = menuItems.find((i) => i.id === itemId);
            return { item_id: itemId, quantity, price: item?.price };
        });

        try {
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-id': sessionId
                },
                body: JSON.stringify({
                    tableId,
                    items: orderItemsList,
                    totalAmountToAdd: cartTotal
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to place order");
            }

            alert("Items added to your running order!");

            // Save to Local Storage History
            const newHistoryEntry = {
                date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
                items: orderItemsList.map(oi => {
                    const i = menuItems.find(m => m.id === oi.item_id);
                    return { name: i?.name, quantity: oi.quantity, price: oi.price };
                }),
                total: cartTotal
            };
            const updatedHistory = [newHistoryEntry, ...localHistory];
            setLocalHistory(updatedHistory);
            localStorage.setItem("order_history", JSON.stringify(updatedHistory));

            setCart({});
            await fetchRunningOrder(); // Refresh the running tab

        } catch (err: any) {
            alert("Failed to place order: " + err.message);
        } finally {
            setIsPlacingOrder(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading Menu...</div>;

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="bg-red-50 text-red-600 p-8 rounded-2xl text-center max-w-sm w-full shadow-lg border border-red-100">
                    <XCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
                    <h2 className="text-xl font-bold mb-2">Session Expired</h2>
                    <p className="text-sm text-red-500 mb-6">{error}</p>
                    <button
                        onClick={() => {
                            localStorage.removeItem(`session_id_${tableId}`);
                            // We do NOT remove customer_name or customer_phone so they pre-fill next time.

                            // Determine the redirect target. We prefer the table_number,
                            // but if we don't have it, tableId acts as the UUID fallback in the URL layer.
                            // To be safe, try routing them to `/${tableNumber || tableId}`
                            if (tableNumber) {
                                router.push(`/${tableNumber}`);
                            } else {
                                // Fallback: just reload the base or tableId
                                router.push(`/${tableId}`);
                            }
                        }}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm"
                    >
                        Start New Order
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-transparent pb-32 font-sans selection:bg-teal-200 relative">
            {/* Background Decorations */}
            <div className="fixed top-[-10%] left-[-10%] w-96 h-96 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob pointer-events-none"></div>
            <div className="fixed top-[20%] right-[-10%] w-96 h-96 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>
            <div className="fixed bottom-[-20%] left-[20%] w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000 pointer-events-none"></div>
            {/* Header */}
            <header className="bg-white/40 backdrop-blur-xl border-b border-white/50 p-4 sticky top-0 z-20 shadow-sm">
                <div className="flex items-center justify-between max-w-2xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-50 rounded-full flex items-center justify-center text-teal-600 shadow-inner">
                            <Coffee size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-extrabold text-foreground tracking-tight">Menu</h1>
                            <p className="text-sm font-medium text-teal-600">Table {tableNumber || tableId}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowHistory(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-white/60 hover:bg-white/90 rounded-full text-teal-700 font-semibold transition text-sm shadow-sm backdrop-blur-md"
                    >
                        <History size={16} />
                    </button>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4 space-y-8 relative z-10">
                {/* Running Order Summary (if any) */}
                {runningItems.length > 0 && (
                    <div className="glass-panel p-5 rounded-3xl">
                        <h2 className="font-bold text-teal-900 mb-3 flex items-center gap-2 border-b border-teal-200/50 pb-3">
                            <ShoppingCart size={18} className="text-teal-600" />
                            Your Running Order
                        </h2>
                        <ul className="space-y-2 mb-4 text-sm font-medium">
                            {runningItems.map((item, idx) => (
                                <li key={idx} className="flex justify-between text-teal-900 bg-white/40 px-3 py-2 rounded-xl">
                                    <span><span className="font-bold text-teal-600 mr-2">{item.quantity}x</span> {item.name}</span>
                                    <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="flex justify-between items-center font-extrabold text-lg text-teal-950 border-t border-teal-200/50 pt-3">
                            <span>Total Ordered So Far</span>
                            <span>₹{runningTotal.toFixed(2)}</span>
                        </div>
                    </div>
                )}

                {/* Categories */}
                {categories.map((category) => {
                    const catItems = menuItems.filter((item) => item.category_id === category.id);
                    if (catItems.length === 0) return null;

                    return (
                        <div key={category.id} className="animate-fade-in-up">
                            <h2 className="text-xl font-extrabold text-foreground mb-4 pl-2 drop-shadow-sm">
                                {category.name}
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {catItems.map((item) => (
                                    <div key={item.id} className="glass-panel p-4 rounded-3xl flex flex-col hover:shadow-lg transition-all duration-300 h-full">

                                        {/* Image Box */}
                                        <div className="w-full aspect-square max-h-40 bg-gray-50 rounded-2xl mb-4 flex-shrink-0 flex items-center justify-center text-xs text-teal-600 font-bold overflow-hidden shadow-sm relative">
                                            {item.image_url ? (
                                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-2xl transition-transform hover:scale-105 duration-500" />
                                            ) : (
                                                <span className="opacity-50 flex flex-col items-center gap-1"><Coffee size={24} className="opacity-40" /> No Image</span>
                                            )}
                                        </div>

                                        <div className="flex-1 flex flex-col items-center text-center">
                                            <h3 className="font-bold text-foreground text-base line-clamp-1">{item.name}</h3>
                                            <p className="text-[10px] sm:text-xs text-gray-500 mb-3 leading-relaxed line-clamp-2 flex-grow">{item.description}</p>
                                            <p className="font-extrabold text-teal-600 text-sm sm:text-[15px] mb-3">₹{item.price.toFixed(2)}</p>
                                        </div>

                                        <div className="flex items-center justify-center w-full">
                                            {cart[item.id] ? (
                                                <div className="flex items-center bg-white/80 rounded-full p-1 shadow-sm border border-white">
                                                    <button
                                                        onClick={() => removeFromCart(item.id)}
                                                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
                                                    >
                                                        <Minus size={16} />
                                                    </button>
                                                    <span className="w-6 text-center font-bold text-foreground text-sm">{cart[item.id]}</span>
                                                    <button
                                                        onClick={() => addToCart(item.id)}
                                                        className="w-8 h-8 rounded-full flex items-center justify-center text-teal-600 hover:bg-teal-50 transition-colors"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => addToCart(item.id)}
                                                    className="w-10 h-10 bg-white/80 rounded-full flex items-center justify-center text-teal-600 shadow-sm border border-white hover:bg-white transition-all transform hover:scale-105 active:scale-95"
                                                >
                                                    <Plus size={20} strokeWidth={2.5} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </main>

            {/* Floating Cart Bar (for new additions) */}
            {Object.keys(cart).length > 0 && (
                <div className="fixed bottom-6 left-0 right-0 px-4 z-30 animate-fade-in-up flex justify-center">
                    <button
                        onClick={handlePlaceOrder}
                        disabled={isPlacingOrder}
                        className="glass-panel w-full max-w-sm rounded-full p-2 pl-4 pr-2 flex items-center justify-between shadow-[0_8px_30px_rgba(20,184,166,0.3)] hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-white/80 w-10 h-10 rounded-full flex items-center justify-center text-teal-600 font-bold shadow-sm">
                                {Object.values(cart).reduce((a, b) => a + b, 0)}
                            </div>
                            <span className="font-bold text-foreground">₹{cartTotal.toFixed(2)}</span>
                        </div>

                        <div className="bg-gradient-to-r from-teal-400 to-emerald-500 text-white px-6 py-3 rounded-full font-bold text-sm tracking-wide shadow-md flex items-center gap-2">
                            {isPlacingOrder ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <>Place Order</>
                            )}
                        </div>
                    </button>
                </div>
            )}

            {/* Order History Modal */}
            {showHistory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in-up">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <History className="text-orange-500" /> My Order History
                            </h2>
                            <button onClick={() => setShowHistory(false)} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className="overflow-y-auto p-5 space-y-4">
                            {localHistory.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">No past orders found on this device.</p>
                            ) : (
                                localHistory.map((entry, idx) => (
                                    <div key={idx} className="bg-orange-50/50 border border-orange-100 p-4 rounded-xl">
                                        <p className="text-xs text-gray-500 mb-2 font-semibold">{entry.date}</p>
                                        <ul className="space-y-1 text-sm mb-3">
                                            {entry.items.map((item: any, iIdx: number) => (
                                                <li key={iIdx} className="flex justify-between items-center bg-white/60 p-1.5 rounded">
                                                    <span><span className="font-bold text-orange-600 mr-1">{item.quantity}x</span> {item.name}</span>
                                                    <span className="text-gray-600">₹{(item.price * item.quantity).toFixed(2)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="flex justify-between items-center border-t border-orange-200 pt-2 font-bold text-gray-900">
                                            <span>Total</span>
                                            <span>₹{entry.total.toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function MenuPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-teal-600">Loading Menu...</div>}>
            <MenuContent />
        </Suspense>
    );
}
