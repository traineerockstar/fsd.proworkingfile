import { findOrCreateFolder, findSubfolder, saveJobToDrive } from './googleDriveService';
import { Job } from '../context/JobContext';

const APP_FOLDER_NAME = 'FSD_PRO_DATA';

// --- GENERIC HELPERS (The "Brain" Access Layer) ---

export const searchFiles = async (accessToken: string, query: string): Promise<any[]> => {
    try {
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webviewLink,parents)`;
        const resp = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
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

export const saveDailySchedule = async (accessToken: string, dateStr: string, jobs: Job[]) => {
    try {
        // 1. Root Check: Verify FSD_PRO_DATA exists/is found
        const rootId = await findOrCreateFolder(accessToken);

        // 2. Folder Check: Check if YYYY-MM-DD exists inside
        const dateFolderId = await findSubfolder(accessToken, rootId, dateStr);

        // 3. Save "schedule.json" (The simplified list for the day)
        const scheduleData = {
            date: dateStr,
            total_jobs: jobs.length,
            jobs: jobs
        };
        await saveFileToFolder(accessToken, dateFolderId, 'schedule.json', scheduleData);

        // 4. Save "job_details.json"
        const jobDetailsData = {
            service_appointments: jobs
        };
        await saveFileToFolder(accessToken, dateFolderId, 'job_details.json', jobDetailsData);

        console.log(`[DriveStorage] Saved entries to ${dateStr}`);

    } catch (error) {
        console.error("[DriveStorage] Failed to save daily schedule:", error);
        throw error;
    }
};

// Helper to Create/Update file (Generic)
const saveFileToFolder = async (accessToken: string, folderId: string, fileName: string, data: any): Promise<string | null> => {
    try {
        // Check if exists
        const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
        const files = await searchFiles(accessToken, query);

        const fileContent = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const metadata = { name: fileName, parents: [folderId] };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', fileContent);

        if (files && files.length > 0) {
            // Update
            const fileId = files[0].id;
            const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
            await fetch(updateUrl, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${accessToken}` },
                body: form
            });
            return fileId;
        } else {
            // Create
            const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
            const resp = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` },
                body: form
            });
            const created = await resp.json();
            return created.id;
        }
    } catch (e) {
        console.error("SaveFile Error:", e);
        return null;
    }
};
