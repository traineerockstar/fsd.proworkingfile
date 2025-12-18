
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, RefreshCw, Calendar, Clock, ArrowRight, Save, Image as ImageIcon } from 'lucide-react';
import { scanInputFolder, processScheduleImages, calculateGaps, processManualScheduleImages } from '../services/ingestionService';
import { exportToGoogleSheets } from '../services/sheetExportService';
import { Job, useJobs } from '../context/JobContext';
import { saveJobToDrive } from '../services/googleDriveService';
import { ImageUploader } from './ImageUploader';
import { TimeSlotManager } from './TimeSlotManager';

interface IngestManagerProps {
    accessToken: string;
    onClose: () => void;
}

export const IngestManager: React.FC<IngestManagerProps> = ({ accessToken, onClose }) => {
    const [files, setFiles] = useState<any[]>([]); // Drive files
    const [manualFiles, setManualFiles] = useState<File[]>([]); // Manual files
    const [mode, setMode] = useState<'drive' | 'manual'>('drive');
    const [scannedJobs, setScannedJobs] = useState<Job[]>([]);
    const [scheduleDate, setScheduleDate] = useState<string>(''); // New State
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('Idle');
    const { updateJob } = useJobs();

    useEffect(() => {
        loadFiles();
    }, [accessToken]);

    const loadFiles = async () => {
        setIsLoading(true);
        try {
            const f = await scanInputFolder(accessToken);
            setFiles(f);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleProcess = async () => {
        setIsLoading(true);
        setStatus('Analyzing Screenshots with Gemini...');
        try {
            let result: { jobs: Job[], date: string } = { jobs: [], date: '' };

            if (mode === 'drive') {
                if (files.length === 0) return;
                const fileIds = files.map(f => f.id);
                result = await processScheduleImages(accessToken, fileIds);
            } else {
                if (manualFiles.length === 0) return;
                const base64Images = await Promise.all(
                    manualFiles.map(file => new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve((reader.result as string).split(',')[1]);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    }))
                );
                result = await processManualScheduleImages(base64Images);
            }

            setScannedJobs(result.jobs);
            setScheduleDate(result.date);
            setStatus(`Review Schedule (${result.date})`);
        } catch (e) {
            console.error(e);
            setStatus('Error Processing');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSheetExport = async () => {
        const SCRIPT_URL = "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE";
        if (SCRIPT_URL === "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE") {
            alert("Please configure your Google Apps Script URL in components/IngestManager.tsx");
            return;
        }

        setIsLoading(true);
        setStatus('Syncing to Sheets...');
        try {
            await exportToGoogleSheets(scannedJobs, SCRIPT_URL);
            setStatus('Export Sent!');
        } catch (e) {
            setStatus('Export Failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = async () => {
        setIsLoading(true);
        setStatus('Saving to Drive (Filing Cabinet)...');
        try {
            // New Filing Cabinet Save
            const dateToSave = scheduleDate || new Date().toISOString().split('T')[0];
            await import('../services/driveStorage').then(m => m.saveDailySchedule(accessToken, dateToSave, scannedJobs));

            setStatus('Success!');
            // Also update context if needed?
            // scannedJobs.forEach(updateJob); 

            setTimeout(onClose, 1000);
        } catch (e) {
            console.error(e);
            setStatus('Save Failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTimeSlotsChange = (newSlots: { start: string, end: string }[]) => {
        const updatedJobs = scannedJobs.map((job, i) => ({
            ...job,
            timeSlot: `${newSlots[i].start} - ${newSlots[i].end}`
        }));
        setScannedJobs(updatedJobs);
    };

    const gaps = calculateGaps(scannedJobs);

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-4xl bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-white/10 bg-black/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                            <Calendar size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white">Smart Scheduler</h2>
                            <p className="text-sm text-slate-400">Ingest Screenshots & Auto-Route</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">Close</button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-8">

                    {scannedJobs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-6">
                            <div className="bg-white/5 border-2 border-dashed border-white/10 rounded-3xl p-12 text-center w-full max-w-lg relative">
                                {/* Mode Toggle */}
                                <div className="absolute top-4 right-4 flex bg-black/40 rounded-lg p-1">
                                    <button
                                        onClick={() => setMode('drive')}
                                        className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${mode === 'drive' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        Drive
                                    </button>
                                    <button
                                        onClick={() => setMode('manual')}
                                        className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${mode === 'manual' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        Upload
                                    </button>
                                </div>

                                {mode === 'drive' ? (
                                    <>
                                        <div className="mx-auto w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mb-4">
                                            <Camera size={32} />
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-2">Drive Input Source</h3>
                                        <p className="text-slate-400 text-sm mb-6">
                                            Found <strong>{files.length}</strong> screenshots in Drive (INPUT_SCREENSHOTS).
                                        </p>
                                    </>
                                ) : (
                                    <div className="mb-6">
                                        <h3 className="text-lg font-bold text-white mb-4">Manual Upload</h3>
                                        <div className="bg-black/20 p-2 rounded-xl">
                                            <ImageUploader onFilesSelected={setManualFiles} />
                                        </div>
                                        <p className="text-slate-400 text-sm mt-4">
                                            Selected <strong>{manualFiles.length}</strong> images.
                                        </p>
                                    </div>
                                )}

                                <button
                                    onClick={handleProcess}
                                    disabled={(mode === 'drive' ? files.length === 0 : manualFiles.length === 0) || isLoading}
                                    className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                                >
                                    {isLoading ? <RefreshCw className="animate-spin" /> : <ArrowRight />}
                                    {isLoading ? status : 'Process & Generate Schedule'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-white">Proposed Schedule</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSheetExport}
                                        disabled={isLoading}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold text-white text-sm flex items-center gap-2"
                                    >
                                        <Save size={16} /> {/* Re-using Save icon for generic 'Export' feel or add Sheet icon */}
                                        To Sheets
                                    </button>
                                    <button
                                        onClick={handleConfirm}
                                        disabled={isLoading}
                                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold text-white flex items-center gap-2"
                                    >
                                        <Save size={18} />
                                        {isLoading ? 'Saving...' : 'Confirm & Sync'}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <TimeSlotManager
                                    jobCount={scannedJobs.length}
                                    timeSlots={scannedJobs.map(j => {
                                        const parts = j.timeSlot.split(' - ');
                                        return { start: parts[0] || '00:00', end: parts[1] || '00:00' };
                                    })}
                                    onTimeSlotsChange={handleTimeSlotsChange}
                                    addresses={scannedJobs.map(j => j.address)}
                                    jobDetails={scannedJobs.map(j => ({ productType: j.detectedProduct || 'Unknown', fault: j.engineerNotes || '' }))}
                                />
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
