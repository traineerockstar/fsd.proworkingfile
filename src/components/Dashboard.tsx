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
                            {/* ServiceHQ Dashboard Layout */}

                            {/* FSD.PRO Header Card */}
                            <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100 mb-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-[10px] tracking-widest uppercase">
                                        LOGO
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-800">FSD.PRO</h2>
                                        <p className="text-sm text-slate-500 font-medium">Dashboard</p>
                                    </div>
                                </div>
                                <div className="flex gap-12 text-center pr-12">
                                    {/* Placeholder for future sparklines or simplified metrics if needed, currently empty per design */}
                                    <div className="hidden md:block">
                                        <div className="h-8 w-px bg-slate-100 mx-auto mb-2"></div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">This Week</span>
                                    </div>
                                </div>
                            </div>

                            {/* 4-Column Stats Row */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                                {[
                                    { label: 'SPO JOBs', value: '0' },
                                    { label: 'Recall Jobs', value: '0' },
                                    { label: 'Estimated Milage', value: '0' },
                                    { label: 'Todays Jobs', value: '0' }
                                ].map((stat, i) => (
                                    <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2">
                                        <span className="text-3xl font-bold text-slate-800">{stat.value}</span>
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
                                            <div className="w-8 h-1 bg-slate-100 rounded-full" />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* LAST ACTIVITIES */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="font-heading font-bold text-lg text-slate-700">Last Activities</h3>
                                    <button className="text-sm font-bold text-slate-400 hover:text-blue-500 flex items-center gap-1">
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
