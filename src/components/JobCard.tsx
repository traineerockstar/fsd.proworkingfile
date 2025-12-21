import React, { useState } from 'react';
import { Job } from '../context/JobContext';
import { SPOJob } from '../services/SPOProcessor';
import { usePrivacy } from '../context/PrivacyContext';
import { MapPin, Calendar, Clock, ChevronRight, Bot, Search, Copy, AlertCircle, CheckCircle2, Package } from 'lucide-react';
import { motion } from 'framer-motion';

interface JobCardProps {
    job: Job;
    spoData?: SPOJob; // New Prop for SPO Integration
    index: number;
    onAskOscar: (job: Job) => void;
    onPartSearch?: (job: Job, query: string) => void;
    onOpenOscar?: (job: Job) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, spoData, index, onAskOscar, onPartSearch, onOpenOscar }) => {
    const { isPrivacyEnabled } = usePrivacy();
    const blurClass = isPrivacyEnabled ? 'blur-md select-none transition-all duration-300' : 'transition-all duration-300';

    // Legacy support or future use
    const [partQuery, setPartQuery] = useState('');

    const handleOscarClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onOpenOscar) {
            onOpenOscar(job);
        } else {
            onAskOscar(job);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-slate-100 text-slate-500';
            case 'in-progress': return 'bg-blue-50 text-[var(--color-primary)]';
            case 'completed': return 'bg-emerald-50 text-emerald-600';
            case 'issue': return 'bg-rose-50 text-rose-600';
            default: return 'bg-slate-100 text-slate-500';
        }
    };

    const getStatusText = (status: string) => status.replace('-', ' ');

    // Mock functionality for thumbnail
    const getThumbnailUrl = (code?: string) => {
        if (job.applianceImageUrl) return job.applianceImageUrl;
        if (!code) return 'https://placehold.co/800x600/f1f5f9/94a3b8?text=Appliance';
        // In a real app, this would be a URL from a product database
        return `https://placehold.co/800x600/e0f2fe/0ea5e9?text=${encodeURIComponent(code)}`;
    };

    // Determine extra styles if SPO Parts exist
    const hasSPO = !!spoData;
    const containerClasses = hasSPO
        ? "group bg-white rounded-2xl shadow-sm border-2 border-red-400 overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col md:flex-row relative"
        : "group bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col md:flex-row";

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={containerClasses}
        >
            {/* SPO Indicator Badge */}
            {hasSPO && (
                <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10 flex items-center gap-1 shadow-sm">
                    <Package size={12} /> PARTS ON FILE
                </div>
            )}

            {/* Thumbnail Image Section */}
            <div className="w-full md:w-32 h-32 md:h-auto bg-slate-50 relative shrink-0">
                <img
                    src={getThumbnailUrl(job.modelNumber)}
                    alt={job.modelNumber || "Appliance"}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
                <div className="absolute top-2 left-2 md:hidden">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${getStatusColor(job.status)}`}>
                        {getStatusText(job.status)}
                    </span>
                </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 p-5 flex flex-col justify-between">
                <div>
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className={`text-lg font-heading font-bold text-[var(--color-text-main)] leading-tight group-hover:text-[var(--color-primary)] transition-colors ${blurClass}`}>
                                {job.customerName || 'Unknown Customer'}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {job.modelNumber || 'NO-CODE'}
                                </span>
                                <span className="text-xs font-medium text-slate-500">
                                    • {job.detectedProduct || 'Appliance'}
                                </span>
                            </div>
                        </div>
                        <div className="hidden md:block">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border border-transparent ${getStatusColor(job.status)}`}>
                                {getStatusText(job.status)}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-start gap-1.5 text-slate-500 text-sm mt-3">
                        <MapPin size={15} className="shrink-0 mt-0.5 text-slate-400" />
                        <p className={`line-clamp-2 leading-snug ${blurClass}`}>{job.address}</p>
                    </div>

                    {job.faultDescription && (
                        <div className="mt-2.5 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg">
                            <p className="text-xs font-medium text-slate-600 line-clamp-2">
                                <span className="text-slate-400 font-bold mr-1">Fault:</span>
                                {job.faultDescription}
                            </p>
                        </div>
                    )}

                    {/* SPO Parts Section */}
                    {hasSPO && spoData && spoData.parts.length > 0 && (
                        <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-2">
                            <h4 className="text-xs font-bold text-red-800 uppercase tracking-wide mb-2 flex items-center gap-1">
                                <Package size={12} /> Parts Ordered
                            </h4>
                            <div className="space-y-1">
                                {spoData.parts.map((part, pIdx) => {
                                    const isReady = part.isArrived || part.rawStatus.toLowerCase() === 'completed';
                                    return (
                                        <div key={pIdx} className={`flex items-center justify-between text-xs px-2 py-1 rounded border ${isReady ? 'bg-white border-green-200 text-green-700' : 'bg-white border-slate-100 text-slate-600'}`}>
                                            <span className="font-medium truncate">{part.desc}</span>
                                            <span className={`font-bold ml-2 ${isReady ? 'text-green-600' : 'text-slate-400'}`}>
                                                {isReady ? 'ARRIVED' : part.rawStatus}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer / AI Summary */}
                <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                            <Clock size={12} />
                            <span>{job.timeSlot}</span>
                        </div>
                    </div>

                    <button
                        onClick={handleOscarClick}
                        className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)] bg-blue-50 hover:bg-[var(--color-primary)] hover:text-white px-3 py-1.5 rounded-lg transition-all"
                    >
                        <Bot size={14} />
                        Ask Oscar
                    </button>
                </div>
            </div>
        </motion.div>
    );
};
