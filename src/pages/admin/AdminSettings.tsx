import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, Lock, Mail, AlertTriangle } from 'lucide-react';

export default function AdminSettings() {
    const [currentEmail, setCurrentEmail] = useState('');

    const [newEmail, setNewEmail] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);
    const [emailMessage, setEmailMessage] = useState({ type: '', text: '' });

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && user.email) {
                setCurrentEmail(user.email);
            }
        };
        fetchUser();
    }, []);

    const handleUpdateEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailMessage({ type: '', text: '' });
        setEmailLoading(true);

        if (!newEmail || newEmail === currentEmail) {
            setEmailMessage({ type: 'error', text: 'Please enter a new, valid email address.' });
            setEmailLoading(false);
            return;
        }

        const { error } = await supabase.auth.updateUser({ email: newEmail });

        if (error) {
            setEmailMessage({ type: 'error', text: error.message });
        } else {
            setEmailMessage({ type: 'success', text: 'Check both your old and new email addresses for confirmation links to complete the change.' });
            setNewEmail('');
        }
        setEmailLoading(false);
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordMessage({ type: '', text: '' });
        setPasswordLoading(true);

        if (newPassword.length < 6) {
            setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
            setPasswordLoading(false);
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'Passwords do not match.' });
            setPasswordLoading(false);
            return;
        }

        const { error } = await supabase.auth.updateUser({ password: newPassword });

        if (error) {
            setPasswordMessage({ type: 'error', text: error.message });
        } else {
            setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
            setNewPassword('');
            setConfirmPassword('');
        }
        setPasswordLoading(false);
    };

    return (
        <div className="p-8">
            <div className="max-w-4xl mx-auto">
                <header className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h1 className="text-3xl font-bold text-gray-900">Admin Settings</h1>
                    <p className="text-gray-500 mt-1">Manage your account credentials and security preferences.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Update Email Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                            <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                                <Mail size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Email Address</h2>
                                <p className="text-sm text-gray-500">Current: {currentEmail || 'Loading...'}</p>
                            </div>
                        </div>

                        {emailMessage.text && (
                            <div className={`p-3 rounded-lg mb-4 text-sm font-medium border ${emailMessage.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                                {emailMessage.text}
                            </div>
                        )}

                        <form onSubmit={handleUpdateEmail} className="flex flex-col flex-grow">
                            <div className="mb-6 flex-grow">
                                <label className="block text-sm font-medium text-gray-700 mb-2">New Email Address</label>
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder="new.admin@cafe.com"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <div className="mt-3 flex gap-2 text-amber-600 text-xs bg-amber-50 p-3 rounded border border-amber-100">
                                    <AlertTriangle size={16} className="flex-shrink-0" />
                                    <p>Changing your email requires clicking confirmation links sent to <strong>both</strong> your old and new email addresses.</p>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={emailLoading || !newEmail}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {emailLoading ? (
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : <><Save size={18} /> Update Email</>}
                            </button>
                        </form>
                    </div>

                    {/* Update Password Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                            <div className="bg-purple-50 p-2 rounded-lg text-purple-600">
                                <Lock size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Change Password</h2>
                                <p className="text-sm text-gray-500">Ensure your account stays secure.</p>
                            </div>
                        </div>

                        {passwordMessage.text && (
                            <div className={`p-3 rounded-lg mb-4 text-sm font-medium border ${passwordMessage.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                                {passwordMessage.text}
                            </div>
                        )}

                        <form onSubmit={handleUpdatePassword} className="flex flex-col flex-grow">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            <div className="mb-6 flex-grow">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={passwordLoading || !newPassword || !confirmPassword}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-4 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {passwordLoading ? (
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : <><Save size={18} /> Update Password</>}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
