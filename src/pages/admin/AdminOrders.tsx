import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { closeTable } from '@/services/orderService';
import { CheckCircle2, Clock, XCircle, Grid, Bell, BellOff, Edit2, Play, Trash2, Plus, Minus, X, Search, ShoppingCart } from 'lucide-react';

export default function AdminOrders() {
    const [orders, setOrders] = useState<any[]>([]);
    const ordersRef = useRef<any[]>([]);
    // Debounce ref to prevent rapid duplicate sounds when multiple order_items arrive at once
    const lastSoundTimeRef = useRef<number>(0);
    // Tab title flash interval
    const titleFlashRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const originalTitleRef = useRef<string>(document.title);
    // Notification permission state
    const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
        typeof Notification !== 'undefined' ? Notification.permission : 'denied'
    );
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [allMenuItems, setAllMenuItems] = useState<any[]>([]);
    const [editingOrder, setEditingOrder] = useState<any>(null);
    const [editItems, setEditItems] = useState<any[]>([]);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const channelRef = useRef<any>(null);

    useEffect(() => {
        ordersRef.current = orders;
    }, [orders]);

    // Request notification permission on mount
    useEffect(() => {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission().then((perm) => {
                setNotifPermission(perm);
            });
        }
    }, []);

    // Stop title flashing when user focuses the tab
    useEffect(() => {
        const handleFocus = () => {
            if (titleFlashRef.current) {
                clearInterval(titleFlashRef.current);
                titleFlashRef.current = null;
                document.title = originalTitleRef.current;
            }
        };
        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('focus', handleFocus);
            if (titleFlashRef.current) clearInterval(titleFlashRef.current);
        };
    }, []);

    const requestNotificationPermission = async () => {
        if (typeof Notification === 'undefined') return;
        const perm = await Notification.requestPermission();
        setNotifPermission(perm);
    };

    // Flash the tab title to attract attention
    const flashTabTitle = useCallback((message: string) => {
        if (document.hasFocus()) return; // Don't flash if tab is already focused
        if (titleFlashRef.current) clearInterval(titleFlashRef.current); // Clear existing flash

        let isOriginal = true;
        titleFlashRef.current = setInterval(() => {
            document.title = isOriginal ? `🔔 ${message}` : originalTitleRef.current;
            isOriginal = !isOriginal;
        }, 1000);
    }, []);

    // Send a browser push notification
    const sendPushNotification = useCallback((title: string, body: string) => {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

        try {
            const notification = new Notification(title, {
                body,
                icon: '/favicon.svg',
                badge: '/favicon.svg',
                tag: 'cafe-order-' + Date.now(), // unique tag so notifications don't stack
                requireInteraction: true, // stays until dismissed (mobile + desktop)
                silent: false,
            });

            // Vibrate on mobile if supported
            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200, 100, 300]);
            }

            // Focus the tab and redirect when notification is clicked
            notification.onclick = () => {
                window.focus();
                window.location.href = '/admin/orders';
                notification.close();
            };

            // Auto-close after 15 seconds
            setTimeout(() => notification.close(), 15000);
        } catch (err) {
            console.error('Push notification error:', err);
        }
    }, []);

    const playNotificationSound = useCallback((tableNumber: string | number, isNew: boolean) => {
        const now = Date.now();
        console.log(`🔔 Attempting to play sound for Table ${tableNumber} (isNew: ${isNew})`);

        // Debounce: only play if more than 1 second since last sound
        if (now - lastSoundTimeRef.current < 1000) {
            console.log('🔇 Sound debounced (too frequent)');
            return;
        }
        lastSoundTimeRef.current = now;

        try {
            // Manual sound fallback (extremely robust)
            const audio = new Audio('/notification_sound.wav');
            audio.play().catch(e => console.log('Audio autoplay blocked or failed:', e));

            if (isNew) {
                sendPushNotification(`🍽️ New Order`, `New order from Table ${tableNumber}`);
                flashTabTitle(`New Order - Table ${tableNumber}`);
            } else {
                sendPushNotification(`📦 More Items`, `Another order from Table ${tableNumber}`);
                flashTabTitle(`New Items - Table ${tableNumber}`);
            }
        } catch (err) {
            console.error('Audio error', err);
        }
    }, [sendPushNotification, flashTabTitle]);

    const fetchOrdersRef = useRef<((playSound?: boolean) => Promise<void>) | undefined>(undefined);
    // Track processed sessions and their item counts to detect changes per table
    const sessionStateRef = useRef<Record<string, number>>({});
    const isFirstLoadRef = useRef<boolean>(true);

    const fetchOrders = useCallback(async (playSound = false) => {
        const { data, error } = await supabase
            .from('orders')
            .select(`
        *,
        sessions(id, status, table_id, customer_name,
          tables!sessions_table_id_fkey(id, table_number)    
        ),
        order_items(quantity, price, menu_items(name))
      `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('fetchOrders error:', JSON.stringify(error, null, 2));
            return;
        }

        if (data) {
            const activeOrders = data.filter((o) => o.sessions && o.sessions.status === 'open');

            // Map current counts per session
            const currentSessionCounts: Record<string, number> = {};
            const sessionToTableMap: Record<string, string | number> = {};

            activeOrders.forEach(o => {
                const sId = o.sessions.id;
                const itemCount = o.order_items?.length || 0;
                currentSessionCounts[sId] = (currentSessionCounts[sId] || 0) + itemCount;
                sessionToTableMap[sId] = o.sessions.tables?.table_number || 'Unknown';
            });

            // Detect changes
            if (!isFirstLoadRef.current) {
                Object.entries(currentSessionCounts).forEach(([sId, count]) => {
                    const prevCount = sessionStateRef.current[sId];
                    const tableNum = sessionToTableMap[sId];

                    if (prevCount === undefined) {
                        // Brand new session/order
                        console.log(`🆕 DETECTED: New customer at Table ${tableNum}`);
                        playNotificationSound(tableNum, true);
                    } else if (count > prevCount) {
                        // Returning customer added items
                        console.log(`📦 DETECTED: Table ${tableNum} added items (${prevCount} -> ${count})`);
                        playNotificationSound(tableNum, false);
                    }
                });
            }

            isFirstLoadRef.current = false;
            sessionStateRef.current = currentSessionCounts;
            console.log('📊 Current Session State:', currentSessionCounts);

            setOrders(activeOrders);
        }
    }, [playNotificationSound]);

    // Store latest fetchOrders in ref for the interval callback
    useEffect(() => {
        fetchOrdersRef.current = fetchOrders;
    }, [fetchOrders]);

    useEffect(() => {
        // Initial fetch
        fetchOrders();

        // Fetch menu items for "Add Item" feature
        const fetchMenuItems = async () => {
            const { data } = await supabase.from('menu_items').select('*').eq('is_available', true).order('name');
            if (data) setAllMenuItems(data);
        };
        fetchMenuItems();


        // === SHARED COMMUNICATION CHANNEL (BROADCAST + REALTIME) ===
        const channel = supabase
            .channel('cafe_communications')
        channelRef.current = channel;

        channel
            // Listen for NEW orders from customers
            .on(
                'broadcast',
                { event: 'NEW_ORDER_PLACED' },
                (payload) => {
                    console.log('📡 Broadcast NEW_ORDER received!', payload);
                    fetchOrdersRef.current?.();
                }
            )
            .on(
                'broadcast',
                { event: 'TABLE_CLOSED' },
                (payload) => {
                    console.log('📡 Broadcast TABLE_CLOSED received!', payload);
                    fetchOrdersRef.current?.();
                }
            )
            // Listen for DB changes as backup
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'orders' },
                (payload) => {
                    console.log('🔥 DB INSERT detected!', payload.new);
                    fetchOrdersRef.current?.();
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'orders' },
                () => fetchOrdersRef.current?.()
            )
            .subscribe((status, err) => {
                console.log('🌐 Admin Channel Status:', status);
                if (err) console.error('Supabase Realtime error:', err);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchOrders]);

    const updateOrderStatus = async (orderId: string, status: string, sessionId?: string) => {
        const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
        if (error) {
            alert('Failed to update order status');
        } else {
            // Signal to clients that an order status changed (standard reliable broadcast)
            if (sessionId) {
                supabase.channel('cafe_communications').send({
                    type: 'broadcast',
                    event: 'ORDER_STATUS_UPDATED',
                    payload: { sessionId, status, orderId }
                });
            }
            fetchOrders();
        }
    };

    const handleEditOrder = (order: any) => {
        setEditingOrder(order);
        setEditItems(order.order_items.map((item: any) => ({
            ...item,
            originalQuantity: item.quantity
        })));
        setIsEditModalOpen(true);
    };

    const handleUpdateQuantity = (index: number, delta: number) => {
        setEditItems(prev => {
            const next = [...prev];
            const newQty = Math.max(0, next[index].quantity + delta);
            next[index] = { ...next[index], quantity: newQty };
            return next;
        });
    };

    const handleSaveEdits = async () => {
        if (!editingOrder) return;
        setIsSavingEdit(true);

        try {
            // 1. Calculate new total
            const newTotal = editItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            // 2. Update order total_amount
            const { error: orderError } = await supabase
                .from('orders')
                .update({ total_amount: newTotal })
                .eq('id', editingOrder.id);

            if (orderError) throw orderError;

            // 3. Process items
            for (const item of editItems) {
                const menuItemId = item.menu_item_id || item.id;
                
                if (item.quantity === 0) {
                    // Delete if qty is 0 and it was an existing item
                    if (item.originalQuantity !== undefined) {
                        await supabase
                            .from('order_items')
                            .delete()
                            .eq('order_id', editingOrder.id)
                            .eq('menu_item_id', menuItemId);
                    }
                } else if (item.originalQuantity === undefined) {
                    // New item added during edit
                    await supabase
                        .from('order_items')
                        .insert({
                            order_id: editingOrder.id,
                            menu_item_id: menuItemId,
                            quantity: item.quantity,
                            price: item.price
                        });
                } else if (item.quantity !== item.originalQuantity) {
                    // Update existing item
                    await supabase
                        .from('order_items')
                        .update({ quantity: item.quantity })
                        .eq('order_id', editingOrder.id)
                        .eq('menu_item_id', menuItemId);
                }
            }

            setIsEditModalOpen(false);
            setSearchQuery('');
            fetchOrders();
        } catch (err: any) {
            alert('Error updating order: ' + err.message);
        } finally {
            setIsSavingEdit(false);
        }
    };

    const addItemToEditList = (menuItem: any) => {
        setEditItems(prev => {
            const existing = prev.find(i => (i.menu_item_id || i.id) === menuItem.id);
            if (existing) {
                return prev.map(i => (i.menu_item_id || i.id) === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...menuItem, quantity: 1, menu_items: { name: menuItem.name } }];
        });
    };


    const handleCloseTable = async (sessionId: string, tableId: string) => {
        if (!confirm("Close this table? This clears their session from Live Orders.")) return;

        try {
            await closeTable(sessionId, tableId);
            fetchOrders();
        } catch (err) {
            alert('Error closing table.');
        }
    };

    // Group by session (table)
    const groupedSessions: Record<string, { session: any; table: any; orders: any[] }> = {};

    orders.forEach((o) => {
        const sId = o.sessions.id;
        if (!groupedSessions[sId]) {
            groupedSessions[sId] = {
                session: o.sessions,
                table: o.sessions.tables,
                orders: [],
            };
        }
        groupedSessions[sId].orders.push(o);
    });

    const activeSessions = Object.values(groupedSessions).sort((a, b) => {
        return (a.table?.table_number || 0) - (b.table?.table_number || 0);
    });

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-5xl mx-auto">
                <header className="mb-4 bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <Grid className="text-blue-600" /> Live Kitchen Orders
                        </h1>
                        <p className="text-gray-500 mt-1">Real-time sync. Grouped by Table.</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="text-sm px-4 py-2 bg-green-50 text-green-700 font-semibold rounded-lg border border-green-200 flex items-center gap-2 animate-pulse">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div> Connection Live
                        </div>
                    </div>
                </header>

                {/* Notification Permission Banner */}
                {notifPermission !== 'granted' ? (
                    <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                                <BellOff size={22} />
                            </div>
                            <div>
                                <p className="font-bold text-amber-900 text-sm">Push Notifications Disabled</p>
                                <p className="text-amber-700 text-xs">Enable to get alerts even when you're on another tab or app.</p>
                            </div>
                        </div>
                        <button
                            onClick={requestNotificationPermission}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-sm transition shadow-sm whitespace-nowrap"
                        >
                            <Bell size={16} /> Enable Notifications
                        </button>
                    </div>
                ) : (
                    <div className="mb-8 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
                        <div className="p-1.5 bg-green-100 rounded-lg text-green-600">
                            <Bell size={18} />
                        </div>
                        <p className="text-green-800 text-sm font-medium">🔔 Push notifications are enabled — you'll get alerts even on other tabs/apps.</p>
                    </div>
                )}

                <div className="space-y-8">
                    {activeSessions.map((group) => {
                        const { session, table, orders: sessionOrders } = group;
                        const totalSessionAmount = sessionOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

                        return (
                            <div key={session.id} className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
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

                                <div className="p-4 space-y-4 bg-gray-50">
                                    {sessionOrders.map((order, orderIndex) => {
                                        const isDone = order.status === 'completed' || order.status === 'cancelled';
                                        
                                        return (
                                            <div key={order.id} className={`bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center ${isDone ? 'py-2 opacity-75' : 'py-4'}`}>
                                                <div className="flex-1 w-full">
                                                    {isDone ? (
                                                        /* Compressed View for Completed/Cancelled */
                                                        <div className="flex justify-between items-center text-sm">
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-bold text-gray-400">Order #{sessionOrders.length - orderIndex}</span>
                                                                <div className="flex items-center gap-2">
                                                                    {order.status === 'completed' ? (
                                                                        <span className="text-green-600 font-black text-[10px] uppercase flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full border border-green-100"><CheckCircle2 size={10} /> Ready</span>
                                                                    ) : (
                                                                        <span className="text-red-400 font-black text-[10px] uppercase flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-full border border-red-100"><XCircle size={10} /> Cancelled</span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] text-gray-300 font-medium">{new Date(order.created_at).toLocaleTimeString()}</span>
                                                            </div>
                                                            <span className="font-bold text-gray-400">₹{Number(order.total_amount).toFixed(2)}</span>
                                                        </div>
                                                    ) : (
                                                        /* Full View for Active Orders */
                                                        <>
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
                                                                        <span><span className="font-bold text-blue-600 mr-2">{item.quantity}x</span> {item.menu_items?.name || 'Unknown Item'}</span>
                                                                        <span className="text-gray-400">₹{(item.price * item.quantity).toFixed(2)}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </>
                                                    )}
                                                </div>
                                                
                                                {!isDone && (
                                                    <div className="w-full md:w-48 shrink-0 flex flex-col gap-2 justify-center">
                                                        {order.status === 'pending' && (
                                                            <div className="flex flex-col gap-2">
                                                                <button
                                                                    onClick={() => updateOrderStatus(order.id, 'preparing', session.id)}
                                                                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95"
                                                                >
                                                                    <Play size={18} /> Accept Order
                                                                </button>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => handleEditOrder(order)}
                                                                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 text-sm transition"
                                                                    >
                                                                        <Edit2 size={14} /> Edit
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { if(confirm('Cancel this sub-order?')) updateOrderStatus(order.id, 'cancelled') }}
                                                                        className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 text-sm transition border border-red-100"
                                                                    >
                                                                        <Trash2 size={14} /> Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {order.status === 'preparing' && (
                                                            <div className="flex flex-col gap-2">
                                                                <button
                                                                    onClick={() => updateOrderStatus(order.id, 'completed', session.id)}
                                                                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95"
                                                                >
                                                                    <CheckCircle2 size={18} /> Mark Ready
                                                                </button>
                                                                <button
                                                                    onClick={() => handleEditOrder(order)}
                                                                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm transition"
                                                                >
                                                                    <Edit2 size={16} /> Edit Order
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

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

            {/* Edit Order Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[90vh]">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50 shrink-0">
                            <div>
                                <h3 className="font-bold text-xl text-gray-900">Edit Order: Table {editingOrder?.sessions?.tables?.table_number}</h3>
                                <p className="text-sm text-gray-500 mt-0.5">Manage items and quantities in this sub-order.</p>
                            </div>
                            <button onClick={() => { setIsEditModalOpen(false); setSearchQuery(''); }} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition"><X size={24} /></button>
                        </div>
                        
                        <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
                            {/* Left: Current Items */}
                            <div className="flex-1 p-6 overflow-y-auto border-r border-gray-100 flex flex-col gap-4">
                                <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Order Items</h4>
                                {editItems.filter(i => i.quantity > 0).length === 0 ? (
                                    <div className="flex-grow flex flex-col items-center justify-center text-gray-400 py-12">
                                        <ShoppingCart size={40} className="opacity-20 mb-3" />
                                        <p>No items in this order</p>
                                    </div>
                                ) : (
                                    editItems.filter(i => i.quantity > 0).map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <div className="flex-1">
                                                <p className="font-bold text-gray-900 leading-tight">{item.menu_items?.name || 'Unknown Item'}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">₹{Number(item.price).toFixed(2)}</p>
                                            </div>
                                            <div className="flex items-center gap-3 ml-4">
                                                <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5 shadow-sm">
                                                    <button 
                                                        onClick={() => {
                                                            const actualIdx = editItems.findIndex(ei => ei === item);
                                                            handleUpdateQuantity(actualIdx, -1);
                                                        }}
                                                        className="p-1 text-gray-500 hover:bg-gray-100 rounded transition"
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <span className="w-8 text-center font-bold text-sm text-gray-900">{item.quantity}</span>
                                                    <button 
                                                        onClick={() => {
                                                            const actualIdx = editItems.findIndex(ei => ei === item);
                                                            handleUpdateQuantity(actualIdx, 1);
                                                        }}
                                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                                <div className="w-16 text-right font-bold text-gray-900 text-sm">
                                                    ₹{(item.price * item.quantity).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Right: Add More Items */}
                            <div className="flex-1 p-6 bg-gray-50/50 flex flex-col overflow-hidden">
                                <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Add Items</h4>
                                <div className="relative mb-4">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input 
                                        type="text"
                                        placeholder="Search menu..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm shadow-sm"
                                    />
                                </div>
                                <div className="flex-grow overflow-y-auto space-y-2 pr-1">
                                    {allMenuItems
                                        .filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                        .map((item) => (
                                            <button 
                                                key={item.id}
                                                onClick={() => addItemToEditList(item)}
                                                className="w-full flex items-center justify-between p-2 bg-white hover:bg-white border border-transparent hover:border-blue-200 rounded-xl transition-all shadow-sm group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                                                        {item.image_url ? (
                                                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 uppercase">No img</div>
                                                        )}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="font-bold text-gray-900 text-xs line-clamp-1 group-hover:text-blue-600">{item.name}</p>
                                                        <p className="text-[10px] text-gray-500">₹{Number(item.price).toFixed(2)}</p>
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50 p-1.5 rounded-full text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                    <Plus size={14} />
                                                </div>
                                            </button>
                                        ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t bg-gray-50 shrink-0 flex flex-col sm:flex-row items-center gap-6">
                            <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <span className="text-sm text-gray-500 font-bold uppercase tracking-wider">Total</span>
                                <span className="text-2xl font-black text-blue-700">₹{editItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0).toFixed(2)}</span>
                            </div>
                            <div className="flex-grow flex gap-3 w-full sm:w-auto">
                                <button
                                    onClick={() => { setIsEditModalOpen(false); setSearchQuery(''); }}
                                    className="flex-1 py-3.5 px-6 text-gray-600 font-bold hover:bg-gray-200 rounded-2xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEdits}
                                    disabled={isSavingEdit}
                                    className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 px-6 rounded-2xl shadow-xl shadow-blue-200 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    {isSavingEdit ? (
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <CheckCircle2 size={20} />
                                    )}
                                    {isSavingEdit ? 'Applying Changes...' : 'Save Order Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
