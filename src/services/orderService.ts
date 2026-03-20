import { supabase } from '@/lib/supabase';

/**
 * Place an order — replaces the /api/orders Next.js API route.
 * Validates session, finds or creates an order, then inserts order items.
 */
export async function placeOrder(
    sessionId: string,
    tableId: string,
    items: Array<{ item_id: string; quantity: number; price: number }>,
    totalAmountToAdd: number
) {
    // 1. Validate Session & Table Ownership
    const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('id, status, table_id')
        .eq('id', sessionId)
        .single();

    if (sessionError || !session || session.status !== 'open' || session.table_id !== tableId) {
        throw new Error('Invalid or expired session');
    }

    const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('status, current_session_id')
        .eq('id', tableId)
        .single();

    if (tableError || !table || table.status !== 'occupied' || table.current_session_id !== sessionId) {
        throw new Error('Table is not occupied by this session');
    }

    // 2. Find existing pending order (Running Tab) OR create a new one
    let orderId: string;
    const { data: existingOrder } = await supabase
        .from('orders')
        .select('id, total_amount')
        .eq('session_id', sessionId)
        .eq('status', 'pending')
        .single();

    if (existingOrder) {
        orderId = existingOrder.id;
        const newTotal = Number(existingOrder.total_amount) + Number(totalAmountToAdd);
        await supabase
            .from('orders')
            .update({ total_amount: newTotal })
            .eq('id', orderId);
    } else {
        const { data: newOrder, error: orderError } = await supabase
            .from('orders')
            .insert({
                session_id: sessionId,
                table_id: tableId,
                total_amount: totalAmountToAdd,
                status: 'pending',
            })
            .select('id')
            .single();

        if (orderError || !newOrder) {
            throw new Error('Failed to create order');
        }
        orderId = newOrder.id;
    }

    // 3. Insert items into order_items table
    const itemsToInsert = items.map((item) => ({
        order_id: orderId,
        menu_item_id: item.item_id,
        quantity: item.quantity,
        price: item.price,
    }));

    const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

    if (itemsError) {
        throw new Error('Failed to add items to order');
    }

    // Signal to admin that a new order arrived
    supabase.channel('cafe_communications').send({
        type: 'broadcast',
        event: 'NEW_ORDER_PLACED',
        payload: { sessionId, tableId }
    });

    return { success: true, message: 'Items added to running order' };
}

/**
 * Close a table — replaces the /api/checkout Next.js API route.
 * Closes the session and frees the table.
 */
export async function closeTable(sessionId: string, tableId: string) {
    // 1. Verify Session Ownership
    const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('status, table_id')
        .eq('id', sessionId)
        .single();

    if (sessionError || !session || session.status !== 'open' || session.table_id !== tableId) {
        throw new Error('Invalid or expired session');
    }

    // 2. Mark Session as closed
    const { error: closeSessionError } = await supabase
        .from('sessions')
        .update({
            status: 'closed',
            ended_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

    if (closeSessionError) throw closeSessionError;

    // 3. Free up the Table
    const { error: freeTableError } = await supabase
        .from('tables')
        .update({
            status: 'free',
            current_session_id: null,
        })
        .eq('id', tableId);

    if (freeTableError) throw freeTableError;

    // Signal to admin that a table was closed
    supabase.channel('cafe_communications').send({
        type: 'broadcast',
        event: 'TABLE_CLOSED',
        payload: { sessionId, tableId }
    });

    return { success: true, message: 'Table closed successfully' };
}
