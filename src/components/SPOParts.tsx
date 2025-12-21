import React, { useState, useEffect } from 'react';
import { Package, RefreshCw, CheckCircle, Search, Filter, AlertTriangle, CheckSquare, Clock, Archive, UploadCloud } from 'lucide-react';
import { SPOProcessor, TrafficReport, SPOJob } from '../services/SPOProcessor';
import { saveSPOTracking, loadSPOTracking } from '../services/googleDriveService';
import { motion, AnimatePresence } from 'framer-motion';
import { loadScheduleByDate } from '../services/driveStorage';

interface SPOPartsProps {
    accessToken: string;
    report: TrafficReport | null; // Lifted State
    onUpdate: (report: TrafficReport) => void; // Lifted Setter
}

export const SPOParts: React.FC<SPOPartsProps> = ({ accessToken, report, onUpdate }) => {
    // Local state only for UI ephemeral things
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);

    // Initial Load REMOVED - Dashboard handles this now

    const runReport = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const processor = new SPOProcessor(accessToken);
            const data = await processor.generateReport();
            onUpdate(data); // Using Prop
        } catch (err: any) {
            console.error("Traffic Report Error", err);
            setError(err.message || "Failed to generate report.");
        } finally {
            setIsLoading(false);
        }
    };

    const toggleComplete = async (job: SPOJob) => {
        // Move to History Logic
        // We add ID to persistence
        try {
            const currentIds = await loadSPOTracking(accessToken);
            if (!currentIds.includes(job.id)) {
                await saveSPOTracking(accessToken, [...currentIds, job.id]);

                // Optimistic UI Update
                if (report) {
                    const newReport = { ...report };
                    // Remove from current list
                    newReport.danger = newReport.danger.filter(j => j.id !== job.id);
                    newReport.ready = newReport.ready.filter(j => j.id !== job.id);
                    newReport.waiting = newReport.waiting.filter(j => j.id !== job.id);

                    // Add to history
                    const completedJob = { ...job, category: 'HISTORY' as const };
                    newReport.history.unshift(completedJob);

                    // Update stats
                    newReport.stats.history++;

                    onUpdate(newReport); // Using Prop
                }
            }
        } catch (e) {
            console.error("Failed to mark complete", e);
        }
    };

    // Filtering
    const filterJobs = (jobs: SPOJob[]) => {
        if (!searchTerm) return jobs;
        const term = searchTerm.toLowerCase();
        return jobs.filter(j =>
            j.name.toLowerCase().includes(term) ||
            j.zip.toLowerCase().includes(term) ||
            j.sa.toLowerCase().includes(term) ||
            j.parts.some(p => p.desc.toLowerCase().includes(term) || p.code.toLowerCase().includes(term))
        );
    };

    const Section = ({ title, jobs, colorClass, icon, type }: { title: string, jobs: SPOJob[], colorClass: string, icon: React.ReactNode, type: string }) => {
        const filtered = filterJobs(jobs);
        if (filtered.length === 0) return null;

        return (
            <div className="mb-8">
                <div className={`flex items-center gap-3 p-4 rounded-t-2xl ${colorClass} text-white shadow-sm`}>
                    {icon}
                    <h3 className="font-bold text-lg tracking-wide">{title} ({filtered.length})</h3>
                </div>
                <div className="bg-white/50 backdrop-blur-sm border-x border-b border-slate-200 rounded-b-2xl p-4 grid gap-4">
                    {filtered.map(job => (
                        <div key={job.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative group hover:shadow-md transition-all">

                            <div className="flex flex-col md:flex-row gap-4">
                                {/* Job Details */}
                                <div className="md:w-1/3 border-r border-slate-100 pr-4 flex flex-col">
                                    <h4 className="font-bold text-slate-800 text-lg">{job.name}</h4>
                                    <div className="flex items-center gap-2 text-slate-500 font-mono text-sm mt-1">
                                        <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-bold">{job.zip}</span>
                                        {job.sa && <span className="flex items-center gap-1"><CheckSquare size={12} /> {job.sa}</span>}
                                    </div>
                                    <div className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                                        {job.jobDate ? `📅 ${job.jobDate}` : 'Not Scheduled'}
                                        {job.jobStatus && ` • ${job.jobStatus}`}
                                    </div>

                                    <button
                                        onClick={() => toggleComplete(job)}
                                        className="mt-4 w-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
                                        title="Mark as Completed"
                                    >
                                        <CheckCircle size={14} /> COMPLETED?
                                    </button>
                                </div>

                                {/* Parts List */}
                                <div className="flex-1 space-y-2">
                                    {job.parts.map((part, idx) => (
                                        <div key={idx} className={`flex items-center justify-between p-2 rounded-lg text-sm border ${part.isArrived ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                                            type === 'DANGER' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-amber-50 border-amber-100 text-amber-800'
                                            }`}>
                                            <span className="font-medium truncate flex-1">{part.desc} <span className="opacity-70 text-xs">[{part.code}]</span></span>
                                            <span className="font-bold text-xs uppercase px-2">
                                                {part.rawStatus.toLowerCase() === 'completed' ? 'ARRIVED' : part.rawStatus}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col p-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-heading font-bold text-slate-800 flex items-center gap-3">
                        <Package className="text-[var(--color-primary)]" size={32} />
                        Logistics Dashboard
                    </h2>
                    <p className="text-slate-500 font-medium">Traffic Control for Parts & Appointments</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={runReport}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] hover:bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/30 transition-all font-bold disabled:opacity-50"
                    >
                        {isLoading ? <RefreshCw className="animate-spin" /> : <UploadCloud />}
                        Scan Drive Drops
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 animate-in slide-in-from-top-2">
                    <AlertTriangle />
                    <div>
                        <p className="font-bold">Scan Failed</p>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!report && !isLoading && !error && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl m-4 bg-slate-50/50">
                    <UploadCloud size={64} className="mb-4 text-slate-300" />
                    <h3 className="text-xl font-bold text-slate-500">No Report Generated</h3>
                    <p className="max-w-md text-center mt-2 mb-6">
                        Upload your <b>Service Appointments</b> and <b>18836...</b> files to the <code>FSD_PRO_DATA/SPO_DROPS</code> folder in Drive, then click Scan.
                    </p>
                    <button onClick={runReport} className="text-[var(--color-primary)] font-bold hover:underline">Scan Now</button>
                </div>
            )}

            {/* Stats Summary */}
            {report && (
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center justify-between">
                        <div>
                            <div className="text-3xl font-bold text-red-600">{report.stats.danger}</div>
                            <div className="text-xs font-bold text-red-400 uppercase tracking-widest">Danger (Scheduled)</div>
                        </div>
                        <AlertTriangle className="text-red-200" size={32} />
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center justify-between">
                        <div>
                            <div className="text-3xl font-bold text-emerald-600">{report.stats.ready}</div>
                            <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Ready to Book</div>
                        </div>
                        <CheckCircle className="text-emerald-200" size={32} />
                    </div>
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center justify-between">
                        <div>
                            <div className="text-3xl font-bold text-amber-600">{report.stats.waiting}</div>
                            <div className="text-xs font-bold text-amber-400 uppercase tracking-widest">Waiting for Parts</div>
                        </div>
                        <Clock className="text-amber-200" size={32} />
                    </div>
                </div>
            )}

            {/* Main Content */}
            {report && (
                <div className="flex-1 overflow-y-auto pr-2 pb-20">
                    {/* Search */}
                    <div className="mb-6 sticky top-0 z-10">
                        <div className="relative shadow-lg shadow-slate-200/50 rounded-xl">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search report..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-white border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-slate-700 font-medium"
                            />
                        </div>
                    </div>

                    <Section title="🛑 DANGER: SCHEDULED BUT MISSING PARTS" jobs={report.danger} colorClass="bg-red-500" icon={<AlertTriangle />} type="DANGER" />
                    <Section title="✅ READY TO BOOK" jobs={report.ready} colorClass="bg-emerald-500" icon={<CheckCircle />} type="READY" />
                    <Section title="⏳ WAITING FOR PARTS" jobs={report.waiting} colorClass="bg-amber-400" icon={<Clock />} type="WAITING" />

                    <div className="mt-12 border-t border-slate-200 pt-8">
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-700 transition-colors mb-4"
                        >
                            <Archive size={20} />
                            {showHistory ? 'Hide History' : 'Show Closed / History'} ({report.stats.history})
                        </button>

                        {showHistory && (
                            <div className="opacity-75 grayscale hover:grayscale-0 transition-all duration-500">
                                <Section title="🏁 HISTORY / CLOSED" jobs={report.history} colorClass="bg-slate-500" icon={<Archive />} type="HISTORY" />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
