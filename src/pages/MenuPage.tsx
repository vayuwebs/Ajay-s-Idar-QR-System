import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { placeOrder } from '@/services/orderService';
import { getSettings, AppSettings } from '@/services/settingsService';
import { ShoppingCart, Plus, Minus, Coffee, XCircle, History, Clock, Flame, CheckCircle2, Bell, Play, Grid, List, Trash2 } from 'lucide-react';

export default function MenuPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const sessionId = searchParams.get('session');
    const tableId = searchParams.get('table');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [categories, setCategories] = useState<any[]>([]);
    const [menuItems, setMenuItems] = useState<any[]>([]);
    
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showCart, setShowCart] = useState(false);
    const [isGridView, setIsGridView] = useState(true);
    const [incomingPayment, setIncomingPayment] = useState<{ amount: number } | null>(null);
    const [showSelfPay, setShowSelfPay] = useState(false);

    const [customerName, setCustomerName] = useState('');
    const [runningTotal, setRunningTotal] = useState(0);
    const [runningItems, setRunningItems] = useState<any[]>([]);

    const [cart, setCart] = useState<Record<string, number>>({});
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [tableNumber, setTableNumber] = useState<string | null>(null);

    const [showHistory, setShowHistory] = useState(false);
    const [localHistory, setLocalHistory] = useState<any[]>([]);
    const [allOrders, setAllOrders] = useState<any[]>([]);
    const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
        typeof Notification !== 'undefined' ? Notification.permission : 'denied'
    );
    const [isLive, setIsLive] = useState(false);
    const [lastSync, setLastSync] = useState<Date>(new Date());
    const channelRef = useRef<any>(null);

    useEffect(() => {
        const savedHistory = localStorage.getItem('order_history');
        if (savedHistory) {
            setLocalHistory(JSON.parse(savedHistory));
        }
        async function loadMenuAndOrder() {
            if (!sessionId || !tableId) {
                setError('Invalid Session. Please scan your QR code again.');
                setLoading(false);
                return;
            }

            try {
                const { data: session, error: sessionError } = await supabase
                    .from('sessions')
                    .select("status, table_id, customer_name, tables!sessions_table_id_fkey(table_number)")
                    .eq('id', sessionId)
                    .single();

                let fetchedTableNumber = session ? (session.tables as any)?.table_number?.toString() : null;

                if (!fetchedTableNumber && tableId) {
                    const { data: tData } = await supabase.from('tables').select('table_number').eq('id', tableId).single();
                    if (tData) {
                        fetchedTableNumber = tData.table_number.toString();
                    }
                }

                if (fetchedTableNumber) setTableNumber(fetchedTableNumber);

                if (sessionError || !session || session.status !== 'open' || session.table_id !== tableId) {
                    setError('Session expired or invalid. Please scan the QR code to start a new session.');
                    localStorage.removeItem(`session_id_${tableId}`);
                    setLoading(false);
                    return;
                }
                setCustomerName(session.customer_name);

                const { data: cats } = await supabase.from('menu_categories').select('*').order('sort_order');
                if (cats) setCategories(cats);

                const { data: items } = await supabase.from('menu_items').select('*').eq('is_available', true).order('sort_order', { ascending: true });
                if (items) setMenuItems(items);

                const fetchedSettings = await getSettings();
                if (fetchedSettings) setSettings(fetchedSettings);

                await fetchRunningOrder();

                // Request notification permission
                if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                    Notification.requestPermission().then(perm => setNotifPermission(perm));
                }

                // === SHARED COMMUNICATION CHANNEL (BROADCAST + REALTIME) ===
                const channel = supabase
                    .channel('cafe_communications')
                channelRef.current = channel;

                channel
                    // 1. BROADCAST: Instant signal from Admin
                    .on(
                        'broadcast',
                        { event: 'ORDER_STATUS_UPDATED' },
                        (payload: any) => {
                            console.log('📡 Broadcast received!', payload);
                            if (payload.payload.sessionId === sessionId) {
                                console.log('🎯 Status update for US!');
                                // Trigger notification if status became completed
                                if (payload.payload.status === 'completed') {
                                    triggerReadyNotification();
                                }
                                fetchRunningOrder();
                            }
                        }
                    )
                    .on(
                        'broadcast',
                        { event: 'PAYMENT_REQUESTED' },
                        (payload: any) => {
                            console.log('💰 Payment requested!', payload);
                            if (payload.payload.sessionId === sessionId) {
                                setIncomingPayment({ amount: payload.payload.amount });
                            }
                        }
                    )
                    // 2. REALTIME DB: Backup signal
                    .on(
                        'postgres_changes',
                        {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'orders',
                            filter: `session_id=eq.${sessionId}`
                        },
                        (payload: any) => {
                            console.log('🔥 DB UPDATE detected!', payload);
                            const isReady = payload.new.status === 'completed';
                            const wasReady = payload.old ? payload.old.status === 'completed' : false;

                            if (isReady && !wasReady) {
                                triggerReadyNotification();
                            }
                            fetchRunningOrder();
                        }
                    )
                    .subscribe((status, err) => {
                        console.log('🌐 Client Channel Status:', status);
                        if (err) console.error('Supabase Realtime error:', err);
                        setIsLive(status === 'SUBSCRIBED');
                    });

                return () => {
                    supabase.removeChannel(channel);
                };
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        loadMenuAndOrder();
    }, [sessionId, tableId]);

    const triggerReadyNotification = () => {
        // Fallback manual sound (since browser defaults can be unreliable/silent)
        try {
            const audio = new Audio('/notification_sound.wav');
            audio.play().catch(e => console.log('Audio autoplay blocked or failed:', e));
        } catch (err) {
            console.error('Error playing sound:', err);
        }

        // Show browser notification
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification("YEEHHHH! 🎉 YOUR ORDER IS READY!", {
                body: "PLEASE COLLECT IT FROM SERVICE TABLE.",
                icon: "/favicon.svg",
                tag: 'order-ready-' + Date.now(),
                silent: false 
            });
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }
        }
    };

    const fetchRunningOrder = async () => {
        if (!sessionId) return;
        const { data: orders } = await supabase
            .from('orders')
            .select(`
                id, 
                total_amount, 
                status, 
                created_at,
                order_items(quantity, price, menu_items(name))
            `)
            .eq('session_id', sessionId)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });

        if (orders) {
            setAllOrders(orders);
            setLastSync(new Date());
            // Only sum orders that are 'completed'
            const total = orders
                .filter(o => o.status === 'completed')
                .reduce((sum, o) => sum + Number(o.total_amount), 0);
            setRunningTotal(total);
            
            // Flatten for basic display if needed, but we'll use allOrders for advanced UI
            const flattenItems: any[] = [];
            orders.forEach(o => {
                o.order_items.forEach((oi: any) => {
                    flattenItems.push({
                        name: oi.menu_items?.name || 'Unknown',
                        quantity: oi.quantity,
                        price: oi.price
                    });
                });
            });
            setRunningItems(flattenItems);
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

    const calculateTotalWithCharges = () => {
        if (!settings || settings.charge_amount === 0) return cartTotal;
        return settings.charge_type === 'fixed' 
            ? cartTotal + settings.charge_amount 
            : cartTotal + (cartTotal * settings.charge_amount / 100);
    };

    const calculateSelfPayTotal = () => {
        if (!settings || settings.charge_amount === 0) return runningTotal;
        return settings.charge_type === 'fixed' 
            ? runningTotal + settings.charge_amount 
            : runningTotal + (runningTotal * settings.charge_amount / 100);
    };

    const handleSelfPayConfirm = () => {
        supabase.channel('cafe_communications').send({
            type: 'broadcast',
            event: 'CUSTOMER_PAID',
            payload: { sessionId, tableNumber: tableNumber || tableId, amount: calculateSelfPayTotal() }
        });
        alert('Thank you! The manager has been notified.');
        setShowSelfPay(false);
    };

    const handlePlaceOrder = async () => {
        if (Object.keys(cart).length === 0 || !sessionId || !tableId) return;

        if (settings?.payment_timing === 'while_ordering') {
            setShowCart(false);
            setShowPaymentModal(true);
            return;
        }

        await executeOrderPlacement('pending');
    };

    const executeOrderPlacement = async (paymentStatus: string = 'pending') => {
        setIsPlacingOrder(true);
        setShowPaymentModal(false);
        setShowCart(false);

        const orderItemsList = Object.entries(cart).map(([itemId, quantity]) => {
            const item = menuItems.find((i) => i.id === itemId);
            return { item_id: itemId, quantity, price: item?.price };
        });

        const finalTotal = calculateTotalWithCharges();

        try {
            await placeOrder(sessionId as string, tableId as string, orderItemsList as any, finalTotal, paymentStatus);

            alert('Items added to your running order!');

            const newHistoryEntry = {
                date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
                items: orderItemsList.map(oi => {
                    const i = menuItems.find(m => m.id === oi.item_id);
                    return { name: i?.name, quantity: oi.quantity, price: oi.price };
                }),
                total: finalTotal,
            };
            const updatedHistory = [newHistoryEntry, ...localHistory];
            setLocalHistory(updatedHistory);
            localStorage.setItem('order_history', JSON.stringify(updatedHistory));

            setCart({});
            await fetchRunningOrder();
        } catch (err: any) {
            alert('Failed to place order: ' + err.message);
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
                            if (tableNumber) {
                                navigate(`/${tableNumber}`);
                            } else {
                                navigate(`/${tableId}`);
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
                        <h2 className="text-xl font-extrabold text-foreground tracking-tight">Menu</h2>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/20 rounded-full w-fit">
                            <Clock size={10} className="text-white/70" />
                            <p className="text-[10px] font-bold text-white/90">Table {tableNumber || tableId}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsGridView(!isGridView)}
                            className="flex items-center gap-2 p-2 bg-white/60 hover:bg-white/90 rounded-full text-teal-700 font-semibold transition text-sm shadow-sm backdrop-blur-md"
                            title={isGridView ? 'Switch to List View' : 'Switch to Grid View'}
                        >
                            {isGridView ? <List size={16} /> : <Grid size={16} />}
                        </button>
                        <button
                            onClick={() => setShowHistory(true)}
                            className="flex items-center gap-2 p-2 bg-white/60 hover:bg-white/90 rounded-full text-teal-700 font-semibold transition text-sm shadow-sm backdrop-blur-md"
                        >
                            <History size={16} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4 space-y-8 relative z-10">
                {/* Running Order Summary */}
                {allOrders.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                              <div className="flex items-center gap-3">
                                <h2 className="font-extrabold text-teal-900 text-lg flex items-center gap-2">
                                    <ShoppingCart size={20} className="text-teal-600" />
                                    Your Orders
                                </h2>
                                {isLive && (
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-teal-50 border border-teal-100 rounded-full animate-pulse-slow w-fit">
                                            <div className="w-1.5 h-1.5 bg-teal-500 rounded-full"></div>
                                            <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Live Sync</span>
                                        </div>
                                        <span className="text-[8px] text-teal-400 font-bold ml-1">Updated: {lastSync.toLocaleTimeString()}</span>
                                    </div>
                                )}
                             </div>
                            <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full font-bold uppercase tracking-wider">
                                Real-time Tracking
                            </span>
                        </div>

                        {notifPermission === 'default' && (
                            <button 
                                onClick={() => Notification.requestPermission().then(setNotifPermission)}
                                className="w-full bg-blue-50 border border-blue-200 p-3 rounded-2xl text-blue-700 text-xs font-bold flex items-center justify-center gap-2 mb-2"
                            >
                                <Bell size={14} /> Enable notifications for "Ready" alerts
                            </button>
                        )}


                        <div className="space-y-3">
                            {allOrders.map((order, oIdx) => (
                                <div key={order.id} className="glass-panel p-4 rounded-3xl border-l-4 border-l-teal-500 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Order #{allOrders.length - oIdx}</p>
                                            <div className="flex items-center gap-2">
                                                {order.status === 'pending' && <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1"><Clock size={10} /> Pending</span>}
                                                {order.status === 'preparing' && <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 animate-pulse"><Flame size={10} /> Preparing</span>}
                                                {order.status === 'completed' && <span className="bg-green-500 text-white px-2.5 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 shadow-sm"><CheckCircle2 size={10} /> Ready to Pick!</span>}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400 font-medium mb-1">{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                            <p className="font-extrabold text-teal-900">₹{Number(order.total_amount).toFixed(2)}</p>
                                        </div>
                                    </div>
                                    
                                    <ul className="space-y-1.5 pt-2 border-t border-teal-50">
                                        {order.order_items.map((item: any, iIdx: number) => (
                                            <li key={iIdx} className="flex justify-between items-center text-xs font-semibold text-teal-800">
                                                <span><span className="text-teal-500 font-black mr-1">{item.quantity}x</span> {item.menu_items?.name || 'Item'}</span>
                                                <span className="text-teal-400">₹{(item.price * item.quantity).toFixed(2)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        <div className="glass-panel p-5 rounded-3xl bg-white border border-teal-100 shadow-sm">
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-teal-900 font-extrabold text-sm uppercase tracking-wider">Total Bill Amount</span>
                                    <span className="text-[10px] text-teal-600 font-bold">(Completed Orders Only)</span>
                                </div>
                                <span className="text-3xl font-black text-teal-900">₹{runningTotal.toFixed(2)}</span>
                            </div>
                            {settings && settings.payment_timing !== 'dont_take_payment' && runningTotal > 0 && (
                                <button
                                    onClick={() => setShowSelfPay(true)}
                                    className="mt-3 w-full bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-bold py-3 rounded-2xl shadow-lg shadow-teal-200 transition-all hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
                                >
                                    <ShoppingCart size={16} /> Pay Now
                                </button>
                            )}
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
                            <div className={isGridView ? "grid grid-cols-2 md:grid-cols-3 gap-4" : "flex flex-col gap-3"}>
                                {catItems.map((item) => (
                                    isGridView ? (
                                    <div key={item.id} className="glass-panel p-4 rounded-3xl flex flex-col hover:shadow-lg transition-all duration-300 h-full">
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
                                                    <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"><Minus size={16} /></button>
                                                    <span className="w-6 text-center font-bold text-foreground text-sm">{cart[item.id]}</span>
                                                    <button onClick={() => addToCart(item.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-teal-600 hover:bg-teal-50 transition-colors"><Plus size={16} /></button>
                                                </div>
                                            ) : (
                                                <button onClick={() => addToCart(item.id)} className="w-10 h-10 bg-white/80 rounded-full flex items-center justify-center text-teal-600 shadow-sm border border-white hover:bg-white transition-all transform hover:scale-105 active:scale-95"><Plus size={20} strokeWidth={2.5} /></button>
                                            )}
                                        </div>
                                    </div>
                                    ) : (
                                    /* List View */
                                    <div key={item.id} className="glass-panel p-3 rounded-2xl flex items-center gap-3 hover:shadow-lg transition-all duration-300">
                                        <div className="w-16 h-16 bg-gray-50 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden shadow-sm">
                                            {item.image_url ? (
                                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-xl" />
                                            ) : (
                                                <Coffee size={20} className="opacity-30 text-teal-600" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-foreground text-sm line-clamp-1">{item.name}</h3>
                                            <p className="text-[10px] text-gray-500 line-clamp-1">{item.description}</p>
                                            <p className="font-extrabold text-teal-600 text-sm mt-0.5">₹{item.price.toFixed(2)}</p>
                                        </div>
                                        <div className="flex-shrink-0">
                                            {cart[item.id] ? (
                                                <div className="flex items-center bg-white/80 rounded-full p-0.5 shadow-sm border border-white">
                                                    <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"><Minus size={14} /></button>
                                                    <span className="w-5 text-center font-bold text-foreground text-xs">{cart[item.id]}</span>
                                                    <button onClick={() => addToCart(item.id)} className="w-7 h-7 rounded-full flex items-center justify-center text-teal-600 hover:bg-teal-50 transition-colors"><Plus size={14} /></button>
                                                </div>
                                            ) : (
                                                <button onClick={() => addToCart(item.id)} className="w-9 h-9 bg-white/80 rounded-full flex items-center justify-center text-teal-600 shadow-sm border border-white hover:bg-white transition-all transform hover:scale-105 active:scale-95"><Plus size={18} strokeWidth={2.5} /></button>
                                            )}
                                        </div>
                                    </div>
                                    )
                                ))}
                            </div>
                        </div>
                    );
                })}
            </main>

            {/* Floating Cart Bar */}
            {Object.keys(cart).length > 0 && (
                <div className="fixed bottom-6 left-0 right-0 px-4 z-30 animate-fade-in-up flex justify-center">
                    <button
                        onClick={() => setShowCart(true)}
                        className="glass-panel w-full max-w-sm rounded-full p-2 pl-4 pr-2 flex items-center justify-between shadow-[0_8px_30px_rgba(20,184,166,0.3)] hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-white/80 w-10 h-10 rounded-full flex items-center justify-center text-teal-600 font-bold shadow-sm">
                                {Object.values(cart).reduce((a, b) => a + b, 0)}
                            </div>
                            <span className="font-bold text-foreground">₹{cartTotal.toFixed(2)}</span>
                        </div>

                        <div className="bg-gradient-to-r from-teal-400 to-emerald-500 text-white px-6 py-3 rounded-full font-bold text-sm tracking-wide shadow-md flex items-center gap-2">
                            <ShoppingCart size={16} /> View Cart
                        </div>
                    </button>
                </div>
            )}

            {/* Cart Drawer Modal */}
            {showCart && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in-up" onClick={() => setShowCart(false)}>
                    <div className="bg-white rounded-t-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 border-b flex justify-between items-center bg-gradient-to-r from-teal-500 to-emerald-500 text-white">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <ShoppingCart size={20} /> Your Cart
                            </h2>
                            <button onClick={() => setShowCart(false)} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className="overflow-y-auto p-5 space-y-3 flex-grow">
                            {Object.entries(cart).length === 0 ? (
                                <p className="text-center text-gray-500 py-8">Your cart is empty.</p>
                            ) : (
                                Object.entries(cart).map(([itemId, qty]) => {
                                    const item = menuItems.find(i => i.id === itemId);
                                    if (!item) return null;
                                    return (
                                        <div key={itemId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                            <div className="w-14 h-14 bg-gray-100 rounded-xl flex-shrink-0 overflow-hidden">
                                                {item.image_url ? (
                                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-xl" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center"><Coffee size={18} className="opacity-30" /></div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-gray-900 text-sm line-clamp-1">{item.name}</h4>
                                                <p className="text-xs text-teal-600 font-bold">₹{(item.price * qty).toFixed(2)}</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="flex items-center bg-white rounded-full p-0.5 shadow-sm border border-gray-200">
                                                    <button onClick={() => removeFromCart(itemId)} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition"><Minus size={14} /></button>
                                                    <span className="w-6 text-center font-bold text-gray-900 text-sm">{qty}</span>
                                                    <button onClick={() => addToCart(itemId)} className="w-7 h-7 rounded-full flex items-center justify-center text-teal-600 hover:bg-teal-50 transition"><Plus size={14} /></button>
                                                </div>
                                                <button onClick={() => setCart(prev => { const c = {...prev}; delete c[itemId]; return c; })} className="w-7 h-7 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 transition">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        {Object.keys(cart).length > 0 && (
                            <div className="p-5 border-t bg-white shrink-0 space-y-3">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>Subtotal</span>
                                        <span>₹{cartTotal.toFixed(2)}</span>
                                    </div>
                                    {settings && settings.charge_amount > 0 && (
                                        <div className="flex justify-between text-sm text-gray-500">
                                            <span>Charges ({settings.charge_type === 'percentage' ? `${settings.charge_amount}%` : 'Fixed'})</span>
                                            <span>₹{(calculateTotalWithCharges() - cartTotal).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-lg font-black text-teal-900 border-t pt-2">
                                        <span>Total</span>
                                        <span>₹{calculateTotalWithCharges().toFixed(2)}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={handlePlaceOrder}
                                    disabled={isPlacingOrder}
                                    className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-teal-200 transition-all hover:shadow-xl active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isPlacingOrder ? (
                                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    ) : (
                                        <>Place Order</>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
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

            {/* Payment Modal */}
            {showPaymentModal && settings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-up">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900">Scan to Pay</h2>
                            <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle size={24} />
                            </button>
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded-xl mb-6">
                            <div className="flex justify-between text-sm text-gray-500 mb-2">
                                <span>Subtotal</span>
                                <span>₹{cartTotal.toFixed(2)}</span>
                            </div>
                            {settings.charge_amount > 0 && (
                                <div className="flex justify-between text-sm text-gray-500 mb-2 border-b border-gray-200 pb-2">
                                    <span>Taxes & Charges ({settings.charge_type === 'percentage' ? `${settings.charge_amount}%` : 'Fixed'})</span>
                                    <span>₹{(calculateTotalWithCharges() - cartTotal).toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-black text-lg text-teal-900 mt-2">
                                <span>Total to Pay</span>
                                <span>₹{calculateTotalWithCharges().toFixed(2)}</span>
                            </div>
                        </div>

                        {settings.upi_id && (
                            <div className="flex flex-col items-center mb-6">
                                <div className="bg-white p-2 rounded-xl border-2 border-teal-100 shadow-sm mb-3">
                                    <img 
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${settings.upi_id}&pn=${settings.payee_name || 'Cafe'}&am=${calculateTotalWithCharges().toFixed(2)}&tn=Table_${tableNumber || tableId}&cu=INR`)}`} 
                                        alt="UPI QR Code" 
                                        className="w-48 h-48"
                                    />
                                </div>
                                <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Scan with any UPI App</p>
                                
                                {/* Deep link for mobile users */}
                                <a 
                                    href={`upi://pay?pa=${settings.upi_id}&pn=${settings.payee_name || 'Cafe'}&am=${calculateTotalWithCharges().toFixed(2)}&tn=Table_${tableNumber || tableId}&cu=INR`}
                                    className="w-full bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold py-3 px-4 rounded-xl transition border border-teal-200 mb-2 text-sm text-center block"
                                >
                                    Pay with UPI Apps
                                </a>
                            </div>
                        )}

                        <button
                            onClick={() => executeOrderPlacement('paid')}
                            disabled={isPlacingOrder}
                            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 px-4 rounded-xl transition shadow-lg shadow-teal-200 disabled:opacity-50"
                        >
                            {isPlacingOrder ? 'Processing...' : 'I have Paid, Place Order'}
                        </button>
                        <p className="text-[10px] text-gray-400 mt-3">By clicking this, you confirm you have completed the payment.</p>
                    </div>
                </div>
            )}

            {/* Incoming Payment Request Modal (triggered by Manager) */}
            {incomingPayment && settings && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in-up">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center">
                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                            <Bell size={32} className="text-amber-600" />
                        </div>
                        <h2 className="text-xl font-black text-gray-900 mb-1">Payment Requested</h2>
                        <p className="text-sm text-gray-500 mb-5">The restaurant is requesting payment for your order.</p>

                        <div className="bg-teal-50 p-4 rounded-xl mb-6">
                            <div className="flex justify-between font-black text-2xl text-teal-900">
                                <span>Total:</span>
                                <span>{'\u20B9'}{incomingPayment.amount.toFixed(2)}</span>
                            </div>
                        </div>

                        {settings.upi_id && (
                            <div className="flex flex-col items-center mb-5">
                                <div className="bg-white p-2 rounded-xl border-2 border-teal-100 shadow-sm mb-3">
                                    <img 
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${settings.upi_id}&pn=${settings.payee_name || 'Cafe'}&am=${incomingPayment.amount.toFixed(2)}&tn=Table_${tableNumber || tableId}&cu=INR`)}`} 
                                        alt="UPI QR Code" 
                                        className="w-48 h-48"
                                    />
                                </div>
                                <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Scan with any UPI App</p>
                                <a 
                                    href={`upi://pay?pa=${settings.upi_id}&pn=${settings.payee_name || 'Cafe'}&am=${incomingPayment.amount.toFixed(2)}&tn=Table_${tableNumber || tableId}&cu=INR`}
                                    className="w-full bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold py-3 px-4 rounded-xl transition border border-teal-200 mb-2 text-sm text-center block"
                                >
                                    Pay with UPI Apps
                                </a>
                            </div>
                        )}

                        <button
                            onClick={() => setIncomingPayment(null)}
                            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl transition text-sm"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* Self Pay Modal (Initiated by Customer) */}
            {showSelfPay && settings && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in-up">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900">Pay Now</h2>
                            <button onClick={() => setShowSelfPay(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle size={24} />
                            </button>
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded-xl mb-6">
                            <div className="flex justify-between text-sm text-gray-500 mb-2">
                                <span>Subtotal</span>
                                <span>₹{runningTotal.toFixed(2)}</span>
                            </div>
                            {settings.charge_amount > 0 && (
                                <div className="flex justify-between text-sm text-gray-500 mb-2 border-b border-gray-200 pb-2">
                                    <span>Taxes & Charges ({settings.charge_type === 'percentage' ? `${settings.charge_amount}%` : 'Fixed'})</span>
                                    <span>₹{(calculateSelfPayTotal() - runningTotal).toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-black text-lg text-teal-900 mt-2">
                                <span>Total to Pay</span>
                                <span>₹{calculateSelfPayTotal().toFixed(2)}</span>
                            </div>
                        </div>

                        {settings.upi_id && (
                            <div className="flex flex-col items-center mb-6">
                                <div className="bg-white p-2 rounded-xl border-2 border-teal-100 shadow-sm mb-3">
                                    <img 
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${settings.upi_id}&pn=${settings.payee_name || 'Cafe'}&am=${calculateSelfPayTotal().toFixed(2)}&tn=Table_${tableNumber || tableId}&cu=INR`)}`} 
                                        alt="UPI QR Code" 
                                        className="w-48 h-48"
                                    />
                                </div>
                                <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Scan with any UPI App</p>
                                
                                <a 
                                    href={`upi://pay?pa=${settings.upi_id}&pn=${settings.payee_name || 'Cafe'}&am=${calculateSelfPayTotal().toFixed(2)}&tn=Table_${tableNumber || tableId}&cu=INR`}
                                    className="w-full bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold py-3 px-4 rounded-xl transition border border-teal-200 mb-2 text-sm text-center block"
                                >
                                    Pay with UPI Apps
                                </a>
                            </div>
                        )}

                        <button
                            onClick={handleSelfPayConfirm}
                            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 px-4 rounded-xl transition shadow-lg shadow-teal-200"
                        >
                            I have Paid
                        </button>
                        <p className="text-[10px] text-gray-400 mt-3">By clicking this, you confirm you have completed the payment.</p>
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="max-w-2xl mx-auto px-4 py-8 flex flex-col items-center justify-center opacity-40">
                <div className="h-px w-20 bg-teal-900/20 mb-4"></div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-900">Powered by VayuWebs</p>
            </footer>
        </div>
    );
}
