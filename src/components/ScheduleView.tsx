import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, AlertCircle } from 'lucide-react';
import { JobCard } from './JobCard';
import { Job, useJobs } from '../context/JobContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { getCalendar, loadScheduleByDate, CalendarIndex } from '../services/driveStorage';

interface ScheduleViewProps {
    jobs: Job[];
    onJobClick: (job: Job) => void;
    accessToken?: string;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ jobs, onJobClick, accessToken }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [calendarData, setCalendarData] = useState<CalendarIndex | null>(null);
    const [selectedDayJobs, setSelectedDayJobs] = useState<Job[]>(jobs);
    const [loadingJobs, setLoadingJobs] = useState(false);
    const { setJobs } = useJobs();

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Fetch calendar.json for instant date dots (no folder scanning!)
    useEffect(() => {
        const fetchCalendar = async () => {
            if (!accessToken) return;

            try {
                const calendar = await getCalendar(accessToken);
                if (calendar) {
                    setCalendarData(calendar);
                    console.log(`[ScheduleView] Loaded calendar with ${Object.keys(calendar.dates).length} dates`);
                }
            } catch (error) {
                console.error('[ScheduleView] Failed to fetch calendar:', error);
            }
        };

        fetchCalendar();
    }, [accessToken]); // Only fetch once on mount (not per month)

    // Handle date selection - load jobs for that date
    const handleDateSelect = async (date: Date) => {
        setSelectedDate(date);

        if (!accessToken) {
            // Fallback to mock behavior
            if (isSameDay(date, new Date())) {
                setSelectedDayJobs(jobs);
            } else {
                setSelectedDayJobs([]);
            }
            return;
        }

        setLoadingJobs(true);
        try {
            const dateStr = format(date, 'yyyy-MM-dd');
            const schedule = await loadScheduleByDate(accessToken, dateStr);

            if (schedule && schedule.jobs) {
                setSelectedDayJobs(schedule.jobs);
            } else {
                setSelectedDayJobs([]);
            }
        } catch (error) {
            console.error('[ScheduleView] Failed to load jobs for date:', error);
            setSelectedDayJobs([]);
        } finally {
            setLoadingJobs(false);
        }
    };

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    // Check if a date has saved jobs (uses calendarData)
    const dateHasJobs = (date: Date): boolean => {
        if (!calendarData?.dates) return false;
        const dateStr = format(date, 'yyyy-MM-dd');
        return dateStr in calendarData.dates;
    };

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="flex flex-col md:flex-row gap-6 h-full">
                {/* Calendar Side */}
                <div className="md:w-1/3 flex flex-col gap-6">
                    <div className="card-glass p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="font-heading font-bold text-xl text-[var(--color-secondary)]">
                                {format(currentDate, 'MMMM yyyy')}
                            </h2>
                            <div className="flex gap-2">
                                <button onClick={prevMonth} className="p-2 hover:bg-[var(--color-primary)]/10 rounded-lg text-slate-500 hover:text-[var(--color-primary)] transition-colors">
                                    <ChevronLeft size={20} />
                                </button>
                                <button onClick={nextMonth} className="p-2 hover:bg-[var(--color-primary)]/10 rounded-lg text-slate-500 hover:text-[var(--color-primary)] transition-colors">
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center mb-2">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                                <div key={`${day}-${i}`} className="text-xs font-bold text-[var(--color-text-muted)] py-2">
                                    {day}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                            {/* Padding for start of month */}
                            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                                <div key={`empty-${i}`} />
                            ))}

                            {daysInMonth.map((day) => {
                                const isSelected = isSameDay(day, selectedDate);
                                const isTodayDate = isToday(day);
                                const hasJobs = dateHasJobs(day);

                                return (
                                    <button
                                        key={day.toISOString()}
                                        onClick={() => handleDateSelect(day)}
                                        className={`
                                            relative h-10 w-10 mx-auto rounded-xl flex items-center justify-center text-sm font-medium transition-all
                                            ${isSelected
                                                ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-blue-500/30 font-bold'
                                                : 'hover:bg-slate-100 text-slate-600'}
                                            ${isTodayDate && !isSelected ? 'text-[var(--color-primary)] font-bold bg-blue-50' : ''}
                                        `}
                                    >
                                        {format(day, 'd')}
                                        {hasJobs && (
                                            <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-[var(--color-primary)]'}`} />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="card-glass p-6 bg-gradient-to-br from-[var(--color-primary)] to-cyan-500 text-white border-0">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                                <CalendarIcon size={24} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg mb-1">Schedule Sync</h3>
                                <p className="text-blue-50 text-sm mb-4">
                                    Your schedule is synced with Google Calendar. Changes made here will update automatically.
                                </p>
                                <button className="px-4 py-2 bg-white text-[var(--color-primary)] rounded-lg text-sm font-bold shadow-sm hover:bg-blue-50 transition-colors">
                                    Sync Now
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Jobs List Side */}
                <div className="flex-1 flex flex-col">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-[var(--color-secondary)]">
                                {isToday(selectedDate) ? 'Today\'s Schedule' : format(selectedDate, 'EEEE, MMMM do')}
                            </h2>
                            <p className="text-slate-500">
                                {loadingJobs ? 'Loading...' : `${selectedDayJobs.length} jobs scheduled`}
                            </p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                        {loadingJobs ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="animate-spin w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full" />
                            </div>
                        ) : selectedDayJobs.length > 0 ? (
                            selectedDayJobs.map((job, index) => (
                                <div key={job.id} onClick={() => onJobClick(job)} className="cursor-pointer">
                                    <JobCard job={job} index={index} onAskOscar={() => { }} onOpenOscar={() => { }} />
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                                <CalendarIcon size={48} className="mb-4 text-slate-300" />
                                <p className="font-medium">No jobs scheduled for this date</p>
                                <button className="mt-4 px-4 py-2 text-[var(--color-primary)] font-bold text-sm hover:bg-[var(--color-primary)]/5 rounded-lg transition-colors">
                                    + Add Job manually
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
