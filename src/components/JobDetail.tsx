import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, MapPin, Clock, Wrench, Scan, Package, Calendar, Zap
} from 'lucide-react';
import { Job } from '../context/JobContext';
import { BarcodeScanner } from './BarcodeScanner';
import { useJobs } from '../context/JobContext';
import { imageService } from '../services/imageService';

interface JobDetailProps {
    job: Job;
    onBack: () => void;
}

export const JobDetail: React.FC<JobDetailProps> = ({ job, onBack }) => {
    const { updateJob } = useJobs();
    const [isScanning, setIsScanning] = useState(false);
    const [serialNumber, setSerialNumber] = useState(job.serialNumber || '');

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
            <div className="relative rounded-3xl overflow-hidden mb-8 border border-white/10 group shadow-2xl">
                {productImage && (
                    <div className="absolute inset-0">
                        <img src={productImage} alt="Machine" className="w-full h-full object-cover opacity-60 group-hover:opacity-70 transition-opacity duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/80 to-transparent" />
                    </div>
                )}

                <div className="relative p-8 flex items-center gap-6 z-10">
                    <button
                        onClick={onBack}
                        className="p-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl hover:bg-white/10 text-white transition-all hover:scale-105 active:scale-95"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]" />
                                Job #{job.id}
                            </div>
                            {job.priority === 'high' && (
                                <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-wider">
                                    High Priority
                                </div>
                            )}
                        </div>
                        <h2 className="text-4xl font-heading font-black text-white tracking-tight drop-shadow-lg mb-1">{job.customerName}</h2>
                        <span className="text-slate-400 font-medium">Customer Profile</span>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Location & Schedule */}
                <div className="bg-[#0f0f0f]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 space-y-6 hover:border-white/10 transition-colors">
                    <div className="space-y-4">
                        <h3 className="text-lg font-heading font-bold text-white flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                                <MapPin size={20} />
                            </div>
                            Service Location
                        </h3>
                        <div className="pl-14">
                            <p className="text-xl text-slate-200 font-medium leading-normal">{job.address}</p>
                            {job.travelTime && (
                                <div className="inline-flex items-center gap-3 mt-3 text-sm font-bold text-cyan-300 bg-cyan-950/30 px-4 py-2 rounded-xl border border-cyan-500/20">
                                    <span>🚗 {job.travelTime} drive away</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="w-full h-px bg-white/5" />

                    <div className="space-y-2">
                        <h3 className="text-lg font-heading font-bold text-white flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                                <Clock size={20} />
                            </div>
                            Appointment
                        </h3>
                        <div className="pl-14">
                            <p className="text-xl text-slate-200 font-medium">{job.timeSlot}</p>
                            <p className="text-sm text-slate-500 mt-1">Scheduled for Today</p>
                        </div>
                    </div>
                </div>

                {/* Fault Description */}
                <div className="bg-gradient-to-br from-rose-500/5 to-orange-500/5 border border-rose-500/10 rounded-3xl p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-[64px] rounded-full pointer-events-none" />

                    <h3 className="text-rose-400 font-heading font-bold text-lg flex items-center gap-3 mb-4 relative z-10">
                        <div className="p-2 rounded-xl bg-rose-500/10">
                            <Wrench size={20} />
                        </div>
                        Reported Fault
                    </h3>
                    <p className="text-slate-200 text-lg leading-relaxed font-medium relative z-10 pl-14">
                        "{job.engineerNotes || job.fault || "No specific fault description provided by customer."}"
                    </p>
                </div>

                {/* Machine Details */}
                <div className="bg-[#0f0f0f]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 space-y-6">
                    <h3 className="text-lg font-heading font-bold text-white flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                            <Zap size={20} />
                        </div>
                        Machine Intelligence
                    </h3>

                    <div className="grid gap-6 pl-1 pt-2">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Detected Product</label>
                                <p className="text-lg text-white font-bold">{job.detectedProduct || job.modelNumber || "Unknown Device"}</p>
                            </div>
                            {job.brand && (
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Manufacturer</label>
                                    <p className="text-slate-300 font-medium">{job.brand}</p>
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
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono focus:outline-none focus:border-cyan-500/50 focus:bg-white/5 transition-all placeholder:text-slate-600"
                                />
                                <button
                                    onClick={() => setIsScanning(true)}
                                    className="px-4 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 rounded-xl transition-all"
                                >
                                    <Scan size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-3 ml-1">Quick Part Lookup</label>
                            <div className="relative group/search">
                                <Package size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/search:text-cyan-400 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search part number..."
                                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:bg-white/5 focus:border-cyan-500/50 transition-all font-mono"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Parts Used */}
                {job.partsUsed && job.partsUsed.length > 0 && (
                    <div className="bg-[#0f0f0f]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8">
                        <h3 className="text-lg font-heading font-bold text-white flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                                <Package size={20} />
                            </div>
                            Parts Consumed
                        </h3>
                        <ul className="space-y-3">
                            {job.partsUsed.map((part, idx) => (
                                <li key={idx} className="flex items-center gap-3 text-slate-300 text-sm font-medium p-3 rounded-xl bg-white/5 border border-white/5">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]" />
                                    {part}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </motion.div>
    );
};
