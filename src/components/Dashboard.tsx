import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Shell } from './Shell';
import { JobCard } from './JobCard';
import { JobDetail } from './JobDetail';
import Settings from './Settings';
import { OscarChat } from './OscarChat';
import { DiagnosticWizard } from './DiagnosticWizard';
import { IngestManager } from './IngestManager';
import { MessageCenter } from './MessageCenter';
import { MessagesPage } from './MessagesPage';
import { TrainingCenter } from './TrainingCenter';
import { ScheduleView } from './ScheduleView';

import { JobsCreator } from './JobsCreator';
import { SPOParts } from './SPOParts';
import { SPOProcessor, TrafficReport, SPOJob } from '../services/SPOProcessor'; // Import SPO services
import { ArrowRight, Zap, Activity, AlertTriangle, Truck, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useJobs, Job } from '../context/JobContext';
import { loadScheduleByDate, getTodayDateString } from '../services/driveStorage';

interface DashboardProps {
    accessToken: string;
    onLogout: () => void;
}

// Helper to get week days around a date
const getWeekDays = (centerDate: Date): Date[] => {
    const days: Date[] = [];
    const start = new Date(centerDate);
    start.setDate(start.getDate() - 3); // 3 days before center

    for (let i = 0; i < 7; i++) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        days.push(day);
    }
    return days;
};

// Helper to format date to YYYY-MM-DD
const formatDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

export const Dashboard: React.FC<DashboardProps> = ({ accessToken, onLogout }) => {
    const { jobs: unsortedJobs, isLoading, userProfile, todaysMileage, setJobs } = useJobs();

    // Sort jobs by timeSlot
    const jobs = [...unsortedJobs].sort((a, b) => {
        return a.timeSlot.localeCompare(b.timeSlot);
    });

    // Selected date state (defaults to today)
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [showCalendar, setShowCalendar] = useState(false);
    const [calendarLoading, setCalendarLoading] = useState(false);
    const [displayedMileage, setDisplayedMileage] = useState<number | null>(todaysMileage);

    const [activeView, setActiveView] = useState('dashboard');
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [oscarJob, setOscarJob] = useState<Job | null>(null);

    // SPO State
    const [spoReport, setSpoReport] = useState<TrafficReport | null>(null);

    // Tools State
    const [showDiagnostic, setShowDiagnostic] = useState(false);
    const [showIngest, setShowIngest] = useState(false);
    const [showMessages, setShowMessages] = useState(false);
    const [showTraining, setShowTraining] = useState(false);

    // Fetch SPO Report on Mount (Cache Only)
    React.useEffect(() => {
        const fetchSPO = async () => {
            try {
                const processor = new SPOProcessor(accessToken);
                // Load cached report for speed and stability
                const report = await processor.loadReport();
                if (report) {
                    setSpoReport(report);
                }
            } catch (e) {
                console.warn("[Dashboard] Could not load SPO report cache:", e);
            }
        };
        fetchSPO();
    }, [accessToken]);

    // Format mileage for display (pre-calculated from saved schedule)
    const formattedMileage = displayedMileage !== null
        ? `${displayedMileage}mi`
        : jobs.length > 0 ? 'Not calculated' : '0mi';

    // Check if selected date is today
    const isToday = formatDateKey(selectedDate) === getTodayDateString();

    // Helper to find SPO Data for a specific job
    const getSPODataForJob = (job: Job): SPOJob | undefined => {
        if (!spoReport) return undefined;
        // Search in all categories (focus on Waiting/Ready)
        const allSPO = [...spoReport.ready, ...spoReport.waiting, ...spoReport.danger];

        // Normalize for comparison
        const normalize = (s: string) => (s || "").toLowerCase().replace(/\s+/g, "");
        const jName = normalize(job.customerName);
        const jZip = normalize(job.address || ""); // Use address as fallback for now

        // Fallback: If job.postCode is missing, try to check address
        // But for now assumes job.name + address/zip logic from JobContext match.
        // Actually Job object has address usually. Let's try name match strict first

        return allSPO.find(s => {
            const sName = normalize(s.name);
            const sZip = normalize(s.zip);

            // Loose matching: Name must be similar (includes) and Zip (starts with) if possible
            // But strict matching "Key" logic is best.
            return sName.includes(jName) || jName.includes(sName);
        });
    };

    // Calculate Active SPO Jobs for TODAY (or selected day)
    const spoJobsForDay = jobs.filter(j => !!getSPODataForJob(j));
    const spoCount = spoJobsForDay.length;

    // Format selected date for header
    const headerDateText = selectedDate.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // Handle date selection from calendar
    const handleDateSelect = async (date: Date) => {
        setSelectedDate(date);
        setShowCalendar(false);
        setCalendarLoading(true);

        try {
            const dateStr = formatDateKey(date);
            const schedule = await loadScheduleByDate(accessToken, dateStr);

            if (schedule && schedule.jobs) {
                setJobs(schedule.jobs);
                setDisplayedMileage(schedule.total_mileage || null);
            } else {
                setJobs([]);
                setDisplayedMileage(null);
            }
        } catch (error) {
            console.error('Failed to load schedule for date:', error);
            setJobs([]);
            setDisplayedMileage(null);
        } finally {
            setCalendarLoading(false);
        }
    };

    const handleJobClick = (job: Job) => {
        setSelectedJob(job);
    };

    const handleBack = () => {
        setSelectedJob(null);
    };

    // Command Palette Shortcut
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setActiveView('jobs');
                // Small timeout to allow view transition if needed
                setTimeout(() => {
                    const input = document.getElementById('job-search-input');
                    if (input) input.focus();
                }, 10);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const stats = [
        {
            label: 'SPO Jobs',
            value: spoCount.toString(),
            icon: <Zap size={20} className={spoCount > 0 ? "text-red-500" : "text-amber-400"} />,
            trend: spoCount > 0 ? 'ALERT' : '+2',
            isAlert: spoCount > 0
        },
        { label: 'Recall Jobs', value: '0', icon: <AlertTriangle size={20} className="text-rose-400" />, trend: '-1' },
        { label: 'Est. Mileage', value: formattedMileage, icon: <Truck size={20} className="text-emerald-400" />, trend: 'Saved' },
        { label: 'Today\'s Jobs', value: jobs.length.toString(), icon: <Activity size={20} className="text-[var(--color-primary)]" />, trend: 'On Track' }
    ];

    const SkeletonCard = () => (
        <div className="bg-white p-5 border border-slate-200 rounded-xl flex flex-col gap-3 animate-pulse">
            <div className="flex justify-between items-center">
                <div className="w-1/3 h-4 bg-slate-200 rounded" />
                <div className="w-16 h-5 bg-slate-200 rounded" />
            </div>
            <div className="space-y-2">
                <div className="w-3/4 h-6 bg-slate-200 rounded" />
                <div className="w-1/2 h-4 bg-slate-200 rounded" />
            </div>
            <div className="mt-auto pt-3 border-t border-slate-100 flex justify-between">
                <div className="w-12 h-4 bg-slate-200 rounded" />
                <div className="w-24 h-8 bg-slate-200 rounded-xl" />
            </div>
        </div>
    );

    return (
        <Shell activeView={activeView} onNavigate={setActiveView} onLogout={onLogout} userProfile={userProfile}>
            {() => (
                <div className="flex flex-col gap-6 relative pb-20">
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
                            {/* FSD Header Card */}
                            <div className="bg-gradient-to-r from-sky-100 to-blue-100 rounded-3xl p-8 mb-2 flex items-center justify-between relative overflow-hidden shadow-lg border border-sky-200/50">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                                <div className="flex items-center gap-6 relative z-10">
                                    <div className="w-16 h-16 bg-[var(--color-primary)] border border-[var(--color-primary)] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-[var(--color-primary)] font-bold text-xl">
                                            F
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-sky-600 tracking-wide uppercase mb-1">
                                            {headerDateText}
                                        </p>
                                        <h2 className="text-3xl font-heading font-bold text-slate-800">
                                            Welcome back, {userProfile?.given_name || 'Engineer'}
                                        </h2>
                                        <p className="text-slate-600 font-medium mt-1">
                                            You have {calendarLoading || isLoading ? '...' : jobs.length} jobs scheduled{isToday ? ' for today' : ''}.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                {stats.map((stat, i) => (
                                    <div key={i} className={`card-glass p-6 flex flex-col justify-between group hover:border-[var(--color-primary)]/30 transition-all cursor-default ${stat.isAlert ? 'border-red-400 bg-red-50/50' : ''}`}>
                                        <div className="flex items-start justify-between mb-4">
                                            <div className={`p-2.5 rounded-xl bg-white/50 border border-white/60 shadow-sm ${stat.isAlert ? 'text-red-500' : 'text-slate-600'}`}>
                                                {stat.icon}
                                            </div>
                                            {stat.trend && (
                                                <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${stat.isAlert ? 'bg-red-100 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                                    {stat.trend}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <div className={`text-2xl font-bold mb-1 ${stat.isAlert ? 'text-red-600' : 'text-[var(--color-secondary)]'}`}>{stat.value}</div>
                                            <div className={`text-xs font-bold uppercase tracking-widest ${stat.isAlert ? 'text-red-500' : 'text-[var(--color-text-muted)]'}`}>{stat.label}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* JOBS SECTION */}
                            <div className="space-y-4 relative">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="font-heading font-bold text-xl text-[var(--color-secondary)] flex items-center gap-2">
                                        {isToday ? "Today's Dashboard" : selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                                        <span className="px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary-text)] text-xs font-bold border border-[var(--color-primary)]/20">
                                            {calendarLoading || isLoading ? '...' : jobs.length}
                                        </span>
                                    </h3>
                                    <button
                                        onClick={() => setShowCalendar(!showCalendar)}
                                        className="text-sm font-bold text-[var(--color-text-muted)] hover:text-[var(--color-primary)] flex items-center gap-1 transition-colors"
                                    >
                                        <Calendar size={16} /> View Calendar <ArrowRight size={16} />
                                    </button>
                                </div>

                                {/* Week Calendar Popup */}
                                <AnimatePresence>
                                    {showCalendar && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute right-0 top-12 z-50 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 w-auto"
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <button
                                                    onClick={() => {
                                                        const newDate = new Date(selectedDate);
                                                        newDate.setDate(newDate.getDate() - 7);
                                                        setSelectedDate(newDate);
                                                    }}
                                                    className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                                                >
                                                    <ChevronLeft size={20} className="text-slate-600" />
                                                </button>
                                                <span className="font-bold text-slate-700">
                                                    {selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        const newDate = new Date(selectedDate);
                                                        newDate.setDate(newDate.getDate() + 7);
                                                        setSelectedDate(newDate);
                                                    }}
                                                    className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                                                >
                                                    <ChevronRight size={20} className="text-slate-600" />
                                                </button>
                                            </div>
                                            <div className="flex gap-2">
                                                {getWeekDays(selectedDate).map((day, i) => {
                                                    const isSelected = formatDateKey(day) === formatDateKey(selectedDate);
                                                    const isDayToday = formatDateKey(day) === getTodayDateString();
                                                    return (
                                                        <button
                                                            key={i}
                                                            onClick={() => handleDateSelect(day)}
                                                            className={`flex flex-col items-center p-3 rounded-xl min-w-[60px] transition-all ${isSelected
                                                                ? 'bg-[var(--color-primary)] text-white shadow-lg'
                                                                : isDayToday
                                                                    ? 'bg-sky-100 text-sky-700 border-2 border-sky-300'
                                                                    : 'hover:bg-slate-100 text-slate-600'
                                                                }`}
                                                        >
                                                            <span className="text-xs font-bold uppercase">
                                                                {day.toLocaleDateString('en-GB', { weekday: 'short' })}
                                                            </span>
                                                            <span className="text-lg font-bold">
                                                                {day.getDate()}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex justify-between mt-4 pt-3 border-t border-slate-100">
                                                <button
                                                    onClick={() => handleDateSelect(new Date())}
                                                    className="text-sm font-bold text-[var(--color-primary)] hover:underline"
                                                >
                                                    Go to Today
                                                </button>
                                                <button
                                                    onClick={() => setShowCalendar(false)}
                                                    className="text-sm font-medium text-slate-500 hover:text-slate-700"
                                                >
                                                    Close
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="space-y-4">
                                    {isLoading ? (
                                        <>
                                            <SkeletonCard />
                                            <SkeletonCard />
                                            <SkeletonCard />
                                        </>
                                    ) : (
                                        jobs.map((job, index) => {
                                            const spoData = getSPODataForJob(job);
                                            return (
                                                <div key={job.id} onClick={() => handleJobClick(job)} className="cursor-pointer">
                                                    <JobCard
                                                        job={job}
                                                        index={index}
                                                        onAskOscar={setOscarJob}
                                                        onOpenOscar={setOscarJob}
                                                        spoData={spoData} // Pass SPO Data
                                                    />
                                                </div>
                                            );
                                        }))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* OTHER VIEWS */}
                    {activeView === 'jobs' && (
                        <JobsCreator accessToken={accessToken} />
                    )}

                    {activeView === 'settings' && (
                        <div className="card-glass p-8">
                            <Settings onClose={() => setActiveView('dashboard')} accessToken={accessToken} />
                        </div>
                    )}

                    {activeView === 'schedule' && (
                        <ScheduleView jobs={jobs} onJobClick={handleJobClick} accessToken={accessToken} />
                    )}

                    {activeView === 'messages' && (
                        <MessagesPage />
                    )}

                    {activeView === 'spo-parts' && (
                        <SPOParts accessToken={accessToken} report={spoReport} onUpdate={setSpoReport} />
                    )}

                    {/* Job Detail Modal (Portal to body for proper layering) */}
                    {selectedJob && createPortal(
                        <div className="fixed inset-0 z-[100] bg-[#F4F6F8] overflow-y-auto overscroll-contain">
                            <JobDetail job={selectedJob} onBack={handleBack} />
                        </div>,
                        document.body
                    )}
                </div>
            )}
        </Shell>
    );
};
