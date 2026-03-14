import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function TablePage() {
    const { table_uuid } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tableInfo, setTableInfo] = useState<any>(null);

    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        async function checkTableAndSession() {
            if (!table_uuid) return;
            try {
                const { data: table, error: tableError } = await supabase
                    .from('tables')
                    .select('*')
                    .eq('table_number', table_uuid)
                    .single();

                if (tableError || !table) {
                    setError('Invalid QR Code. Table not found.');
                    setLoading(false);
                    return;
                }
                setTableInfo(table);

                const savedSessionId = localStorage.getItem(`session_id_${table.id}`);
                const savedName = localStorage.getItem('customer_name') || '';
                const savedPhone = localStorage.getItem('customer_phone') || '';

                if (savedName) setCustomerName(savedName);
                if (savedPhone) setCustomerPhone(savedPhone);

                if (savedSessionId && table.status === 'occupied' && table.current_session_id === savedSessionId) {
                    navigate(`/menu?session=${savedSessionId}&table=${table.id}`);
                    return;
                }

                if (table.status === 'occupied' && table.current_session_id !== savedSessionId) {
                    setError('Table is currently in use. Please contact staff.');
                    setLoading(false);
                    return;
                }
            } catch (err: any) {
                console.error(err);
                setError('An error occurred loading the table data.');
            } finally {
                setLoading(false);
            }
        }

        checkTableAndSession();
    }, [table_uuid, navigate]);

    const handleStartOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerName.trim() || !customerPhone.trim() || !tableInfo) return;

        const phoneDigits = customerPhone.replace(/\D/g, '');
        if (phoneDigits.length !== 10) {
            setError('Please enter a valid 10-digit phone number.');
            return;
        }

        setIsSubmitting(true);

        try {
            const { data: sessionData, error: sessionError } = await supabase
                .from('sessions')
                .insert({
                    table_id: tableInfo.id,
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    status: 'open',
                })
                .select('id')
                .single();

            if (sessionError || !sessionData) throw sessionError;

            const { error: updateError } = await supabase
                .from('tables')
                .update({
                    status: 'occupied',
                    current_session_id: sessionData.id,
                })
                .eq('id', tableInfo.id);

            if (updateError) throw updateError;

            localStorage.setItem(`session_id_${tableInfo.id}`, sessionData.id);
            localStorage.setItem('customer_name', customerName);
            localStorage.setItem('customer_phone', customerPhone);

            navigate(`/menu?session=${sessionData.id}&table=${tableInfo.id}`);
        } catch (err: any) {
            setError(err.message || 'Failed to start session.');
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">Loading table data...</div>;
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <div className="bg-red-50 text-red-600 p-6 rounded-lg text-center shadow-sm max-w-md w-full">
                    <p className="font-semibold text-lg">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
            <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>

            <div className="glass-panel p-10 rounded-3xl w-full max-w-md text-center relative z-10 transition-all duration-500">
                <h1 className="text-3xl font-extrabold text-foreground mb-2 tracking-tight">Welcome to<br />The Daily Grind</h1>
                <p className="inline-block text-gray-700 px-3 py-1 text-sm font-semibold mb-8">
                    - Table {tableInfo?.table_number} -
                </p>

                {tableInfo?.status === 'free' && (
                    <div className="animate-fade-in-up">
                        <p className="text-gray-500 mb-8 font-medium">Please enter your details to start your seamless ordering experience.</p>

                        <form onSubmit={handleStartOrder} className="flex flex-col gap-6 text-left">
                            <div className="space-y-1">
                                <input
                                    type="text"
                                    className="w-full bg-white/60 border border-white/50 backdrop-blur-sm rounded-2xl px-5 py-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white/90 transition-all shadow-sm placeholder-gray-500"
                                    placeholder="Enter Name"
                                    value={customerName}
                                    onChange={(e) => {
                                        setCustomerName(e.target.value);
                                        setError('');
                                    }}
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <input
                                    type="tel"
                                    className="w-full bg-white/60 border border-white/50 backdrop-blur-sm rounded-2xl px-5 py-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white/90 transition-all shadow-sm placeholder-gray-500"
                                    placeholder="Enter Phone Number"
                                    value={customerPhone}
                                    onChange={(e) => {
                                        setCustomerPhone(e.target.value);
                                        setError('');
                                    }}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="mt-4 w-full bg-gradient-to-r from-teal-400 to-emerald-500 text-white font-bold text-lg py-4 rounded-full hover:opacity-90 transition-all shadow-[0_8px_20px_rgba(20,184,166,0.4)] flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Starting...
                                    </>
                                ) : 'Start Ordering'}
                            </button>
                            <p className="text-xs text-center text-gray-500 mt-2">Already ordered?<br />Your session will load automatically.</p>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
