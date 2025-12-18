
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Copy, Check, X } from 'lucide-react';
import { useJobs, Job } from '../context/JobContext';

interface MessageCenterProps {
    onClose: () => void;
}

export const MessageCenter: React.FC<MessageCenterProps> = ({ onClose }) => {
    const { jobs } = useJobs();
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Filter for relevant jobs (e.g., pending or in-progress)
    const activeJobs = jobs.filter(j => j.status !== 'completed');

    const generateMessage = (job: Job) => {
        const date = new Date();
        date.setDate(date.getDate() + 1); // "Tomorrow"
        const dateStr = date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

        // "Hi [Name], this is FSD.PRO. We are scheduled to arrive tomorrow [Date] between [Time] for your [Product]. Please reply to confirm."
        return `Hi ${job.customerName}, this is FSD.PRO. We are scheduled to arrive tomorrow, ${dateStr}, between ${job.timeSlot} for your ${job.detectedProduct || job.modelNumber || 'appliance'}. Please reply to confirm availability. Thanks!`;
    };

    const handleCopy = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">

                <div className="p-6 border-b border-white/10 bg-black/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                            <MessageSquare size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white">Message Center</h2>
                            <p className="text-sm text-slate-400">Arrival Notifications (SMS Generator)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">Close</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {activeJobs.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            No active jobs found to message.
                        </div>
                    ) : (
                        activeJobs.map((job) => {
                            const message = generateMessage(job);
                            const isCopied = copiedId === job.id;

                            return (
                                <motion.div
                                    key={job.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-indigo-500/30 transition-colors"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-bold text-white">{job.customerName}</h4>
                                            <p className="text-xs text-slate-400">{job.address} • {job.timeSlot}</p>
                                        </div>
                                        <button
                                            onClick={() => handleCopy(job.id, message)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all ${isCopied
                                                    ? 'bg-emerald-500 text-white'
                                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                                }`}
                                        >
                                            {isCopied ? <Check size={14} /> : <Copy size={14} />}
                                            {isCopied ? 'COPIED!' : 'COPY TEXT'}
                                        </button>
                                    </div>

                                    <div className="bg-black/40 p-3 rounded-lg border border-white/5 relative group cursor-pointer" onClick={() => handleCopy(job.id, message)}>
                                        <p className="text-sm text-slate-300 font-mono leading-relaxed">{message}</p>
                                        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg pointer-events-none">
                                            <span className="text-xs font-bold text-white bg-black/60 px-2 py-1 rounded">Click to Copy</span>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>

            </div>
        </div>
    );
};
