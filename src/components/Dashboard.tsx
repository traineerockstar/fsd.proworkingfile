import React, { useState } from 'react';
import { Shell } from './Shell'; // Use Shell now
import { JobCard } from './JobCard';
import { JobDetail } from './JobDetail';
import Settings from './Settings';
import { OscarChat } from './OscarChat';
import { DiagnosticWizard } from './DiagnosticWizard';
import { IngestManager } from './IngestManager';
import { MessageCenter } from './MessageCenter';
import { TrainingCenter } from './TrainingCenter';
import { Menu, Search, Bell, Wrench, Calendar, MessageSquare, Book } from 'lucide-react';
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
    // const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Managed by Shell now
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
            {({ toggleSidebar }: { toggleSidebar: () => void }) => (
                <div className="flex flex-col h-full relative">
                    <AnimatePresence>
                        {oscarJob && <OscarChat job={oscarJob} onClose={() => setOscarJob(null)} />}
                        {showDiagnostic && <DiagnosticWizard accessToken={accessToken} onClose={() => setShowDiagnostic(false)} />}
                        {showIngest && <IngestManager accessToken={accessToken} onClose={() => setShowIngest(false)} />}
                        {showMessages && <MessageCenter onClose={() => setShowMessages(false)} />}
                        {showTraining && <TrainingCenter accessToken={accessToken} onClose={() => setShowTraining(false)} />}
                    </AnimatePresence>

                    {/* Top Navbar */}
                    <header className="sticky top-0 z-30 bg-black/60 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={toggleSidebar}
                                className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all md:hidden"
                            >
                                <Menu size={20} />
                            </button>
                            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                                {selectedJob ? 'Job Details' : (activeView === 'dashboard' ? 'Schedule' : activeView.charAt(0).toUpperCase() + activeView.slice(1))}
                            </h1>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Quick Tools */}
                            <div className="hidden md:flex items-center gap-1 mr-4 border-r border-white/10 pr-4">
                                <button onClick={() => setShowDiagnostic(true)} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors" title="Diagnostic Wizard">
                                    <Wrench size={18} />
                                </button>
                                <button onClick={() => setShowIngest(true)} className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Smart Scheduler">
                                    <Calendar size={18} />
                                </button>
                                <button onClick={() => setShowMessages(true)} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors" title="Message Center">
                                    <MessageSquare size={18} />
                                </button>
                                <button onClick={() => setShowTraining(true)} className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors" title="Training Center">
                                    <Book size={18} />
                                </button>
                            </div>

                            <div className="flex items-center gap-4">
                                <button className="p-2 text-slate-400 hover:text-white transition-colors relative">
                                    <Bell size={20} />
                                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-black" />
                                </button>
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 border border-white/20 shadow-[0_0_10px_rgba(6,182,212,0.4)]" />
                            </div>
                        </div>
                    </header>

                    <main className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        <AnimatePresence mode="wait">
                            {selectedJob ? (
                                <JobDetail key="detail" job={selectedJob} onBack={handleBack} />
                            ) : (
                                <motion.div
                                    key="list"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                >
                                    {/* Search Bar - Only show on list view */}
                                    {(activeView === 'dashboard' || activeView === 'jobs') && (
                                        <div className="relative mb-8">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                            <input
                                                type="text"
                                                placeholder="Search jobs, engineers, or locations..."
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all"
                                            />
                                        </div>
                                    )}

                                    {/* Content Area */}
                                    {activeView === 'dashboard' && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

                                    {activeView === 'jobs' && (
                                        <div className="space-y-6">
                                            <h2 className="text-xl font-bold text-slate-200 mb-4">All Active Jobs</h2>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                                        <Settings onClose={() => setActiveView('dashboard')} accessToken={accessToken} />
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </main>

                    {/* Oscar FAB */}
                    {!oscarJob && (
                        <button
                            onClick={() => setOscarJob({ id: 'global' } as Job)}
                            className="absolute bottom-6 right-6 p-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full shadow-lg shadow-purple-500/30 text-white hover:scale-110 transition-transform z-40 group"
                        >
                            <Bot size={28} />
                            <span className="absolute right-full mr-4 bg-black/80 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none backdrop-blur-sm">
                                Ask Oscar
                            </span>
                        </button>
                    )}
                </div>
            )
            }
        </Shell >
    );
};
