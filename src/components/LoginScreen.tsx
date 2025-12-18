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
            console.log("Login Successful");
            setIsLoading(true);
            // Simulate a brief setup delay or validation
            setTimeout(() => {
                onLogin(tokenResponse.access_token);
                setIsLoading(false);
            }, 1000);
        },
        onError: () => {
            setError("Google Login Failed. Please try again.");
            setIsLoading(false);
        },
        scope: 'https://www.googleapis.com/auth/drive.file'
    });

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden font-sans">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-slate-900 via-black to-slate-900 z-0" />
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

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
                    <h1 className="text-4xl font-black text-white tracking-tight mb-2">FSD.PRO</h1>
                    <p className="text-slate-400 text-sm font-medium tracking-wide uppercase">Field Service & Data</p>
                </div>

                {/* Login Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                    <div className="text-center mb-8">
                        <h2 className="text-xl font-bold text-white mb-2">Welcome Back</h2>
                        <p className="text-slate-400 text-sm">Sign in to access your Schedule</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                            <ShieldCheck size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {!isLoading ? (
                        <button
                            onClick={() => login()}
                            className="w-full py-4 bg-white text-black hover:bg-slate-200 transition-all rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg group"
                        >
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6" />
                            <span>Sign in with Google</span>
                        </button>
                    ) : (
                        <div className="w-full py-4 bg-white/10 rounded-xl flex items-center justify-center gap-3 text-slate-300">
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span className="font-medium">Connecting to Drive...</span>
                        </div>
                    )}

                    <p className="text-center text-xs text-slate-600 mt-6">
                        By connecting, FSD.PRO will create a data folder in your Google Drive.
                    </p>
                </div>
            </motion.div>
        </div>
    );
};
