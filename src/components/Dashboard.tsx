import React, { useState } from 'react';
import { Shell } from './Shell';
import { JobCard } from './JobCard';
import { JobDetail } from './JobDetail';
import Settings from './Settings';
import { OscarChat } from './OscarChat';
import { DiagnosticWizard } from './DiagnosticWizard';
import { IngestManager } from './IngestManager';
import { MessageCenter } from './MessageCenter';
import { TrainingCenter } from './TrainingCenter';
import { ArrowRight, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useJobs, Job } from '../context/JobContext';
import { Bot } from 'lucide-react';

interface DashboardProps {
    accessToken: string;
    onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ accessToken, onLogout }) => {
    const { jobs } = useJobs();
    const [activeView, setActiveView] = useState('dashboard');
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [oscarJob, setOscarJob] = useState<Job | null>(null);

    // Tools State
    const [showDiagnostic, setShowDiagnostic] = useState(false);
    const [showIngest, setShowIngest] = useState(false);
    const [showMessages, setShowMessages] = useState(false);
    const [showTraining, setShowTraining] = useState(false);

    const handleJobClick = (job: Job) => {
        setSelectedJob(job);
    };

    const handleBack = () => {
        setSelectedJob(null);
    };

    return (
        <Shell activeView={activeView} onNavigate={setActiveView} onLogout={onLogout}>
            {() => (
                <div className="flex flex-col gap-6 relative">
                    <AnimatePresence>
                        {oscarJob && <OscarChat job={oscarJob} onClose={() => setOscarJob(null)} />}
                        {showDiagnostic && <DiagnosticWizard accessToken={accessToken} onClose={() => setShowDiagnostic(false)} />}
                        {showIngest && <IngestManager accessToken={accessToken} onClose={() => setShowIngest(false)} />}
                        {showMessages && <MessageCenter onClose={() => setShowMessages(false)} />}
                        {showTraining && <TrainingCenter accessToken={accessToken} onClose={() => setShowTraining(false)} />}
                    </AnimatePresence>

                    {/* Dashboard View */}
                    {activeView === 'dashboard' && (
                        <>
                            {/* OVERLAPPING SUMMARY CARD */}
                            <div className="card-classic p-6 flex flex-col gap-6 relative z-20">
                                <div className="flex items-start justify-between border-b border-slate-100 pb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs">
                                            LOGO
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-heading font-bold text-slate-800">Global Tech Services</h2>
                                            <p className="text-sm text-slate-500">Field Operations</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-around text-center">
                                    <div>
                                        <div className="text-3xl font-bold text-[#00A0E9]">7<span className="text-lg font-medium text-slate-400">hrs</span></div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Today</div>
                                    </div>
                                    <div className="w-px h-12 bg-slate-100" />
                                    <div>
                                        <div className="text-3xl font-bold text-[#00A0E9]">35<span className="text-lg font-medium text-slate-400">hrs</span></div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">This Week</div>
                                    </div>
                                </div>
                            </div>

                            {/* 2x2 STATS GRID */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-1">
                                    <span className="text-2xl font-bold text-slate-700">13</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Unconfirmed</span>
                                </div>
                                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-1">
                                    <span className="text-2xl font-bold text-rose-500">18</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Completed</span>
                                </div>
                                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-1">
                                    <span className="text-2xl font-bold text-emerald-500">2</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">In-Progress</span>
                                </div>
                                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-1">
                                    <span className="text-2xl font-bold text-amber-500">4</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Upcoming</span>
                                </div>
                            </div>

                            {/* LAST ACTIVITIES */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="font-heading font-bold text-lg text-slate-700">Last Activities</h3>
                                    <button className="text-sm font-bold text-slate-400 hover:text-[#00A0E9] flex items-center gap-1">
                                        View All <ArrowRight size={16} />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {jobs.map((job, index) => (
                                        <div key={job.id} onClick={() => handleJobClick(job)}>
                                            <JobCard
                                                job={job}
                                                index={index}
                                                onAskOscar={setOscarJob}
                                                onOpenOscar={setOscarJob}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* OTHER VIEWS */}
                    {activeView === 'jobs' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-800">All Jobs</h2>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        className="bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-[#00A0E9]"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {jobs.map((job, index) => (
                                    <div key={job.id} onClick={() => handleJobClick(job)}>
                                        <JobCard
                                            job={job}
                                            index={index}
                                            onAskOscar={setOscarJob}
                                            onOpenOscar={setOscarJob}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeView === 'settings' && (
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                            <Settings onClose={() => setActiveView('dashboard')} accessToken={accessToken} />
                        </div>
                    )}

                    {selectedJob && (
                        <div className="fixed inset-0 z-50 bg-[#F4F6F8] overflow-y-auto">
                            <JobDetail job={selectedJob} onBack={handleBack} />
                        </div>
                    )}
                </div>
            )}
        </Shell>
    );
};
