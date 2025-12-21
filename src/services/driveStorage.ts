import { findOrCreateFolder, findSubfolder, saveJobToDrive } from './googleDriveService';
import { Job } from '../context/JobContext';
import { DRIVE_FOLDERS, DRIVE_FILES } from './driveConfig';

const APP_FOLDER_NAME = DRIVE_FOLDERS.ROOT;

// --- GENERIC HELPERS (The "Brain" Access Layer) ---

export const searchFiles = async (accessToken: string, query: string): Promise<any[]> => {
    try {
        // Include modifiedTime in fields and order by newest first
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webviewLink,parents,modifiedTime)&orderBy=modifiedTime desc`;
        const resp = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });

        if (!resp.ok) {
            const errorText = await resp.text();
            console.error(`[DriveSearch] ${resp.status} Error - Query: ${query}`, errorText);
            return [];
        }

        const data = await resp.json();
        return data.files || [];
    } catch (e) {
        console.error("Drive Search Error:", e);
        return [];
    }
};

export const readJsonFile = async (accessToken: string, fileId: string): Promise<any | null> => {
    try {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
        return await resp.json();
    } catch (e) {
        console.error(`Error reading JSON file ${fileId}:`, e);
        return null;
    }
};

export const writeJsonFile = async (accessToken: string, folderId: string, fileName: string, data: any): Promise<string | null> => {
    return await saveFileToFolder(accessToken, folderId, fileName, data);
};

// --- LEGACY / SPECIFIC HELPERS ---

export interface ScheduleData {
    date: string;
    total_jobs: number;
    total_mileage?: number;
    home_postcode?: string;
    jobs: Job[];
}

export interface SaveScheduleOptions {
    totalMileage?: number;
    homePostcode?: string;
}

export const saveDailySchedule = async (
    accessToken: string,
    dateStr: string,
    jobs: Job[],
    options?: SaveScheduleOptions
) => {
    try {
        // 1. Get or create root folder
        const rootId = await findOrCreateFolder(accessToken);

        // 2. Get or create SCHEDULES subfolder
        const schedulesFolderId = await findSubfolder(accessToken, rootId, DRIVE_FOLDERS.SCHEDULES);

        // 3. Save schedule as YYYY-MM-DD.json (overwrites if exists)
        const scheduleData: ScheduleData = {
            date: dateStr,
            total_jobs: jobs.length,
            total_mileage: options?.totalMileage,
            home_postcode: options?.homePostcode,
            jobs: jobs
        };
        const fileName = `${dateStr}.json`;
        await saveFileToFolder(accessToken, schedulesFolderId, fileName, scheduleData);

        // 4. Update calendar.json with this date's summary
        await updateCalendarEntry(accessToken, rootId, dateStr, {
            jobCount: jobs.length,
            mileage: options?.totalMileage
        });

        console.log(`[DriveStorage] Saved ${fileName} to SCHEDULES (${jobs.length} jobs, ${options?.totalMileage || 'N/A'}mi)`);

    } catch (error) {
        console.error("[DriveStorage] Failed to save daily schedule:", error);
        throw error;
    }
};

// Calendar.json structure
export interface CalendarIndex {
    lastUpdated: string;
    dates: {
        [dateStr: string]: {
            jobCount: number;
            mileage?: number;
        };
    };
}

// Update calendar.json with a new/updated date entry
const updateCalendarEntry = async (
    accessToken: string,
    rootId: string,
    dateStr: string,
    entry: { jobCount: number; mileage?: number }
) => {
    try {
        // 1. Try to load existing calendar.json
        const calendarQuery = `name='${DRIVE_FILES.CALENDAR}' and '${rootId}' in parents and trashed=false`;
        const calendarFiles = await searchFiles(accessToken, calendarQuery);

        let calendar: CalendarIndex;

        if (calendarFiles && calendarFiles.length > 0) {
            // Read existing calendar
            const existingCalendar = await readJsonFile(accessToken, calendarFiles[0].id);
            calendar = existingCalendar || { lastUpdated: '', dates: {} };
        } else {
            // Create new calendar
            calendar = { lastUpdated: '', dates: {} };
        }

        // 2. Update the entry for this date
        calendar.dates[dateStr] = entry;
        calendar.lastUpdated = new Date().toISOString();

        // 3. Save calendar.json
        await saveFileToFolder(accessToken, rootId, DRIVE_FILES.CALENDAR, calendar);
        console.log(`[DriveStorage] Updated calendar.json (${Object.keys(calendar.dates).length} dates)`);

    } catch (error) {
        console.error("[DriveStorage] Failed to update calendar:", error);
        // Don't throw - calendar update is secondary, schedule save is primary
    }
};

// Get calendar.json for quick calendar display
export const getCalendar = async (accessToken: string): Promise<CalendarIndex | null> => {
    try {
        const rootId = await findOrCreateFolder(accessToken);

        // Direct API call to find calendar.json
        const calendarQuery = `name='${DRIVE_FILES.CALENDAR}' and '${rootId}' in parents and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(calendarQuery)}&fields=files(id,name)`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });

        if (!resp.ok) {
            console.log('[DriveStorage] Failed to search for calendar.json');
            return null;
        }

        const data = await resp.json();
        if (data.files && data.files.length > 0) {
            const calendar = await readJsonFile(accessToken, data.files[0].id);
            console.log(`[DriveStorage] Loaded calendar.json (${Object.keys(calendar?.dates || {}).length} dates)`);
            return calendar as CalendarIndex;
        }

        console.log('[DriveStorage] No calendar.json found');
        return null;
    } catch (error) {
        console.error("[DriveStorage] Failed to load calendar:", error);
        return null;
    }
};

// Load schedule for a specific date (e.g., today)
export const loadScheduleByDate = async (accessToken: string, dateStr: string): Promise<ScheduleData | null> => {
    try {
        // 1. Find root folder
        const rootId = await findOrCreateFolder(accessToken);

        // 2. Find SCHEDULES subfolder (use findSubfolder like save does - don't create if not exists)
        let schedulesFolderId: string;
        try {
            // Search for existing SCHEDULES folder without creating
            const query = `name='${DRIVE_FOLDERS.SCHEDULES}' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
            const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });

            if (!resp.ok) {
                console.log('[DriveStorage] Failed to search for SCHEDULES folder');
                return null;
            }

            const data = await resp.json();
            if (!data.files || data.files.length === 0) {
                console.log('[DriveStorage] No SCHEDULES folder found');
                return null;
            }
            schedulesFolderId = data.files[0].id;
        } catch (e) {
            console.log('[DriveStorage] SCHEDULES folder not found');
            return null;
        }

        // 3. Find YYYY-MM-DD.json file
        const fileName = `${dateStr}.json`;
        const fileQuery = `name='${fileName}' and '${schedulesFolderId}' in parents and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(fileQuery)}&fields=files(id,name)`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });

        if (!resp.ok) {
            console.log(`[DriveStorage] Failed to search for ${fileName}`);
            return null;
        }

        const data = await resp.json();
        if (!data.files || data.files.length === 0) {
            console.log(`[DriveStorage] No schedule file found for ${dateStr}`);
            return null;
        }

        // 4. Read and return the schedule
        const scheduleData = await readJsonFile(accessToken, data.files[0].id);
        console.log(`[DriveStorage] Loaded ${fileName}: ${scheduleData?.jobs?.length || 0} jobs`);

        return scheduleData as ScheduleData;

    } catch (error) {
        console.error(`[DriveStorage] Failed to load schedule for ${dateStr}:`, error);
        return null;
    }
};

// Helper to get today's date in YYYY-MM-DD format
export const getTodayDateString = (): string => {
    const today = new Date();
    return today.toISOString().split('T')[0];
};

// Load today's schedule
export const loadTodaysSchedule = async (accessToken: string): Promise<ScheduleData | null> => {
    const today = getTodayDateString();
    console.log(`[DriveStorage] Loading schedule for today: ${today}`);
    return await loadScheduleByDate(accessToken, today);
};

// Helper to Create/Update file (Generic)
const saveFileToFolder = async (accessToken: string, folderId: string, fileName: string, data: any): Promise<string | null> => {
    try {
        // Check if exists
        const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
        const files = await searchFiles(accessToken, query);

        const fileContent = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });

        if (files && files.length > 0) {
            // UPDATE existing file - don't include metadata with parents
            const fileId = files[0].id;
            const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;

            const updateResp = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data, null, 2)
            });

            if (!updateResp.ok) {
                const errText = await updateResp.text();
                console.error(`Update failed: ${updateResp.status}`, errText);
                throw new Error(`Failed to update file: ${updateResp.status}`);
            }

            console.log(`[DriveStorage] Updated ${fileName}`);
            return fileId;
        } else {
            // CREATE new file - include parents in metadata
            const metadata = { name: fileName, parents: [folderId] };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', fileContent);

            const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
            const resp = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` },
                body: form
            });

            if (!resp.ok) {
                const errText = await resp.text();
                console.error(`Create failed: ${resp.status}`, errText);
                throw new Error(`Failed to create file: ${resp.status}`);
            }

            const created = await resp.json();
            console.log(`[DriveStorage] Created ${fileName}`);
            return created.id;
        }
    } catch (e) {
        console.error("SaveFile Error:", e);
        throw e; // Re-throw to propagate error properly
    }
};

// --- FILE MANAGEMENT FOR INTEGRATIONS PAGE ---

export interface AppFileItem {
    id: string;
    name: string;
    mimeType: string;
    type: 'folder' | 'file';
    webViewLink?: string;
    modifiedTime?: string;
    size?: string;
    children?: AppFileItem[];
}

// Helper to recursively fetch folder contents
const fetchFolderContentsRecursive = async (
    accessToken: string,
    folderId: string,
    depth: number = 0,
    maxDepth: number = 5
): Promise<AppFileItem[]> => {
    if (depth > maxDepth) return []; // Prevent infinite recursion

    const query = `'${folderId}' in parents and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink,modifiedTime,size)&pageSize=100`;

    try {
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (!resp.ok) return [];

        const data = await resp.json();
        const items: AppFileItem[] = (data.files || []).map((f: any) => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            type: f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
            webViewLink: f.webViewLink,
            modifiedTime: f.modifiedTime,
            size: f.size,
            children: []
        }));

        // Recursively fetch children for folders
        for (const item of items) {
            if (item.type === 'folder') {
                item.children = await fetchFolderContentsRecursive(accessToken, item.id, depth + 1, maxDepth);
            }
        }

        return items;
    } catch (error) {
        console.error(`[DriveStorage] Error fetching folder ${folderId}:`, error);
        return [];
    }
};

// List all files and folders created by the app in FSD_PRO_DATA (DEEP RECURSIVE)
export const listAppFiles = async (accessToken: string): Promise<{ rootId: string; files: AppFileItem[] }> => {
    try {
        // Use the PROVEN working method from googleDriveService
        const rootId = await findOrCreateFolder(accessToken);
        console.log('[DriveStorage] Using findOrCreateFolder, got rootId:', rootId);

        if (!rootId) {
            console.log('[DriveStorage] Could not get FSD_PRO_DATA folder');
            return { rootId: '', files: [] };
        }

        // Deep recursive fetch of ALL files and folders
        console.log('[DriveStorage] Starting deep recursive file discovery...');
        const files = await fetchFolderContentsRecursive(accessToken, rootId, 0, 5);

        // Count total items including nested
        const countItems = (items: AppFileItem[]): number => {
            return items.reduce((acc, item) => {
                return acc + 1 + (item.children ? countItems(item.children) : 0);
            }, 0);
        };

        const totalCount = countItems(files);
        console.log(`[DriveStorage] Deep scan complete: ${files.length} top-level items, ${totalCount} total items`);

        return { rootId, files };

    } catch (error) {
        console.error('[DriveStorage] Failed to list app files:', error);
        return { rootId: '', files: [] };
    }
};

// Delete a file or folder from Drive
export const deleteAppFile = async (accessToken: string, fileId: string): Promise<boolean> => {
    try {
        const deleteUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`;
        const resp = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (resp.ok || resp.status === 204) {
            console.log(`[DriveStorage] Deleted file: ${fileId}`);
            return true;
        } else {
            console.error(`[DriveStorage] Failed to delete: ${resp.status}`);
            return false;
        }
    } catch (error) {
        console.error('[DriveStorage] Delete error:', error);
        return false;
    }
};

// Get Drive folder link
export const getAppFolderLink = async (accessToken: string): Promise<string | null> => {
    try {
        const rootQuery = `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const rootFolders = await searchFiles(accessToken, rootQuery);

        if (rootFolders && rootFolders.length > 0) {
            return rootFolders[0].webviewLink || `https://drive.google.com/drive/folders/${rootFolders[0].id}`;
        }
        return null;
    } catch (error) {
        console.error('[DriveStorage] Failed to get folder link:', error);
        return null;
    }
};
