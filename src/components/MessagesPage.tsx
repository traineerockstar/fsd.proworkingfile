
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Copy, Check, Calendar } from 'lucide-react';
import { useJobs, Job } from '../context/JobContext';

export const MessagesPage: React.FC = () => {
    const { lastSavedJobs } = useJobs();
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Show ONLY jobs from the latest Jobs Creator save
    const activeJobs = lastSavedJobs;

    const generateMessage = (job: Job) => {
        // Use the job's timeSlot directly (matches Jobs Creator output)
        const timeSlot = job.timeSlot || '08:00 - 10:00';

        return `Good evening, I am Matt, the Hoover/Candy engineer that will be coming to look at your appliance tomorrow. Your correct ETA is as follows: **${timeSlot}**

Please note that this ETA is an estimate. Unforeseen traffic or changes in my daily schedule, such as cancellations, may mean I arrive slightly earlier or later. I will of course contact you if any significant changes to this estimate arise.`;
    };

    const handleCopy = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                        <MessageSquare className="text-white" size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--color-secondary)]">Messages</h1>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            SMS arrival notifications for customers
                        </p>
                    </div>
                </div>

                {/* Job Count Badge */}
                <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md border border-white/40 rounded-xl px-4 py-2 shadow-sm">
                    <Calendar size={18} className="text-[var(--color-primary)]" />
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-bold">
                            Jobs to Message
                        </span>
                        <span className="text-lg font-bold text-[var(--color-secondary)]">
                            {activeJobs.length}
                        </span>
                    </div>
                </div>
            </div>

            {/* Jobs List */}
            <div className="card-glass p-6 md:p-8">
                {activeJobs.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                            <MessageSquare className="text-slate-400" size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-600 mb-2">No Jobs to Message</h3>
                        <p className="text-sm text-slate-500 max-w-md mx-auto">
                            Create jobs in the Jobs Creator first, then return here to generate customer messages.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {activeJobs.map((job, index) => {
                            const message = generateMessage(job);
                            const isCopied = copiedId === job.id;

                            return (
                                <motion.div
                                    key={job.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl p-6 hover:border-indigo-500/30 transition-all shadow-sm hover:shadow-md group"
                                >
                                    {/* Job Header */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 
                                                            border border-slate-200 flex flex-col items-center justify-center shadow-inner">
                                                <span className="text-[8px] text-slate-500 font-bold uppercase">JOB</span>
                                                <span className="text-lg font-black text-[var(--color-secondary)]">{index + 1}</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-[var(--color-secondary)]">{job.customerName}</h4>
                                                <p className="text-xs text-[var(--color-text-muted)]">{job.address}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 font-mono font-bold text-sm border border-indigo-100">
                                                {job.timeSlot}
                                            </span>
                                            <button
                                                onClick={() => handleCopy(job.id, message)}
                                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${isCopied
                                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                                                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                                                    }`}
                                            >
                                                {isCopied ? <Check size={16} /> : <Copy size={16} />}
                                                {isCopied ? 'Copied!' : 'Copy Message'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Message Preview */}
                                    <div
                                        className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/50 relative cursor-pointer group/msg"
                                        onClick={() => handleCopy(job.id, message)}
                                    >
                                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{message}</p>
                                        <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center justify-center rounded-xl pointer-events-none">
                                            <span className="text-xs font-bold text-indigo-600 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-indigo-100">
                                                Click to Copy
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
