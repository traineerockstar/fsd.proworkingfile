import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Camera,
    RefreshCw,
    Calendar,
    Save,
    Trash2,
    CheckCircle,
    AlertCircle,
    Sparkles,
    Truck,
    X
} from 'lucide-react';
import { imageService } from '../services/imageService';
import { ImageUploader } from './ImageUploader';
import { TimeSlotManager } from './TimeSlotManager';
import { TravelConnector } from './TravelConnector';
import { processManualScheduleImages } from '../services/ingestionService';
import { saveDailySchedule } from '../services/driveStorage';
import { calculateTotalRouteMileage, RouteResult } from '../services/routingService';
import { Job, useJobs } from '../context/JobContext';
import { toast } from 'sonner';

interface JobsCreatorProps {
    accessToken: string;
}

// Helper to get tomorrow's date in YYYY-MM-DD format
const getTomorrowDate = (): string => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
};

// Format date for display
const formatDateDisplay = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
};

export const JobsCreator: React.FC<JobsCreatorProps> = ({ accessToken }) => {
    // Get setLastSavedJobs and settings from context
    const { setLastSavedJobs, settings } = useJobs();

    // State
    const [manualFiles, setManualFiles] = useState<File[]>([]);
    const [processedJobs, setProcessedJobs] = useState<Job[]>([]);
    const [scheduleDate, setScheduleDate] = useState<string>(getTomorrowDate());
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<'idle' | 'processing' | 'ready' | 'saving' | 'saved' | 'error'>('idle');
    const [routeLegs, setRouteLegs] = useState<(RouteResult | null)[]>([]);
    const [calculatedMileage, setCalculatedMileage] = useState<number | undefined>(undefined);

    // Process uploaded images with Gemini AI
    const handleProcess = async () => {
        if (manualFiles.length === 0) return;

        setIsProcessing(true);
        setStatus('processing');

        try {
            // Convert files to base64
            const base64Images = await Promise.all(
                manualFiles.map(file => new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                }))
            );

            // Process with Gemini
            const result = await processManualScheduleImages(base64Images);

            // Enrich jobs with appliance images
            const enrichedJobs = await Promise.all(result.jobs.map(async (job) => {
                let imageUrl = null;
                // ROBUST QUERY LOGIC: Product Name > Model Number
                // Format: "Brand ProductType ModelNumber appliance -part -spare"
                // e.g. "HOOVER Washing Machine AHD 127V-80 appliance -part -spare"
                const productTerm = job.detectedProduct || "";
                const modelTerm = job.modelNumber || "";

                if (productTerm || modelTerm) {
                    const query = `${productTerm} ${modelTerm} appliance -part -spare -element -absorber -remote`.trim();
                    imageUrl = await imageService.searchProductImage(query);
                }
                return { ...job, applianceImageUrl: imageUrl || undefined };
            }));

            // Use extracted date or default to tomorrow
            const finalDate = result.date || getTomorrowDate();
            setScheduleDate(finalDate);
            setProcessedJobs(enrichedJobs);

            // Calculate route once
            await performRouteCalculation(enrichedJobs);

            setStatus('ready');

            toast.success(`Extracted ${result.jobs.length} jobs for ${formatDateDisplay(finalDate)}`);
        } catch (error) {
            console.error('Processing failed:', error);
            setStatus('error');
            toast.error('Failed to process screenshots. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRemoveImage = (index: number) => {
        const newJobs = [...processedJobs];
        newJobs[index].applianceImageUrl = undefined;
        setProcessedJobs(newJobs);
    };

    // Handle timeslot changes from TimeSlotManager
    const handleTimeSlotsChange = (newSlots: { start: string; end: string }[]) => {
        const updatedJobs = processedJobs.map((job, i) => ({
            ...job,
            timeSlot: `${newSlots[i].start} - ${newSlots[i].end}`
        }));
        setProcessedJobs(updatedJobs);
    };

    // Helper to calculate route exactly once
    const performRouteCalculation = async (jobs: Job[]) => {
        const homePostcode = settings?.homePostcode;
        if (jobs.length > 0 && homePostcode && homePostcode.length >= 3) {
            toast.loading('Calculating route mileage...', { id: 'mileage-calc' });
            const jobAddresses = jobs.map(j => j.address);
            const result = await calculateTotalRouteMileage(homePostcode, jobAddresses);

            if (result) {
                setCalculatedMileage(result.totalMiles);
                if (result.legs) {
                    setRouteLegs(result.legs);
                }
            }
            toast.dismiss('mileage-calc');
        } else {
            setCalculatedMileage(undefined);
            setRouteLegs([]);
        }
    };

    // Auto-calculate route REMOVED to prevent loops. 
    // Calculation is now triggered explicitly in handleProcess.

    // Save jobs to Google Drive
    const handleSave = async () => {
        if (processedJobs.length === 0) return;

        setIsSaving(true);
        setStatus('saving');

        try {
            // Get home postcode from settings
            const homePostcode = settings?.homePostcode || '';
            let totalMileage: number | undefined = undefined;

            // Calculate mileage if home postcode is set
            if (homePostcode && homePostcode.length >= 3) {
                if (calculatedMileage !== undefined) {
                    totalMileage = calculatedMileage;
                } else {
                    toast.loading('Calculating route mileage...', { id: 'mileage-calc' });
                    const jobAddresses = processedJobs.map(j => j.address);
                    const mileageResult = await calculateTotalRouteMileage(homePostcode, jobAddresses);
                    totalMileage = mileageResult?.totalMiles;
                    toast.dismiss('mileage-calc');
                }
            }

            // Save with mileage data
            const jobsToSave = processedJobs.map((job, index) => {
                const leg = routeLegs && routeLegs[index];
                return {
                    ...job,
                    travelTime: leg?.durationText || job.travelTime
                };
            });

            await saveDailySchedule(accessToken, scheduleDate, jobsToSave, {
                totalMileage,
                homePostcode: homePostcode || undefined
            });

            // Update context so Messages page can see the saved jobs
            setLastSavedJobs(processedJobs);

            setStatus('saved');
            const mileageMsg = totalMileage ? ` (${totalMileage}mi total)` : '';
            toast.success(`${processedJobs.length} jobs saved for ${formatDateDisplay(scheduleDate)}${mileageMsg}`);

            // Reset after short delay
            setTimeout(() => {
                handleReset();
            }, 2000);
        } catch (error: any) {
            console.error('Save failed:', error);
            setStatus('error');

            // Check for token expiration (401 error)
            const errorMessage = error?.message || '';
            if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
                toast.error('Session expired. Sign out and log in again.', {
                    duration: 10000,
                    description: 'Your Google authentication has timed out (~1 hour limit).',
                    action: {
                        label: 'Sign Out',
                        onClick: () => window.location.reload()
                    }
                });
            } else {
                toast.error('Failed to save jobs. Please try again.');
            }
        } finally {
            setIsSaving(false);
        }
    };

    // Reset to initial state
    const handleReset = () => {
        setManualFiles([]);
        setProcessedJobs([]);
        setScheduleDate(getTomorrowDate());
        setStatus('idle');
    };

    // Get timeSlots array for TimeSlotManager
    const timeSlots = processedJobs.map(j => {
        // Robust split handling both " - " and "-" and other variations
        const parts = j.timeSlot.split(/\s*-\s*|\s+to\s+/i);
        return { start: parts[0] || '08:00', end: parts[1] || '10:00' };
    });

    // Get addresses for TravelConnector
    const addresses = processedJobs.map(j => j.address);

    // Get job details for display
    const jobDetails = processedJobs.map(j => ({
        productType: j.detectedProduct || 'Unknown Appliance',
        fault: j.engineerNotes || j.faultDescription || 'No fault description'
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                        <Sparkles className="text-white" size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--color-secondary)]">Jobs Creator</h1>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            Creating schedule for {formatDateDisplay(scheduleDate)}
                        </p>
                    </div>
                </div>

                {/* Date Picker */}
                <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md border border-white/40 rounded-xl px-4 py-2 shadow-sm">
                    <Calendar size={18} className="text-[var(--color-primary)]" />
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-bold">
                            Target Date
                        </span>
                        <input
                            type="date"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            className="bg-transparent text-[var(--color-secondary)] font-semibold text-sm focus:outline-none cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <AnimatePresence mode="wait">
                {processedJobs.length === 0 ? (
                    /* Upload Section */
                    <motion.div
                        key="upload"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="card-glass p-8"
                    >
                        <div className="max-w-2xl mx-auto space-y-8">
                            {/* Upload Area */}
                            <ImageUploader onFilesSelected={setManualFiles} />

                            {/* Process Button */}
                            <div className="flex flex-col items-center gap-4">
                                <button
                                    onClick={handleProcess}
                                    disabled={manualFiles.length === 0 || isProcessing}
                                    className="px-8 py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 
                                               rounded-xl font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed 
                                               flex items-center gap-3 shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30
                                               hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {isProcessing ? (
                                        <>
                                            <RefreshCw className="animate-spin" size={20} />
                                            Analyzing with AI...
                                        </>
                                    ) : (
                                        <>
                                            <Camera size={20} />
                                            Process {manualFiles.length > 0 ? `${manualFiles.length} Screenshot${manualFiles.length > 1 ? 's' : ''}` : 'Screenshots'}
                                        </>
                                    )}
                                </button>

                                {manualFiles.length > 0 && !isProcessing && (
                                    <p className="text-sm text-[var(--color-text-muted)]">
                                        Ready to extract job data using Gemini AI
                                    </p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    /* Jobs Editor Section */
                    <motion.div
                        key="editor"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                    >
                        {/* Schedule Header */}
                        <div className="card-glass p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                    <Calendar className="text-emerald-500" size={24} />
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Target Date</label>
                                        <input
                                            type="date"
                                            value={scheduleDate}
                                            onChange={(e) => setScheduleDate(e.target.value)}
                                            className="bg-transparent text-[var(--color-secondary)] font-bold text-lg border-none focus:ring-0 p-0 cursor-pointer h-7"
                                        />
                                    </div>
                                    <p className="text-sm text-[var(--color-text-muted)]">
                                        {processedJobs.length} job{processedJobs.length > 1 ? 's' : ''} extracted • Review and adjust times below
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 w-full md:w-auto">
                                <button
                                    onClick={handleReset}
                                    className="flex-1 md:flex-none px-4 py-2.5 bg-white/60 hover:bg-white/80 border border-slate-200 
                                               rounded-xl font-semibold text-slate-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={16} />
                                    Start Over
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || status === 'saved'}
                                    className="flex-1 md:flex-none px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 
                                               hover:from-emerald-500 hover:to-teal-500 rounded-xl font-bold text-white 
                                               transition-all disabled:opacity-50 flex items-center justify-center gap-2
                                               shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {isSaving ? (
                                        <>
                                            <RefreshCw className="animate-spin" size={16} />
                                            Saving...
                                        </>
                                    ) : status === 'saved' ? (
                                        <>
                                            <CheckCircle size={16} />
                                            Saved!
                                        </>
                                    ) : (
                                        <>
                                            <Save size={16} />
                                            Save Jobs
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Jobs List with Timeslots and ETA */}
                        <div className="card-glass p-6 md:p-8">
                            <div className="space-y-0">
                                {/* Home -> First Job Connector */}
                                {settings?.homePostcode && processedJobs.length > 0 && (
                                    <div className="pl-8 relative z-0 py-2">
                                        <TravelConnector
                                            origin={settings.homePostcode}
                                            destination={processedJobs[0].address}
                                            routeResult={routeLegs[0]}
                                            index={-1}
                                        />
                                    </div>
                                )}
                                {processedJobs.map((job, index) => (
                                    <div key={job.id} className="relative">
                                        {/* Job Card */}
                                        <div className="relative z-10 group">
                                            <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 to-purple-600/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                            <div className="relative bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl p-6 
                                                            hover:border-violet-500/30 transition-all duration-300 shadow-sm hover:shadow-lg
                                                            flex flex-col lg:flex-row lg:items-center gap-6">

                                                {/* Job Badge */}
                                                <div className="flex-shrink-0 relative group/badge">
                                                    {job.applianceImageUrl ? (
                                                        <>
                                                            <div className="w-16 h-16 rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white relative group/image">
                                                                <img
                                                                    src={job.applianceImageUrl}
                                                                    alt={job.detectedProduct}
                                                                    className="w-full h-full object-contain p-1"
                                                                />
                                                                {/* Remove Image Button */}
                                                                <button
                                                                    onClick={() => handleRemoveImage(index)}
                                                                    className="absolute top-0.5 right-0.5 bg-black/50 hover:bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/image:opacity-100 transition-all transform scale-90 hover:scale-100 z-10"
                                                                    title="Remove incorrect image"
                                                                >
                                                                    <X size={10} />
                                                                </button>
                                                            </div>
                                                            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-violet-600 border-2 border-white flex items-center justify-center shadow-sm pointer-events-none">
                                                                <span className="text-[10px] font-bold text-white">{index + 1}</span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 
                                                                        border border-slate-200 flex flex-col items-center justify-center shadow-inner">
                                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">JOB</span>
                                                            <span className="text-2xl font-black text-[var(--color-secondary)]">{index + 1}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Customer & Location */}
                                                <div className="flex-1 min-w-0 space-y-3">
                                                    <div>
                                                        <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-bold">Customer</span>
                                                        <h4 className="text-lg font-bold text-[var(--color-secondary)] truncate">{job.customerName}</h4>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-bold">Address</span>
                                                        <p className="text-sm text-[var(--color-text-main)] line-clamp-2">{job.address}</p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-4">
                                                        <div>
                                                            <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-bold">Product</span>
                                                            <p className="text-sm font-semibold text-violet-600">{job.detectedProduct || 'Unknown'}</p>
                                                        </div>
                                                        <div className="flex-1 min-w-[200px]">
                                                            <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-bold">Fault</span>
                                                            <p className="text-sm text-[var(--color-text-main)] line-clamp-1">{job.engineerNotes || 'No details'}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Time Controls */}
                                                <div className="flex-shrink-0 w-full lg:w-auto grid grid-cols-2 gap-4 border-t lg:border-t-0 lg:border-l border-slate-200/50 pt-4 lg:pt-0 lg:pl-6">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-bold ml-1">Start Time</label>
                                                        <select
                                                            value={timeSlots[index]?.start || '08:00'}
                                                            onChange={(e) => {
                                                                const newSlots = [...timeSlots];
                                                                const [newH, newM] = e.target.value.split(':').map(Number);
                                                                // Always set end time to 2 hours after start time
                                                                const newEndMins = newH * 60 + newM + 120;
                                                                const newEnd = `${String(Math.floor(newEndMins / 60)).padStart(2, '0')}:${String(newEndMins % 60).padStart(2, '0')}`;

                                                                newSlots[index] = { start: e.target.value, end: newEnd };
                                                                handleTimeSlotsChange(newSlots);
                                                            }}
                                                            className="w-full bg-white/80 border border-slate-200 rounded-xl px-4 py-3 
                                                                       text-[var(--color-secondary)] font-mono text-lg font-semibold
                                                                       focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 
                                                                       outline-none transition-all hover:bg-white min-w-[120px] cursor-pointer"
                                                        >
                                                            {/* Ensure current value is in options if it's irregular (e.g. 08:55 from AI) */}
                                                            {(() => {
                                                                const currentStart = timeSlots[index]?.start || '08:00';
                                                                const standardOptions = Array.from({ length: 29 }, (_, i) => {
                                                                    const mins = 450 + i * 30; // 07:30 to 22:00
                                                                    const h = Math.floor(mins / 60);
                                                                    const m = mins % 60;
                                                                    const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                                                    return val;
                                                                });

                                                                // Add current value if not present
                                                                const allOptions = standardOptions.includes(currentStart)
                                                                    ? standardOptions
                                                                    : [currentStart, ...standardOptions].sort();

                                                                return allOptions.map(val => (
                                                                    <option key={val} value={val}>{val}</option>
                                                                ));
                                                            })()}
                                                        </select>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-bold ml-1">End Time</label>
                                                        <select
                                                            value={timeSlots[index]?.end || '10:00'}
                                                            onChange={(e) => {
                                                                const newSlots = [...timeSlots];
                                                                newSlots[index] = { ...newSlots[index], end: e.target.value };
                                                                handleTimeSlotsChange(newSlots);
                                                            }}
                                                            className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-4 py-3 
                                                                       text-slate-500 font-mono text-lg font-semibold
                                                                       focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 
                                                                       outline-none transition-all hover:bg-white min-w-[120px] cursor-pointer"
                                                        >
                                                            {/* Ensure current value is in options if it's irregular */}
                                                            {(() => {
                                                                const currentEnd = timeSlots[index]?.end || '10:00';
                                                                const standardOptions = Array.from({ length: 29 }, (_, i) => {
                                                                    const mins = 450 + i * 30;
                                                                    const h = Math.floor(mins / 60);
                                                                    const m = mins % 60;
                                                                    const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                                                    return val;
                                                                });

                                                                const allOptions = standardOptions.includes(currentEnd)
                                                                    ? standardOptions
                                                                    : [currentEnd, ...standardOptions].sort();

                                                                return allOptions.map(val => (
                                                                    <option key={val} value={val}>{val}</option>
                                                                ));
                                                            })()}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Travel Connector / ETA */}
                                        {index < processedJobs.length - 1 && (
                                            <div className="pl-8 relative z-0 py-2">
                                                <TravelConnector
                                                    origin={addresses[index]}
                                                    destination={addresses[index + 1]}
                                                    index={index}
                                                    routeResult={routeLegs[index + 1]}
                                                />
                                            </div>
                                        )}
                                        {/* Last Job -> Home Connector */}
                                        {index === processedJobs.length - 1 && settings?.homePostcode && (
                                            <div className="pl-8 relative z-0 py-2">
                                                <TravelConnector
                                                    origin={addresses[index]}
                                                    destination={settings.homePostcode}
                                                    index={index + 1} // Stagger index
                                                    routeResult={routeLegs[index + 1]}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Status Indicator */}
            {status === 'error' && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl"
                >
                    <AlertCircle className="text-red-500" size={20} />
                    <p className="text-sm text-red-700 font-medium">
                        Something went wrong. Please try again.
                    </p>
                </motion.div>
            )}
        </div>
    );
};
