
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Stethoscope, AlertTriangle, ChevronRight, Activity, Wrench, CheckCircle2, XCircle } from 'lucide-react';
import { learningService } from '../services/learningService';
import { FaultCode } from '../types';

export const DiagnosticWizard: React.FC<{ onClose: () => void; accessToken: string }> = ({ onClose, accessToken }) => {
    const [step, setStep] = useState<'initial' | 'symptom' | 'error_code' | 'solution'>('initial');
    const [errorCode, setErrorCode] = useState('');
    const [foundSolution, setFoundSolution] = useState<FaultCode | null>(null);
    const [isChecking, setIsChecking] = useState(false);

    const handleErrorCodeSubmit = async () => {
        if (!errorCode) return;
        setIsChecking(true);
        try {
            const fix = await learningService.findFix(accessToken, errorCode);
            setFoundSolution(fix); // might be null
            setStep('solution');
        } catch (e) {
            console.error(e);
        } finally {
            setIsChecking(false);
        }
    };

    const handleFeedback = async (success: boolean) => {
        if (!foundSolution && !success) return; // Logic for new fix TBD

        if (success && foundSolution) {
            await learningService.recordFix(accessToken, foundSolution);
            alert("Thansk! Knowledge Base Updated.");
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">

                {/* Header */}
                <div className="p-6 border-b border-white/10 bg-black/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-500">
                            <Activity size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white">Diagnostic Wizard</h2>
                            <p className="text-sm text-slate-400">AI-Powered Rapid Triage</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">Close</button>
                </div>

                {/* Content */}
                <div className="p-8 min-h-[400px] flex flex-col items-center justify-center relative">
                    <AnimatePresence mode="wait">
                        {step === 'initial' && (
                            <motion.div
                                key="initial"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="w-full grid grid-cols-1 md:grid-cols-2 gap-6"
                            >
                                <button
                                    onClick={() => setStep('symptom')}
                                    className="goup relative bg-white/5 border border-white/10 p-8 rounded-3xl hover:bg-white/10 hover:border-indigo-500/50 transition-all text-left flex flex-col gap-4 group"
                                >
                                    <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                                        <Stethoscope size={32} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white mb-2">Symptom</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed">
                                            Describe the issue (e.g. "Noisy spin", "Not draining")
                                        </p>
                                    </div>
                                    <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-600 group-hover:text-white transition-colors" />
                                </button>

                                <button
                                    onClick={() => setStep('error_code')}
                                    className="goup relative bg-white/5 border border-white/10 p-8 rounded-3xl hover:bg-white/10 hover:border-rose-500/50 transition-all text-left flex flex-col gap-4 group"
                                >
                                    <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
                                        <AlertTriangle size={32} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white mb-2">Error Code</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed">
                                            Enter the code displayed (e.g. "E08", "F22")
                                        </p>
                                    </div>
                                    <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-600 group-hover:text-white transition-colors" />
                                </button>
                            </motion.div>
                        )}

                        {step === 'symptom' && (
                            <motion.div key="symptom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                                <p className="text-slate-400">Symptom Flow (Under Construction)</p>
                                <button onClick={() => setStep('initial')} className="mt-4 text-indigo-400">Back</button>
                            </motion.div>
                        )}

                        {step === 'error_code' && (
                            <motion.div key="error_code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md">
                                <h3 className="text-xl font-bold text-white mb-6 text-center">What's the Code?</h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={errorCode}
                                        onChange={(e) => setErrorCode(e.target.value.toUpperCase())}
                                        placeholder="E.g. E08"
                                        className="flex-1 bg-black/40 border border-white/10 rounded-xl py-4 px-6 text-2xl text-center font-mono text-white tracking-widest uppercase focus:outline-none focus:border-rose-500/50"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleErrorCodeSubmit}
                                        disabled={isChecking}
                                        className="px-6 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white disabled:opacity-50"
                                    >
                                        {isChecking ? '...' : 'Check'}
                                    </button>
                                </div>
                                <button onClick={() => setStep('initial')} className="mt-6 text-slate-500 w-full text-center hover:text-white">Back</button>
                            </motion.div>
                        )}

                        {step === 'solution' && (
                            <motion.div key="solution" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center w-full">
                                {foundSolution ? (
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-2xl mb-6">
                                        <div className="flex items-center justify-center gap-2 text-emerald-400 mb-2">
                                            <Wrench size={24} />
                                            <span className="font-bold uppercase tracking-wider">Verified Fix</span>
                                        </div>
                                        <h4 className="text-2xl font-bold text-white mb-2">{foundSolution.fix}</h4>
                                        <p className="text-sm text-emerald-400/60 mb-6">Success Rate: {foundSolution.successCount} confirms</p>

                                        <div className="grid grid-cols-2 gap-4">
                                            <button onClick={() => handleFeedback(true)} className="flex items-center justify-center gap-2 p-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-xl font-bold transition-colors">
                                                <CheckCircle2 size={18} /> It Worked
                                            </button>
                                            <button onClick={() => handleFeedback(false)} className="flex items-center justify-center gap-2 p-3 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 rounded-xl font-bold transition-colors">
                                                <XCircle size={18} /> Failed
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white/5 border border-white/10 p-6 rounded-2xl mb-6">
                                        <p className="text-slate-300 mb-4">No historical data for <strong>{errorCode}</strong>.</p>
                                        <button className="mt-4 px-6 py-2 bg-indigo-600 rounded-lg text-white font-bold flex items-center gap-2 mx-auto">
                                            <Activity size={18} />
                                            Ask Oscar to Analyze Manual (Pro)
                                        </button>
                                    </div>
                                )}
                                <button onClick={() => setStep('initial')} className="text-slate-500 hover:text-white">Start Over</button>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};
