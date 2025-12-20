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
            <div className="relative rounded-3xl overflow-hidden mb-8 border border-white/10 group">
                {productImage && (
                    <div className="absolute inset-0">
                        <img src={productImage} alt="Machine" className="w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
                    </div>
                )}

                <div className="relative p-8 flex items-center gap-4 z-10">
                    <button
                        onClick={onBack}
                        className="p-3 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl hover:bg-white/20 text-white transition-all shadow-lg"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tight drop-shadow-md">{job.customerName}</h2>
                        <div className="flex items-center gap-2 text-slate-300 text-sm font-medium">
                            <span className="uppercase tracking-wider">Job ID: {job.id}</span>
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            <span className="capitalize">{job.priority} Priority</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Location & Schedule */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-4">
                    <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                        <MapPin size={18} className="text-cyan-400" /> Location
                    </h3>
                    <p className="text-slate-400 leading-relaxed">{job.address}</p>
                    {job.travelTime && (
                        <div className="flex items-center gap-3 mt-2 text-sm text-cyan-400 bg-cyan-500/10 p-3 rounded-lg border border-cyan-500/20">
                            <span>🚗 {job.travelTime} drive</span>
                            <button className="ml-auto px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg text-xs transition-colors">
                                Start Route
                            </button>
                        </div>
                    )}

                    <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2 mt-6">
                        <Clock size={18} className="text-cyan-400" /> Schedule
                    </h3>
                    <p className="text-slate-400">{job.timeSlot}</p>
                </div>

                {/* Fault Description */}
                <div className="bg-gradient-to-br from-orange-500/10 to-red-600/10 border border-orange-500/20 rounded-3xl p-6">
                    <h3 className="text-orange-400 font-bold flex items-center gap-2 mb-3">
                        <Wrench size={18} /> Fault Description
                    </h3>
                    <p className="text-slate-300 leading-relaxed">
                        {job.engineerNotes || job.fault || "No fault description provided."}
                    </p>
                </div>

                {/* Machine Details */}
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-4">
                    <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                        <Zap size={18} className="text-cyan-400" /> Machine Details
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Product</label>
                            <p className="text-white font-medium">{job.detectedProduct || job.modelNumber || "Unknown"}</p>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Serial Number</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={serialNumber}
                                    onChange={(e) => setSerialNumber(e.target.value)}
                                    placeholder="Scan or Enter Serial"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-mono focus:outline-none focus:border-cyan-500/50"
                                />
                                <button
                                    onClick={() => setIsScanning(true)}
                                    className="p-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-xl transition-all"
                                >
                                    <Scan size={20} />
                                </button>
                            </div>
                        </div>
                        {job.brand && (
                            <div>
                                <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Brand</label>
                                <p className="text-white font-medium">{job.brand}</p>
                            </div>
                        )}
                        {job.purchaseDate && (
                            <div>
                                <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Purchase Date</label>
                                <p className="text-white font-medium flex items-center gap-2">
                                    <Calendar size={14} className="text-slate-500" />
                                    {job.purchaseDate}
                                </p>
                            </div>
                        )}
                        <div>
                            <label className="text-xs text-slate-500 uppercase tracking-wider block mb-2">Find a Part</label>
                            <div className="relative group/search">
                                <Package size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/search:text-cyan-400 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search part number or name..."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:bg-white/10 focus:border-cyan-500/50 transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Parts Used */}
                {job.partsUsed && job.partsUsed.length > 0 && (
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
                        <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2 mb-4">
                            <Package size={18} className="text-emerald-400" /> Parts Used
                        </h3>
                        <ul className="space-y-2">
                            {job.partsUsed.map((part, idx) => (
                                <li key={idx} className="flex items-center gap-2 text-slate-300 text-sm">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
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
