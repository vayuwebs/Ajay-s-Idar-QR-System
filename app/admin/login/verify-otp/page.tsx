"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

export default function VerifyOTP() {
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [step, setStep] = useState<"VERIFY" | "RESET">("VERIFY");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        // Pre-fill email from local storage if available
        const savedEmail = localStorage.getItem("reset_email");
        if (savedEmail) setEmail(savedEmail);
    }, []);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const { error: verifyErr } = await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: 'recovery'
        });

        if (verifyErr) {
            setError(verifyErr.message);
            setLoading(false);
        } else {
            // Successfully verified OTP and logged in! Now ask for new password.
            setStep("RESET");
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const { error: updateErr } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (updateErr) {
            setError(updateErr.message);
            setLoading(false);
        } else {
            // Updated successfully. Clean up and redirect.
            localStorage.removeItem("reset_email");
            router.push("/admin/dashboard");
            router.refresh();
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <Link href="/admin/login" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800 mb-6 font-medium">
                    <ArrowLeft size={16} className="mr-1" /> Back to login
                </Link>

                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <KeyRound size={32} />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
                    {step === "VERIFY" ? "Enter Recovery Code" : "Create New Password"}
                </h1>

                <p className="text-center text-gray-500 mb-8 text-sm">
                    {step === "VERIFY"
                        ? `We sent a 6-digit code to ${email || "your email"}.`
                        : "Your code was verified! Please choose a strong new password."}
                </p>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm text-center font-medium border border-red-100">
                        {error}
                    </div>
                )}

                {step === "VERIFY" ? (
                    <form onSubmit={handleVerify} className="space-y-5">
                        <div className="hidden">
                            {/* Hidden email input just to ensure we send it with verification */}
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">6-Digit Code</label>
                            <input
                                type="text"
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="w-full px-4 py-3 text-center tracking-[0.5em] text-2xl font-bold border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="------"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || otp.length < 6}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition disabled:opacity-50 mt-4 flex items-center justify-center"
                        >
                            {loading ? (
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : "Verify & Continue"}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleResetPassword} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="text-gray-400" size={18} />
                                </div>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    placeholder="••••••••"
                                    minLength={6}
                                    required
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Password must be at least 6 characters long.</p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || newPassword.length < 6}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-lg transition disabled:opacity-50 mt-4 flex items-center justify-center"
                        >
                            {loading ? (
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : "Update Password"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
