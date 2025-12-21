import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Navigation, MapPin, Calendar, Clock, AlertCircle, CheckCircle2, ChevronRight, Camera, Wrench, FileText, ArrowLeft, MoreVertical, Copy, Sparkles, Check, ChevronLeft, Zap, Scan, Package } from 'lucide-react';
import { Job } from '../context/JobContext';
import { BarcodeScanner } from './BarcodeScanner';
import { useJobs } from '../context/JobContext';
import { imageService } from '../services/imageService';
import { estimateTravelTime } from '../services/routingService';
import { usePrivacy } from '../context/PrivacyContext';
import { decodeSerial } from '../services/serialService';

interface JobDetailProps {
    job: Job;
    onBack: () => void;
}

export const JobDetail: React.FC<JobDetailProps> = ({ job, onBack }) => {
    const { updateJob, accessToken, userProfile } = useJobs();
    const { isPrivacyEnabled } = usePrivacy();
    const blurClass = isPrivacyEnabled ? 'blur-md select-none transition-all duration-300' : 'transition-all duration-300';

    const [isScanning, setIsScanning] = useState(false);
    const [serialNumber, setSerialNumber] = useState(job.serialNumber || '');
    const [liveTravelTime, setLiveTravelTime] = useState<string | null>(null);

    const serialInfo = serialNumber ? decodeSerial(serialNumber) : null;

    // Calculate live travel time from current location
    useEffect(() => {
        if (!job.address) return;

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            const currentLoc = `${latitude},${longitude}`;
            const result = await estimateTravelTime(currentLoc, job.address!);
            if (result?.durationText) {
                setLiveTravelTime(result.durationText);
            }
        }, (error) => {
            console.warn('Location access denied or failed:', error);
        });
    }, [job.address]);

    const handleScanSuccess = (decodedText: string) => {
        setSerialNumber(decodedText);
        updateJob(job.id, { serialNumber: decodedText });
        setIsScanning(false);
        navigator.clipboard.writeText(decodedText).then(() => {
            alert(`Scanned: ${decodedText}. Copied to clipboard!`);
        });
    };

    const [productImage, setProductImage] = useState<string | null>(null);

    React.useEffect(() => {
        const loadImg = async () => {
            const query = job.modelNumber || job.detectedProduct;
            if (query) {
                const url = await imageService.searchProductImage(query + " appliance");
                if (url) setProductImage(url);
            }
        };
        loadImg();
    }, [job.modelNumber, job.detectedProduct]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <AnimatePresence>
                {isScanning && (
                    <BarcodeScanner
                        onScanSuccess={handleScanSuccess}
                        onClose={() => setIsScanning(false)}
                    />
                )}
            </AnimatePresence>

            {/* Dynamic Image Header */}
            <div className="relative rounded-3xl overflow-hidden mb-8 border border-white/40 group shadow-xl bg-white/50">
                {productImage && (
                    <div className="absolute inset-0">
                        <img src={productImage} alt="Machine" className="w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-white/40 to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-r from-white/90 to-transparent" />
                    </div>
                )}

                <div className="relative p-8 flex items-center gap-6 z-10">
                    <button
                        onClick={onBack}
                        className="p-3 bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl hover:bg-white text-[var(--color-secondary)] transition-all hover:scale-105 active:scale-95 cursor-pointer z-50 shadow-sm"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(job.id);
                                    alert(`Copied SA Number: ${job.id}`);
                                }}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase tracking-wider hover:bg-emerald-200 transition-colors"
                            >
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                {job.id}
                                <Copy size={12} className="ml-1 opacity-60" />
                            </button>
                        </div>
                        <h2 className="text-4xl font-heading font-black text-[var(--color-secondary)] tracking-tight mb-1">{job.timeSlot}</h2>
                        <span className={`text-[var(--color-text-muted)] font-medium block text-lg ${blurClass}`}>{job.customerName || (job as any).customer?.name || "Unknown Customer"}</span>

                        {/* Address & Navigation (Moved to Header) */}
                        <div className="mt-4 space-y-3">
                            <div className={`flex items-start gap-2 text-slate-600 ${blurClass}`}>
                                <MapPin size={16} className="mt-1 shrink-0 text-cyan-600" />
                                <span className="text-sm font-medium leading-normal max-w-sm">
                                    {job.address || (job as any).location?.address || "No Address Provided"}
                                </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {(liveTravelTime || job.travelTime) && (
                                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1.5 rounded-lg border border-cyan-100">
                                        <span>🚗 {liveTravelTime ? liveTravelTime : job.travelTime} away</span>
                                    </div>
                                )}
                                <button
                                    onClick={() => {
                                        const addr = job.address || (job as any).location?.address;
                                        if (addr) window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`, '_blank');
                                    }}
                                    className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-[var(--color-secondary)] font-bold py-1.5 px-3 rounded-lg transition-all shadow-sm active:scale-95 text-xs"
                                >
                                    <Navigation size={14} className="text-[var(--color-primary)]" />
                                    Navigate
                                </button>
                            </div>
                        </div>
                    </div>
                    {job.applianceImageUrl && (
                        <div className="hidden sm:block ml-auto">
                            <img
                                src={job.applianceImageUrl}
                                alt="Appliance"
                                className="w-32 h-32 object-cover rounded-2xl border-4 border-white shadow-lg"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Masonry Layout for flexible vertical sizing */}
            <div className="columns-1 lg:columns-2 gap-6 space-y-6">

                {/* 1. Reported Fault (Compact) */}
                <div className="break-inside-avoid mb-6">
                    <div className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-100 rounded-2xl p-5 relative overflow-hidden shadow-sm">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-rose-200/20 blur-[40px] rounded-full pointer-events-none" />

                        <h3 className="text-rose-700 font-heading font-bold text-base flex items-center gap-2 mb-2 relative z-10">
                            <div className="p-1.5 rounded-lg bg-rose-100">
                                <Wrench size={16} />
                            </div>
                            Reported Fault
                        </h3>
                        <p className="text-slate-800 text-base leading-relaxed font-medium relative z-10 pl-10">
                            "{job.engineerNotes || job.fault || "No specific fault description provided by customer."}"
                        </p>
                    </div>
                </div>

                {/* 2. Machine Intelligence */}
                <div className="break-inside-avoid mb-6">
                    <div className="card-glass p-8 space-y-6">
                        <h3 className="text-lg font-heading font-bold text-[var(--color-secondary)] flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                                <Zap size={20} />
                            </div>
                            Machine Intelligence
                        </h3>

                        <div className="grid gap-6 pl-1 pt-2">
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Detected Product</label>
                                    <p className="text-lg text-[var(--color-secondary)] font-bold">{job.detectedProduct || "Unknown Device"}</p>
                                    {job.modelNumber && (
                                        <p className="text-sm text-slate-500 font-medium mt-0.5 flex items-center gap-2">
                                            Product Code: <span className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">{job.modelNumber}</span>
                                            {serialInfo?.isValid && serialInfo.productionYear && (
                                                <>
                                                    <span className="text-slate-300">|</span>
                                                    <span className="text-slate-600 font-medium">
                                                        Manufactured: <span className="font-bold text-slate-800">{serialInfo.productionYear}/{serialInfo.productionWeek}</span>
                                                    </span>
                                                </>
                                            )}
                                        </p>
                                    )}
                                </div>
                                {job.brand && (
                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Manufacturer</label>
                                        <p className="text-slate-700 font-medium">{job.brand}</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold ml-1">Serial Number</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={serialNumber}
                                        onChange={(e) => setSerialNumber(e.target.value)}
                                        placeholder="Scan or Enter Serial"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-[var(--color-text-main)] font-mono focus:outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 transition-all placeholder:text-slate-400"
                                    />
                                    <button
                                        onClick={() => setIsScanning(true)}
                                        className="px-4 bg-cyan-100 hover:bg-cyan-200 border border-cyan-200 text-cyan-700 rounded-xl transition-all"
                                    >
                                        <Scan size={20} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            const shortSerial = serialNumber.substring(0, 8);
                                            navigator.clipboard.writeText(shortSerial);
                                            alert(`Copied Short Serial (First 8): ${shortSerial}`);
                                        }}
                                        className="px-4 bg-indigo-100 hover:bg-indigo-200 border border-indigo-200 text-indigo-700 rounded-xl transition-all flex items-center justify-center gap-1 group relative"
                                        title="Copy First 8 Digits"
                                    >
                                        <Copy size={16} />
                                        <span className="text-xs font-bold">8</span>
                                    </button>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-200">
                                <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-3 ml-1">Quick Part Lookup</label>
                                <div className="relative group/search">
                                    <Package size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-[var(--color-primary)] transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Search part number..."
                                        className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm text-[var(--color-text-main)] placeholder:text-slate-400 focus:outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 transition-all font-mono"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Oscar Intelligence & Parts Used */}
                <div className="break-inside-avoid mb-6">
                    {/* AI FAULT ANALYSIS & LEARNING LOOP */}
                    <div className={`p-4 rounded-2xl border mb-4 shadow-sm ${job.aiAnalysis ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-100'
                        }`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Sparkles size={16} className={job.aiAnalysis ? "text-emerald-500" : "text-slate-400"} />
                                OSCAR Intelligence
                                {job.aiAnalysis && (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">
                                        {job.aiAnalysis.confidence}% CONFIDENCE
                                    </span>
                                )}
                            </h3>
                        </div>

                        {job.aiAnalysis ? (
                            <div className="space-y-4">
                                {/* Analysis Card */}
                                <div className="bg-white p-3 rounded-xl border border-emerald-100/50 shadow-sm space-y-2">
                                    <div className="grid grid-cols-[auto_1fr] gap-2 text-sm">
                                        <span className="font-bold text-slate-500 w-16">FAULT:</span>
                                        <span className="text-slate-800 font-medium">{job.aiAnalysis.fault}</span>

                                        <span className="font-bold text-slate-500">CAUSE:</span>
                                        <span className="text-slate-700">{job.aiAnalysis.cause}</span>
                                    </div>

                                    <div className="mt-2 pt-2 border-t border-slate-50">
                                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Recommended Solution</p>
                                        <p className="text-emerald-700 font-medium text-sm leading-relaxed">
                                            {job.aiAnalysis.solution}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4 text-slate-400 bg-white/50 rounded-xl border border-slate-100 mb-4">
                                <p className="text-sm">No automatic analysis for this job yet.</p>
                            </div>
                        )}

                        {/* FEEDBACK LOOP - ALWAYS VISIBLE */}
                        <div className="mt-4 pt-4 border-t border-slate-200/50">
                            <label className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2">
                                <Wrench size={12} />
                                {job.aiAnalysis ? "Field Verification (Help Oscar Learn)" : "Manual Diagnosis (Teach Oscar)"}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder={job.aiAnalysis ? "Enter actual fix if different..." : "What was the fault and how did you fix it?"}
                                    className="flex-1 text-sm border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                                    id={`fix-input-${job.id}`}
                                />
                                <button
                                    onClick={async () => {
                                        const input = document.getElementById(`fix-input-${job.id}`) as HTMLInputElement;
                                        const actualFix = input.value;

                                        if (!actualFix && !job.aiAnalysis) {
                                            alert("Please enter a fix to save.");
                                            return;
                                        }

                                        const finalFix = actualFix || job.aiAnalysis?.solution || "Confirmed AI Solution";

                                        // Dynamic Import to avoid bundle issues
                                        const { recordSolution } = await import('../services/learningService');

                                        // Save to Learning Service
                                        await recordSolution(accessToken || "mock-token", {
                                            faultCode: job.aiAnalysis?.fault || "Manual Entry",
                                            model: job.detectedProduct || "Unknown",
                                            symptoms: job.engineerNotes || "",
                                            diagnosis: job.aiAnalysis?.cause || "Manual Diagnosis",
                                            fix: finalFix,
                                            partsUsed: [],
                                            addedBy: userProfile?.name || "Engineer"
                                        });

                                        alert("✅ Knowledge Captured! Oscar is smarter now.");
                                        input.value = "";
                                    }}
                                    className="bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors flex items-center gap-1"
                                >
                                    <Check size={14} />
                                    Verify Fix
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Parts Consumed (Existing) */}
                {job.partsUsed && job.partsUsed.length > 0 && (
                    <div className="break-inside-avoid mb-6">
                        <div className="card-glass p-8">
                            <h3 className="text-lg font-heading font-bold text-[var(--color-secondary)] flex items-center gap-3 mb-6">
                                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                                    <Package size={20} />
                                </div>
                                Parts Consumed
                            </h3>
                            <ul className="space-y-3">
                                {job.partsUsed.map((part, idx) => (
                                    <li key={idx} className="flex items-center gap-3 text-slate-700 text-sm font-medium p-3 rounded-xl bg-white border border-slate-100 shadow-sm">
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                                        {part}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};
