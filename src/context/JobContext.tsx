import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Re-using the Job interface from JobCard, but moving it here ideally.
// For now, defining it here to avoid circular deps if we refactor later.
export interface Job {
    id: string;
    customerName: string;
    address: string;
    timeSlot: string;
    status: 'pending' | 'in-progress' | 'completed' | 'issue';
    priority: 'normal' | 'high';
    travelTime?: string;
    modelNumber?: string;
    serialNumber?: string;
    engineerNotes?: string;
    // Add fields for analysis results
    detectedProduct?: string;
    partsUsed?: string[];
    aiSummary?: string; // AI generated summary of the job/fault
}

// Initial Mock Data (used only if local storage is empty)
const INITIAL_JOBS: Job[] = [
    { id: '1', customerName: 'Apex Industries', address: '128 Tech Park, Sector 4', timeSlot: '08:00 - 10:00', status: 'in-progress', priority: 'high', travelTime: '12 mins' },
    { id: '2', customerName: 'Starlight Café', address: '45 Neon Ave, Downtown', timeSlot: '10:30 - 12:00', status: 'pending', priority: 'normal', travelTime: '35 mins' },
    { id: '3', customerName: 'Quantum Labs', address: '88 Science Way, North District', timeSlot: '13:00 - 15:00', status: 'pending', priority: 'normal', travelTime: '45 mins', modelNumber: 'H7-WASH-200', serialNumber: 'SN-998877' },
    { id: '4', customerName: 'Residential Unit 404', address: 'Crimson Tower, Apt 404', timeSlot: '15:30 - 16:30', status: 'issue', priority: 'high', travelTime: '1 hr' },
    { id: '5', customerName: 'Metro Hub', address: 'Central Station Main Hall', timeSlot: '17:00 - 18:00', status: 'completed', priority: 'normal', travelTime: '5 mins' },
];

export interface AppSettings {
    defaultModel: string;
    autoIngest: boolean;
    driveFolderId?: string;
    apiKey?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
    defaultModel: 'gemini-2.5-flash',
    autoIngest: false,
};

interface JobContextType {
    jobs: Job[];
    settings: AppSettings;
    updateJob: (id: string, updates: Partial<Job>) => void;
    getJob: (id: string) => Job | undefined;
    resetJobs: () => void;
    updateSettings: (newSettings: Partial<AppSettings>) => void;
    resetSettings: () => void;
    accessToken: string | null;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

import { saveJobToDrive, listJobsFromDrive } from '../services/googleDriveService';

export const JobProvider: React.FC<{ children: ReactNode; accessToken: string | null }> = ({ children, accessToken }) => {
    const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);
    const [settings, setSettings] = useState<AppSettings>(() => {
        const saved = localStorage.getItem('appSettings');
        return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    });
    const [isLoading, setIsLoading] = useState(false);

    // Initial Load
    useEffect(() => {
        const loadDocs = async () => {
            if (accessToken) {
                setIsLoading(true);
                try {
                    const driveJobs = await listJobsFromDrive(accessToken);
                    if (driveJobs.length > 0) {
                        setJobs(driveJobs);
                    } else {
                        // First time? Maybe seed it or keep generic mock
                        // For now, let's just stick with initialized state or empty
                        // setJobs([]); 
                        // Actually, if we want to migrate MOCK data to Drive, we could loop and save here.
                        // But let's just load what's there.
                    }
                } catch (err) {
                    console.error("Failed to load jobs from Drive", err);
                } finally {
                    setIsLoading(false);
                }
            }
        };
        loadDocs();
    }, [accessToken]);

    const updateJob = (id: string, updates: Partial<Job>) => {
        setJobs(prev => prev.map(job => {
            if (job.id === id) {
                const updatedJob = { ...job, ...updates };
                // Sync to Drive
                if (accessToken) {
                    saveJobToDrive(accessToken, updatedJob);
                }
                return updatedJob;
            }
            return job;
        }));
    };

    const getJob = (id: string) => jobs.find(j => j.id === id);

    const resetJobs = () => {
        setJobs(INITIAL_JOBS);
    };

    const updateSettings = (newSettings: Partial<AppSettings>) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings };
            localStorage.setItem('appSettings', JSON.stringify(updated));
            return updated;
        });
    };

    const resetSettings = () => {
        setSettings(DEFAULT_SETTINGS);
        localStorage.removeItem('appSettings');
    };

    return (
        <JobContext.Provider value={{ jobs, settings, updateJob, getJob, resetJobs, updateSettings, resetSettings, accessToken }}>
            {children}
        </JobContext.Provider>
    );
};

export const useJobs = () => {
    const context = useContext(JobContext);
    if (context === undefined) {
        throw new Error('useJobs must be used within a JobProvider');
    }
    return context;
};

export const useJobContext = useJobs;
