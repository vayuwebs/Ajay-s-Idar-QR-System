import { Link } from 'react-router-dom';
import { QrCode, Shield, Server, Coffee } from 'lucide-react';

export default function HomePage() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-8">
            <main className="flex-1 flex flex-col items-center justify-center max-w-3xl text-center">
                <div className="mb-8 w-48 h-48 flex items-center justify-center">
                    <img src="/client-logo.png" alt="Cafe Logo" className="max-w-full max-h-full object-contain drop-shadow-md" />
                </div>

                <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight mb-6 hidden">
                    Cafe QR Ordering System
                </h1>

                <p className="text-xl text-gray-500 mb-12 max-w-2xl leading-relaxed">
                    The ultimate 2-token security ordering system. Scan the QR code to claim a table, wait for physical staff activation, and receive a secure encrypted session token to order.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 w-full">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border text-left">
                        <QrCode className="text-blue-500 mb-4" size={32} />
                        <h3 className="font-bold text-lg mb-2">1. Permanent QR</h3>
                        <p className="text-gray-500 text-sm">Printed QR codes contain a static UUID that only allows claiming a table, not ordering.</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border text-left">
                        <Shield className="text-green-500 mb-4" size={32} />
                        <h3 className="font-bold text-lg mb-2">2. Staff Activation</h3>
                        <p className="text-gray-500 text-sm">Staff physically verify the customer and click 'Activate' to generate the real token.</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border text-left">
                        <Server className="text-purple-500 mb-4" size={32} />
                        <h3 className="font-bold text-lg mb-2">3. Encrypted Ordering</h3>
                        <p className="text-gray-500 text-sm">Orders are strictly tied to the volatile session token, blocking all remote access.</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <Link
                        to="/admin/dashboard"
                        className="flex-1 bg-gray-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-gray-800 transition shadow-lg flex items-center justify-center gap-2"
                    >
                        Go to Staff Dashboard
                    </Link>
                    <Link
                        to="/admin/orders"
                        className="flex-1 bg-white text-gray-900 border-2 border-gray-200 px-8 py-4 rounded-xl font-bold hover:bg-gray-50 transition shadow-sm flex items-center justify-center gap-2"
                    >
                        View Live Orders feed
                    </Link>
                </div>
            </main>
        </div>
    );
}
