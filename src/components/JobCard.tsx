import React, { useState } from 'react';
import { Job } from '../context/JobContext';
import { MapPin, Calendar, Clock, ChevronRight, Bot, Search, Copy, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface JobCardProps {
    job: Job;
    index: number;
    onAskOscar: (job: Job) => void;
    onPartSearch?: (job: Job, query: string) => void;
    onOpenOscar?: (job: Job) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, index, onAskOscar, onPartSearch, onOpenOscar }) => {
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
            case 'pending': return 'border-l-slate-400';
            case 'in-progress': return 'border-l-[#00A0E9]';
            case 'completed': return 'border-l-emerald-500';
            case 'issue': return 'border-l-rose-500';
            default: return 'border-l-slate-400';
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold uppercase">Pending</span>;
            case 'in-progress': return <span className="px-2 py-1 rounded-md bg-blue-50 text-[#00A0E9] text-[10px] font-bold uppercase">In Progress</span>;
            case 'completed': return <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase">Completed</span>;
            case 'issue': return <span className="px-2 py-1 rounded-md bg-rose-50 text-rose-600 text-[10px] font-bold uppercase">Issue</span>;
            default: return null;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`card-classic p-5 border-l-4 ${getStatusColor(job.status)} flex flex-col gap-3 group cursor-pointer hover:shadow-md transition-all`}
        >
            {/* Header: Date & Status */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                    <Calendar size={14} />
                    <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <Clock size={14} />
                    <span>{job.timeSlot}</span>
                </div>
                {getStatusBadge(job.status)}
            </div>

            {/* Main Content */}
            <div>
                <h3 className="text-lg font-heading font-bold text-slate-800 group-hover:text-[#00A0E9] transition-colors line-clamp-1">
                    {job.customerName || 'Unknown Customer'}
                </h3>
                <div className="flex items-start gap-1.5 mt-1 text-slate-500 text-sm">
                    <MapPin size={16} className="shrink-0 mt-0.5" />
                    <p className="line-clamp-2 leading-snug">{job.address || 'No location provided'}</p>
                </div>
            </div>

            {/* AI Summary Highlight */}
            {job.aiSummary && (
                <div className="mt-1 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex gap-3">
                    <div className="mt-0.5 p-1 rounded-md bg-indigo-100 text-indigo-600 shrink-0">
                        <Bot size={14} />
                    </div>
                    <p className="text-xs text-indigo-900 line-clamp-2 leading-relaxed">
                        <span className="font-bold">Oscar:</span> {job.aiSummary}
                    </p>
                </div>
            )}

            {/* Footer Actions */}
            <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">#{job.id}</span>
                </div>

                <button
                    onClick={handleOscarClick}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#00A0E9] bg-blue-50 px-3 py-2 rounded-xl hover:bg-[#00A0E9] hover:text-white transition-all"
                >
                    <Bot size={16} />
                    <span>Ask Oscar</span>
                </button>
            </div>
        </motion.div>
    );
};
