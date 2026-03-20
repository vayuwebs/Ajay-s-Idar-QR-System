import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Mail, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);
        setLoading(true);

        const { error } = await supabase.auth.signInWithOtp({
            email,
        });

        if (error) {
            setError(error.message);
        } else {
            setSuccess(true);
            localStorage.setItem('reset_email', email);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <Link to="/admin/login" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800 mb-6 font-medium">
                    <ArrowLeft size={16} className="mr-1" /> Back to login
                </Link>

                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <KeyRound size={32} />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Forgot Password?</h1>
                <p className="text-center text-gray-500 mb-8 text-sm">Enter your email and we'll send you a 6-digit code to reset your password.</p>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm text-center font-medium border border-red-100">
                        {error}
                    </div>
                )}

                {success ? (
                    <div className="text-center">
                        <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 text-sm font-medium border border-green-100">
                            Code sent! Please check your email for the 6-digit OTP.
                        </div>
                        <Link
                            to="/admin/login/verify-otp"
                            className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition text-center"
                        >
                            Enter Code Automatically
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSendOTP} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="text-gray-400" size={18} />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="admin@cafe.com"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition disabled:opacity-50 mt-4 flex items-center justify-center"
                        >
                            {loading ? (
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : 'Send Recovery Code'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
