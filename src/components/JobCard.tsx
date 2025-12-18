import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Clock, AlertCircle, Wrench, Search, MessageSquare, CheckCircle2, Copy, Sparkles, MoreHorizontal } from 'lucide-react';
import { Job } from '../context/JobContext';

interface JobCardProps {
    job: Job;
    index: number;
    onAskOscar: (job: Job) => void;
    onPartSearch?: (job: Job, query: string) => void;
    onOpenOscar?: (job: Job) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, index, onAskOscar, onPartSearch, onOpenOscar }) => {
    const [partQuery, setPartQuery] = useState('');

    const handlePartSearch = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && onPartSearch) {
            onPartSearch(job, partQuery);
        }
    };

    const handleOscarClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onOpenOscar) {
            onOpenOscar(job);
        } else {
            onAskOscar(job); // Fallback to legacy prop
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
            case 'in-progress': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
            case 'completed': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
            case 'issue': return 'bg-red-500/20 text-red-300 border-red-500/30';
            default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="group relative bg-[#0a0a0a] backdrop-blur-md border border-white/10 rounded-3xl p-5 hover:bg-white/5 hover:border-white/20 hover:shadow-2xl transition-all cursor-pointer flex flex-col gap-4 overflow-hidden"
        >
            {/* 1. Header Row (Flex) */}
            <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(job.status)}`}>
                            {job.status.replace('-', ' ')}
                        </span>
                        <div className="flex items-center gap-1 text-slate-400 text-xs font-mono bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                            <Clock size={12} />
                            <span>{job.timeSlot}</span>
                        </div>
                    </div>
                    <div>
                        {job.priority === 'high' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-1">
                                <AlertCircle size={10} /> High Priority
                            </span>
                        )}
                        <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-1" title={job.detectedProduct || job.modelNumber || "Unknown Product"}>
                            {job.detectedProduct || job.modelNumber || "Service Job"}
                        </h3>
                        <p className="text-slate-500 text-xs">{job.customerName}</p>
                    </div>
                </div>

                {/* Thumbnail Image (Fixed 64px) */}
                <div className="w-16 h-16 rounded-xl bg-slate-800 border border-white/10 flex-shrink-0 overflow-hidden relative group/img">
                    {/* Placeholder for actual image if available in job data */}
                    <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-slate-500">
                        <Wrench size={24} />
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                        <Search size={16} className="text-white" />
                    </div>
                </div>
            </div>

            {/* 2. Body Section (Stack) */}
            <div className="space-y-3">
                {/* Location */}
                <div className="flex items-start gap-2 text-slate-400 text-sm">
                    <MapPin size={16} className="mt-0.5 text-slate-500 shrink-0" />
                    <span className="line-clamp-1 hover:text-white transition-colors">{job.address}</span>
                </div>

                {/* Raw Fault */}
                <div className="text-sm text-slate-300 line-clamp-2 leading-relaxed">
                    <span className="text-slate-500 font-bold text-xs uppercase mr-2">Issue:</span>
                    {job.engineerNotes || "No fault description provided."}
                </div>

                {/* Smart Summary (AI) */}
                {job.aiSummary ? (
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-1 opacity-20">
                            <Sparkles size={40} className="text-indigo-400" />
                        </div>
                        <h4 className="text-indigo-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1 mb-1">
                            <Sparkles size={12} /> AI Summary
                        </h4>
                        <p className="text-indigo-100 text-xs leading-relaxed relative z-10">
                            {job.aiSummary}
                        </p>
                        <button className="text-[10px] text-indigo-400 font-bold mt-2 hover:text-indigo-300 flex items-center gap-1">
                            View Analysis <MoreHorizontal size={12} />
                        </button>
                    </div>
                ) : (
                    // Fallback / Empty State - Optional: Could show "Analyze" button
                    <div className="hidden" />
                )}

                {/* Tools Row */}
                <div className="flex gap-2 pt-2">
                    {/* Part Finder */}
                    <div className="flex-1 relative group/search">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/search:text-white transition-colors" />
                        <input
                            type="text"
                            placeholder="Find a part..."
                            value={partQuery}
                            onChange={(e) => setPartQuery(e.target.value)}
                            onKeyDown={handlePartSearch}
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:bg-white/10 focus:border-white/20 transition-all"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>

                    {/* Ask Oscar Advice Button */}
                    <button
                        onClick={handleOscarClick}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-900/20 transition-all active:scale-95"
                    >
                        <Sparkles size={14} />
                        <span>Ask Oscar</span>
                    </button>
                </div>
            </div>

            {/* 3. Footer Section (Notes & Actions) */}
            <div className="pt-3 border-t border-white/5 flex gap-2">
                <textarea
                    placeholder="Engineer notes..."
                    className="flex-1 bg-transparent border-none text-slate-400 text-xs resize-none h-8 placeholder:text-slate-700 focus:ring-0 p-0"
                    onClick={(e) => e.stopPropagation()}
                />
                <div className="flex items-center gap-1">
                    <button
                        className="p-2 text-slate-600 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        title="Copy Job Details"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Copy size={14} />
                    </button>
                    <button
                        className="p-2 text-emerald-600/50 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title="Mark Complete"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <CheckCircle2 size={14} />
                    </button>
                </div>
            </div>
        </motion.div>
    );
};
