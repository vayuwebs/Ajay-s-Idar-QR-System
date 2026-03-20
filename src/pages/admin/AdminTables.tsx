import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, QrCode, XCircle, Download, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function AdminTables() {
    const [tables, setTables] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddingTable, setIsAddingTable] = useState(false);
    const [newTableNumber, setNewTableNumber] = useState('');

    const [selectedQrTable, setSelectedQrTable] = useState<any>(null);
    const [qrLabel, setQrLabel] = useState('Scan to Order!');

    const fetchTables = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('tables')
            .select(`*`)
            .order('table_number');

        if (data) setTables(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchTables();
    }, []);

    const handleAddTable = async () => {
        if (!newTableNumber) return;
        setIsAddingTable(true);
        try {
            const parsedNumber = parseInt(newTableNumber.replace(/\D/g, ''), 10);
            if (isNaN(parsedNumber)) {
                alert('Please include a valid number for the table.');
                setIsAddingTable(false);
                return;
            }

            const { error } = await supabase.from('tables').insert({ table_number: parsedNumber });
            if (error) {
                if (error.code === '23505') alert('Table number already exists!');
                else throw error;
            } else {
                setNewTableNumber('');
                fetchTables();
            }
        } catch (err) {
            alert('Error adding table.');
        } finally {
            setIsAddingTable(false);
        }
    };

    const handleDeleteTable = async (tableId: string, status: string) => {
        if (status !== 'free') {
            alert('Cannot delete an occupied table.');
            return;
        }
        if (!confirm('Are you sure you want to permanently delete this table?')) return;

        try {
            const { error } = await supabase.from('tables').delete().eq('id', tableId);
            if (error) throw error;
            fetchTables();
        } catch (err) {
            alert('Error deleting table.');
        }
    };

    const downloadQRCode = () => {
        const svg = document.getElementById('qr-code-svg');
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = img.width + 80;
            canvas.height = img.height + 120;
            if (!ctx) return;

            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 40, 40);

            ctx.fillStyle = 'black';
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(qrLabel || `Table ${selectedQrTable?.table_number}`, canvas.width / 2, canvas.height - 30);

            const pngFile = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.download = `Table-${selectedQrTable?.table_number}-QR.png`;
            downloadLink.href = `${pngFile}`;
            downloadLink.click();
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    };

    return (
        <div className="p-8">
            <div className="max-w-6xl mx-auto">
                <header className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Table Manager</h1>
                        <p className="text-gray-500 mt-1">Manage tables and generate QR codes</p>
                    </div>
                    <button
                        onClick={fetchTables}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700 transition"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </header>

                <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900">Table Management</h2>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Table Number"
                                className="border rounded-lg px-4 py-2 w-48 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={newTableNumber}
                                onChange={(e) => setNewTableNumber(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTable()}
                            />
                            <button
                                onClick={handleAddTable}
                                disabled={isAddingTable || !newTableNumber}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition"
                            >
                                <Plus size={18} /> Add
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-y text-gray-500 text-sm">
                                    <th className="py-3 px-4 font-semibold">Table Number</th>
                                    <th className="py-3 px-4 font-semibold">Current Status</th>
                                    <th className="py-3 px-4 font-semibold">QR Code Token (UUID)</th>
                                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tables.map(table => (
                                    <tr key={table.id} className="border-b hover:bg-gray-50">
                                        <td className="py-3 px-4 font-bold">Table {table.table_number}</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${table.status === 'free' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {table.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-gray-400 font-mono text-xs">{table.qr_token || '-'}</td>
                                        <td className="py-3 px-4 text-right flex justify-end gap-2">
                                            <button
                                                onClick={() => setSelectedQrTable(table)}
                                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded transition flex items-center gap-1 text-xs font-semibold"
                                                title="View and Download QR Code"
                                            >
                                                <QrCode size={16} /> QR
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTable(table.id, table.status)}
                                                disabled={table.status !== 'free'}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition disabled:opacity-30 disabled:hover:bg-transparent"
                                                title={table.status !== 'free' ? 'Cannot delete occupied table' : 'Delete table'}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {tables.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-gray-500">No tables created yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* QR Code Modal */}
            {selectedQrTable && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in-up">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <QrCode className="text-blue-600" /> Table {selectedQrTable.table_number} QR
                            </h2>
                            <button onClick={() => setSelectedQrTable(null)} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="p-8 flex flex-col items-center bg-white">
                            <div className="bg-white p-4 rounded-xl border-2 border-dashed border-gray-200 shadow-sm mb-6">
                                <QRCodeSVG
                                    id="qr-code-svg"
                                    value={`${window.location.origin}/${selectedQrTable.table_number}`}
                                    size={200}
                                    level="H"
                                    includeMargin={true}
                                />
                            </div>

                            <div className="w-full space-y-2 mb-6">
                                <label className="text-sm font-bold text-gray-700">Custom Label Text</label>
                                <input
                                    type="text"
                                    value={qrLabel}
                                    onChange={(e) => setQrLabel(e.target.value)}
                                    maxLength={30}
                                    placeholder="e.g. Scan to Order!"
                                    className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <p className="text-xs text-gray-400 text-right">{qrLabel.length}/30</p>
                            </div>

                            <button
                                onClick={downloadQRCode}
                                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition shadow-md"
                            >
                                <Download size={20} /> Download QR Image
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
