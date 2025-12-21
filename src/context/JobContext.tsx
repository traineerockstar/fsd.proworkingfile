import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';

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
    driveFileId?: string; // Google Drive File ID for direct updates
    faultDescription?: string; // Description of the reported fault
    applianceImageUrl?: string; // URL of the appliance image
}

export interface UserProfile {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    locale: string;
}

// No mock data - start with empty jobs, real jobs come from Drive or Jobs Creator
const INITIAL_JOBS: Job[] = [];

export interface AppSettings {
    defaultModel: string;
    autoIngest: boolean;
    driveFolderId?: string;
    apiKey?: string;
    homePostcode?: string; // Home postcode for mileage calculation
}

const DEFAULT_SETTINGS: AppSettings = {
    defaultModel: 'gemini-2.5-flash',
    autoIngest: false,
    homePostcode: '',
};

interface JobContextType {
    jobs: Job[];
    lastSavedJobs: Job[]; // Jobs from the latest Jobs Creator save
    todaysMileage: number | null; // Pre-calculated mileage from saved schedule
    settings: AppSettings;
    updateJob: (id: string, updates: Partial<Job>) => void;
    setJobs: (jobs: Job[]) => void;
    setLastSavedJobs: (jobs: Job[]) => void; // Set jobs from Jobs Creator save
    getJob: (id: string) => Job | undefined;
    resetJobs: () => void;
    updateSettings: (newSettings: Partial<AppSettings>) => void;
    resetSettings: () => void;
    isLoading: boolean;
    accessToken: string | null;
    pendingUploads: number;
    userProfile: UserProfile | null;
    reloadTodaysJobs: () => Promise<void>; // Function to reload today's jobs
}

const JobContext = createContext<JobContextType | undefined>(undefined);

import { saveJobToDrive, listJobsFromDrive } from '../services/googleDriveService';
import { loadTodaysSchedule } from '../services/driveStorage';
import { getLearnedSolutions } from '../services/learningService';
import { syncQueue } from '../services/syncQueueService';

export const JobProvider: React.FC<{ children: ReactNode; accessToken: string | null }> = ({ children, accessToken }) => {
    const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);
    const [lastSavedJobs, setLastSavedJobs] = useState<Job[]>([]); // Jobs from latest Jobs Creator save
    const [todaysMileage, setTodaysMileage] = useState<number | null>(null); // Pre-calculated mileage
    const [settings, setSettings] = useState<AppSettings>(() => {
        const saved = localStorage.getItem('appSettings');
        return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    });
    const [isLoading, setIsLoading] = useState(false);
    const [pendingUploads, setPendingUploads] = useState(0);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    // Function to reload today's jobs from Drive
    const reloadTodaysJobs = async () => {
        if (!accessToken) return;

        try {
            const todaysSchedule = await loadTodaysSchedule(accessToken);
            if (todaysSchedule && todaysSchedule.jobs) {
                setJobs(todaysSchedule.jobs);
                setTodaysMileage(todaysSchedule.total_mileage || null);
                console.log(`[JobContext] Loaded ${todaysSchedule.jobs.length} jobs for today, mileage: ${todaysSchedule.total_mileage || 'N/A'}mi`);
            } else {
                setJobs([]);
                setTodaysMileage(null);
                console.log('[JobContext] No schedule found for today');
            }
        } catch (err) {
            console.error('[JobContext] Failed to reload today\'s jobs:', err);
        }
    };

    // Initial Load
    useEffect(() => {
        const loadDocs = async () => {
            if (accessToken) {
                setIsLoading(true);
                try {
                    // MOCK FOR SCREENSHOT
                    if (accessToken === "mock_token_for_screenshot") {
                        setUserProfile({
                            id: 'mock-id',
                            email: 'alex.walker@fsd.pro',
                            verified_email: true,
                            name: 'Alex Walker',
                            given_name: 'Alex',
                            family_name: 'Walker',
                            picture: '',
                            locale: 'en'
                        });
                        setJobs(INITIAL_JOBS); // Load initial jobs
                        setIsLoading(false);
                        return;
                    }

                    // Fetch User Profile
                    const profileRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    });
                    if (profileRes.ok) {
                        const profileData = await profileRes.json();
                        setUserProfile(profileData);
                    }

                    // Load TODAY's schedule (date-based) + hydrate learnings cache
                    const [todaysSchedule] = await Promise.all([
                        loadTodaysSchedule(accessToken),
                        getLearnedSolutions(accessToken) // Hydrates the cache
                    ]);

                    if (todaysSchedule && todaysSchedule.jobs && todaysSchedule.jobs.length > 0) {
                        setJobs(todaysSchedule.jobs);
                        setTodaysMileage(todaysSchedule.total_mileage || null);
                        console.log(`[JobContext] Loaded today's schedule: ${todaysSchedule.jobs.length} jobs, ${todaysSchedule.total_mileage || 'N/A'}mi`);
                    } else {
                        setJobs([]);
                        setTodaysMileage(null);
                        console.log('[JobContext] No schedule for today');
                    }
                } catch (err) {
                    console.error("Failed to load data from Drive", err);
                } finally {
                    setIsLoading(false);
                }
            }
        };
        loadDocs();

        // Subscribe to Sync Queue updates
        syncQueue.setListener((count) => {
            setPendingUploads(count);
        });

    }, [accessToken]);

    // Safety implementation: Warn before closing if uploads pending
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (pendingUploads > 0) {
                e.preventDefault();
                e.returnValue = ''; // Trigger browser warning
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [pendingUploads]);


    const updateJob = async (id: string, updates: Partial<Job>) => {
        setJobs(prev => prev.map(job => {
            if (job.id === id) {
                const updatedJob = { ...job, ...updates };
                // Sync to Drive (Async side effect)
                if (accessToken) {
                    const savePromise = saveJobToDrive(accessToken, updatedJob);

                    toast.promise(savePromise, {
                        loading: 'Syncing to Drive...',
                        success: (fileId) => {
                            if (fileId && fileId !== job.driveFileId) {
                                setJobs(current => current.map(j =>
                                    j.id === id ? { ...j, driveFileId: fileId } : j
                                ));
                            }
                            return 'Saved to Drive';
                        },
                        error: (err) => {
                            // Revert optimistic update
                            setJobs(current => current.map(j =>
                                j.id === id ? job : j
                            ));
                            return 'Failed to save to Drive. Changes reverted.';
                        }
                    });
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
        <JobContext.Provider value={{ jobs, lastSavedJobs, todaysMileage, settings, updateJob, setJobs, setLastSavedJobs, getJob, resetJobs, updateSettings, resetSettings, accessToken, isLoading, pendingUploads, userProfile, reloadTodaysJobs }}>
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

// Aliasing for compatibility if other components use this name
export const useJobContext = useJobs;
