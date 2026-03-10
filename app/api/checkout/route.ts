import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { sessionId, tableId } = body;

        if (!sessionId || !tableId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Verify Session Ownership
        const { data: session, error: sessionError } = await supabase
            .from("sessions")
            .select("status, table_id")
            .eq("id", sessionId)
            .single();

        if (sessionError || !session || session.status !== "open" || session.table_id !== tableId) {
            return NextResponse.json({ error: "Invalid or expired session" }, { status: 403 });
        }

        // 2. Mark Session as closed
        const { error: closeSessionError } = await supabase
            .from("sessions")
            .update({
                status: "closed",
                ended_at: new Date().toISOString()
            })
            .eq("id", sessionId);

        if (closeSessionError) throw closeSessionError;

        // 3. Free up the Table
        const { error: freeTableError } = await supabase
            .from("tables")
            .update({
                status: "free",
                current_session_id: null
            })
            .eq("id", tableId);

        if (freeTableError) throw freeTableError;

        return NextResponse.json({ success: true, message: "Table closed successfully" }, { status: 200 });

    } catch (error: any) {
        console.error("API Error - /api/checkout:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
