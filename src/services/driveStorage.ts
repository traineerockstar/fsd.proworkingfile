import { findOrCreateFolder, findSubfolder, saveJobToDrive } from './googleDriveService';
import { Job } from '../context/JobContext';

const APP_FOLDER_NAME = 'FSD_PRO_DATA';

export const saveDailySchedule = async (accessToken: string, dateStr: string, jobs: Job[]) => {
    try {
        // 1. Root Check: Verify FSD_PRO_DATA exists/is found
        const rootId = await findOrCreateFolder(accessToken);
        console.log(`[DriveStorage] Root Folder ID: ${rootId}`);

        // 2. Folder Check: Check if YYYY-MM-DD exists inside
        const dateFolderId = await findSubfolder(accessToken, rootId, dateStr);
        console.log(`[DriveStorage] Date Folder ID (${dateStr}): ${dateFolderId}`);

        // 3. Save "schedule.json" (The simplified list for the day)
        const scheduleFileMetadata = {
            name: 'schedule.json',
            parents: [dateFolderId]
        };
        const scheduleData = {
            date: dateStr,
            total_jobs: jobs.length,
            jobs: jobs // Saving the full job list here as the "schedule" summary
        };

        await saveFileToFolder(accessToken, dateFolderId, 'schedule.json', scheduleData);

        // 4. Save "job_details.json" OR individual jobs
        // User requested: "Save schedule.json and job_details.json INSIDE that specific dated folder."
        // I will save a second file 'job_details.json' containing the detailed array, strictly as requested.

        const jobDetailsData = {
            service_appointments: jobs // This mimics the structure likely desired
        };
        await saveFileToFolder(accessToken, dateFolderId, 'job_details.json', jobDetailsData);

        console.log(`[DriveStorage] Saved entries to ${dateStr}`);

    } catch (error) {
        console.error("[DriveStorage] Failed to save daily schedule:", error);
        throw error;
    }
};

// Helper to Create/Update file (Simpler version of saveJobToDrive but generic)
const saveFileToFolder = async (accessToken: string, folderId: string, fileName: string, data: any) => {
    // Check if exists
    const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;
    const searchResp = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    const searchData = await searchResp.json();

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: fileName, parents: [folderId] })], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(data)], { type: 'application/json' }));

    if (searchData.files && searchData.files.length > 0) {
        // Update
        const fileId = searchData.files[0].id;
        const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
        await fetch(updateUrl, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: form
        });
    } else {
        // Create
        const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: form
        });
    }
};
