import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Zap } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

interface LoginScreenProps {
    onLogin: (accessToken: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const login = useGoogleLogin({
        onSuccess: (tokenResponse) => {
            console.log("✅ Login Successful");
            console.log("📋 Token Response:", tokenResponse);
            console.log("🔑 Access Token:", tokenResponse.access_token);
            setIsLoading(true);
            setTimeout(() => {
                console.log("🚀 Calling onLogin with token");
                onLogin(tokenResponse.access_token);
                setIsLoading(false);
            }, 1000);
        },
        onError: (error) => {
            console.error("❌ Google Login Failed:", error);
            setError("Google Login Failed. Please try again.");
            setIsLoading(false);
        },
        scope: 'https://www.googleapis.com/auth/drive',
        flow: 'implicit'
    });

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center relative overflow-hidden font-sans">
            {/* Background Effects */}
            {/* Background Effects - Removed dark patterns, kept minimal if needed, or removed entirely for clean white */}
            {/* <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-slate-900 via-black to-slate-900 z-0" /> */}

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="z-10 w-full max-w-md p-8"
            >
                {/* Logo Area */}
                <div className="flex flex-col items-center mb-10">
                    <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-cyan-500/30 mb-6 relative group">
                        <div className="absolute inset-0 bg-white/20 rounded-3xl blur-md group-hover:blur-lg transition-all" />
                        <Zap size={40} className="text-white relative z-10" fill="currentColor" />
                    </div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">FSD.PRO</h1>
                    <p className="text-slate-500 text-sm font-medium tracking-wide uppercase">Field Service & Data</p>
                </div>

                {/* Login Card */}
                <div className="bg-[#00A0E9] rounded-3xl p-8 shadow-2xl shadow-blue-500/20">
                    <div className="text-center mb-8">
                        <h2 className="text-xl font-bold text-white mb-2">Welcome Back</h2>
                        <p className="text-blue-100 text-sm">Sign in to access your Schedule</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-white/10 border border-white/20 rounded-xl flex items-center gap-3 text-white text-sm">
                            <ShieldCheck size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {!isLoading ? (
                        <button
                            onClick={() => login()}
                            className="w-full py-4 bg-white text-[#00A0E9] hover:bg-slate-50 transition-all rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg group"
                        >
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6" />
                            <span>Sign in with Google</span>
                        </button>
                    ) : (
                        <div className="w-full py-4 bg-white/10 rounded-xl flex items-center justify-center gap-3 text-white">
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span className="font-medium">Connecting to Drive...</span>
                        </div>
                    )}

                    <p className="text-center text-xs text-blue-100/80 mt-6">
                        By connecting, FSD.PRO will create a data folder in your Google Drive.
                    </p>
                </div>
            </motion.div>
        </div>
    );
};
