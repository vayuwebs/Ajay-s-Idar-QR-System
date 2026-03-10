import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
    try {
        const sessionId = req.headers.get("x-session-id");
        if (!sessionId) {
            return NextResponse.json({ error: "Missing session ID" }, { status: 401 });
        }

        const body = await req.json();
        const { tableId, items, totalAmountToAdd } = body; // items is array of {item_id, quantity, price}

        if (!tableId || !items || totalAmountToAdd === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Validate Session & Table Ownership
        const { data: session, error: sessionError } = await supabase
            .from("sessions")
            .select("id, status, table_id")
            .eq("id", sessionId)
            .single();

        if (sessionError || !session || session.status !== "open" || session.table_id !== tableId) {
            return NextResponse.json({ error: "Invalid or expired session" }, { status: 403 });
        }

        const { data: table, error: tableError } = await supabase
            .from("tables")
            .select("status, current_session_id")
            .eq("id", tableId)
            .single();

        if (tableError || !table || table.status !== "occupied" || table.current_session_id !== sessionId) {
            return NextResponse.json({ error: "Table is not occupied by this session" }, { status: 403 });
        }

        // 2. Find existing pending order (Running Tab) OR create a new one
        let orderId;
        const { data: existingOrder } = await supabase
            .from("orders")
            .select("id, total_amount")
            .eq("session_id", sessionId)
            .eq("status", "pending")
            .single();

        if (existingOrder) {
            orderId = existingOrder.id;
            // Update the running total
            const newTotal = Number(existingOrder.total_amount) + Number(totalAmountToAdd);
            await supabase
                .from("orders")
                .update({ total_amount: newTotal })
                .eq("id", orderId);
        } else {
            // Create a brand new order for the session
            const { data: newOrder, error: orderError } = await supabase
                .from("orders")
                .insert({
                    session_id: sessionId,
                    table_id: tableId,
                    total_amount: totalAmountToAdd,
                    status: "pending"
                })
                .select("id")
                .single();

            if (orderError || !newOrder) {
                return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
            }
            orderId = newOrder.id;
        }

        // 3. Insert items into order_items table (Relational)
        const itemsToInsert = items.map((item: any) => ({
            order_id: orderId,
            menu_item_id: item.item_id,
            quantity: item.quantity,
            price: item.price
        }));

        const { error: itemsError } = await supabase
            .from("order_items")
            .insert(itemsToInsert);

        if (itemsError) {
            console.error("Order items insertion error:", itemsError);
            return NextResponse.json({ error: "Failed to add items to order" }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Items added to running order" }, { status: 201 });

    } catch (error: any) {
        console.error("API Error - /api/orders:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
