import { gapi } from 'gapi-script';
import { DRIVE_FOLDERS, DRIVE_FILES } from './driveConfig';

const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/drive.file";

const APP_FOLDER_NAME = DRIVE_FOLDERS.ROOT;

export interface DriveFile {
    id: string;
    name: string;
    body: any;
}

export interface JobSummary {
    id: string;
    customerName: string;
    status: string;
    date: string;
    driveFileId: string;
    [key: string]: any; // Allow other fields for flexibility
}

export interface Manifest {
    jobs: JobSummary[];
    lastUpdated: string;
}

const MANIFEST_FILE_NAME = 'manifest.json';

export const initGoogleAvailable = () => {
    // This function can be used to load GAPI if not already loaded by a provider,
    // though usually handled by the login component now.
    // Kept for manual GAPI operations if needed.
};

export const findOrCreateFolder = async (accessToken: string): Promise<string> => {
    // Ensure gapi client is set with the token
    // Note: With the new identity services, we might need to rely on the REST API directly 
    // or set the token on gapi.client depending on the exact flow (implicit vs code).
    // For now, assuming simple REST calls or configured gapi.

    // Using fetch/REST is often cleaner with simple access tokens than fighting gapi's internal state in 2024.

    // 1. Search for folder
    const query = `mimeType='application/vnd.google-apps.folder' and name='${APP_FOLDER_NAME}' and trashed=false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error('Failed to search Drive');
    }

    const data = await response.json();

    if (data.files && data.files.length > 0) {
        return data.files[0].id;
    }

    // 2. Create if not found
    const createUrl = 'https://www.googleapis.com/drive/v3/files';
    const metadata = {
        name: APP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
    };

    const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
    });

    if (!createResponse.ok) {
        throw new Error('Failed to create App Folder');
    }

    const folderData = await createResponse.json();
    return folderData.id;
};

export const saveJobToDrive = async (accessToken: string, jobData: any) => {
    try {
        const folderId = await findOrCreateFolder(accessToken);
        const fileName = `job_${jobData.id}.json`;

        // Prepare metadata and content
        const fileMetadata = {
            name: fileName,
            parents: [folderId]
        };

        const media = {
            mimeType: 'application/json',
            body: JSON.stringify(jobData)
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
        form.append('file', new Blob([JSON.stringify(jobData)], { type: 'application/json' }));

        let fileId = jobData.driveFileId;

        // STRATEGY 1: Direct Update via ID (Fastest)
        if (fileId) {
            console.log(`[@Chief-Architect]: Optimizing save - using Direct Patch for ${fileId}`);
            const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
            const patchResp = await fetch(updateUrl, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${accessToken}` },
                body: form
            });

            if (patchResp.ok) {
                console.log(`Updated job ${jobData.id} via direct patch.`);
            } else if (patchResp.status === 404) {
                console.warn(`[@Chief-Architect]: Stale Drive ID ${fileId}. File missing. Falling back to search/create.`);
                fileId = null; // Force fallback
            } else {
                throw new Error(`Direct patch failed: ${patchResp.statusText}`);
            }
        }

        // STRATEGY 2: Search then Update/Create (Fallback)
        if (!fileId) {
            const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
            const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;
            const searchResp = await fetch(searchUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const searchData = await searchResp.json();

            if (searchData.files && searchData.files.length > 0) {
                // Update existing file
                fileId = searchData.files[0].id;
                const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
                await fetch(updateUrl, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    body: form
                });
                console.log(`Updated job ${jobData.id} (found via search)`);
            } else {
                // Create new file
                const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
                const createResp = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    body: form
                });
                const createData = await createResp.json();
                console.log(`Created new job file ${jobData.id}`);
                fileId = createData.id;
            }
        }

        // 3. Update Manifest DECOUPLED
        // We no longer await this here. Manifest updates should be handled by a background process
        // or a debounced queue to prevent blocking the UI and reducing write contention.
        if (fileId) {
            // For now, fire and forget (don't await) if we want semi-live updates, 
            // OR completely remove if moving to pure periodic sync.
            // implementation_plan says: "Remove the automatic updateManifest call".
            // We will export logic to do it separately.
        }

        return fileId;

    } catch (error) {
        console.error("Drive Save Error:", error);
    }
    return null;
};

// --- MANIFEST SYSTEMS ---

// --- MANIFEST SYSTEMS ---

// SMART CACHE
let manifestCache: Manifest | null = null;
let lastManifestFetch = 0;
const MANIFEST_TTL = 1000 * 60 * 2; // 2 minutes freshness

const getManifest = async (accessToken: string, forceRefresh = false): Promise<Manifest | null> => {
    // 1. Check Cache
    if (!forceRefresh && manifestCache && (Date.now() - lastManifestFetch < MANIFEST_TTL)) {
        return manifestCache;
    }

    try {
        console.log("[@Data-Ops]: Fetching Manifest from Drive...");
        const folderId = await findOrCreateFolder(accessToken);
        const query = `name='${MANIFEST_FILE_NAME}' and '${folderId}' in parents and trashed=false`;
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;
        const res = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const data = await res.json();

        if (data.files && data.files.length > 0) {
            const manifestId = data.files[0].id;
            const contentUrl = `https://www.googleapis.com/drive/v3/files/${manifestId}?alt=media`;
            const contentRes = await fetch(contentUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });

            const fetched = await contentRes.json();

            // Validate & Update Cache
            if (fetched && Array.isArray(fetched.jobs)) {
                manifestCache = fetched;
                lastManifestFetch = Date.now();
                return manifestCache;
            }
        }
    } catch (e) {
        console.warn("Manifest fetch failed", e);
    }
    return null;
};

const saveManifest = async (accessToken: string, manifest: Manifest) => {
    try {
        const folderId = await findOrCreateFolder(accessToken);

        // Check if exists
        const query = `name='${MANIFEST_FILE_NAME}' and '${folderId}' in parents and trashed=false`;
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;
        const res = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const data = await res.json();

        let fileId = null;
        if (data.files && data.files.length > 0) fileId = data.files[0].id;

        const media = {
            mimeType: 'application/json',
            body: JSON.stringify(manifest)
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify({ name: MANIFEST_FILE_NAME, parents: [folderId] })], { type: 'application/json' }));
        form.append('file', new Blob([JSON.stringify(manifest)], { type: 'application/json' }));

        if (fileId) {
            const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
            await fetch(updateUrl, { method: 'PATCH', headers: { 'Authorization': `Bearer ${accessToken}` }, body: form });
        } else {
            const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
            await fetch(uploadUrl, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}` }, body: form });
        }

        // Update Cache
        manifestCache = manifest;
        lastManifestFetch = Date.now();

    } catch (e) {
        console.error("Failed to save manifest", e);
    }
};

export const updateManifest = async (accessToken: string, job: JobSummary) => {
    let manifest = await getManifest(accessToken);
    if (!manifest) {
        // If no manifest exists, we can't efficiently update it without a rebuild.
        // But for a single save, maybe we just create a new one with this 1 file?
        // No, safer to trigger a rebuild or start fresh.
        // Let's lazy init:
        manifest = { jobs: [], lastUpdated: new Date().toISOString() };
    }

    // Upsert Job
    const existingIndex = manifest.jobs.findIndex(j => j.id === job.id);
    if (existingIndex >= 0) {
        manifest.jobs[existingIndex] = job;
    } else {
        manifest.jobs.push(job);
    }
    manifest.lastUpdated = new Date().toISOString();

    await saveManifest(accessToken, manifest);
};

// Rebuilds manifest by scanning ALL job files (The 'Old Way')
export const rebuildManifest = async (accessToken: string): Promise<Manifest> => {
    console.log("⚠️ Rebuilding Manifest from raw files...");
    const folderId = await findOrCreateFolder(accessToken);
    const query = `'${folderId}' in parents and trashed=false and name contains 'job_'`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    const data = await response.json();

    const jobs: JobSummary[] = [];

    if (data.files) {
        // Parallel fetch limited? No, let's just use Promise.all for now as it's a recovery op
        const results = await Promise.all(data.files.map(async (file: any) => {
            const fileUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
            try {
                const res = await fetch(fileUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                const job = await res.json();
                return { ...job, driveFileId: file.id };
            } catch (e) {
                return null;
            }
        }));
        jobs.push(...results.filter(j => j !== null));
    }

    const manifest: Manifest = {
        jobs: jobs,
        lastUpdated: new Date().toISOString()
    };

    await saveManifest(accessToken, manifest);
    return manifest;
};

export const findSubfolder = async (accessToken: string, parentId: string, folderName: string): Promise<string> => {
    // 1. Search for folder
    const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed=false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) throw new Error('Failed to search Drive folder');
    const data = await response.json();

    if (data.files && data.files.length > 0) {
        return data.files[0].id;
    }

    // 2. Create if not found
    const createUrl = 'https://www.googleapis.com/drive/v3/files';
    const metadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
    };

    const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
    });

    if (!createResponse.ok) throw new Error('Failed to create subfolder');
    const folderData = await createResponse.json();
    return folderData.id;
};

export const listFilesInFolder = async (accessToken: string, folderName: string): Promise<any[]> => {
    try {
        const rootId = await findOrCreateFolder(accessToken);
        const targetId = await findSubfolder(accessToken, rootId, folderName);

        const query = `'${targetId}' in parents and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType)`;

        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const data = await response.json();

        return data.files || [];
    } catch (error) {
        console.error(`Error listing files in ${folderName}:`, error);
        return [];
    }
};

export const getFileBase64 = async (accessToken: string, fileId: string): Promise<string> => {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Remove data URL prefix
            resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const listJobsFromDrive = async (accessToken: string): Promise<any[]> => {
    try {
        console.log("🚀 Loading Jobs via Manifest Strategy...");
        // 1. Try to get manifest
        let manifest = await getManifest(accessToken);

        // 2. If no manifest, REBUILD IT (Self-Healing)
        if (!manifest) {
            console.log("⚠️ No manifest found. Triggering self-healing rebuild...");
            manifest = await rebuildManifest(accessToken);
        }

        return manifest.jobs || [];

    } catch (error) {
        console.error("List Jobs Error:", error);
        return [];
    }
};

const KNOWLEDGE_FOLDER_NAME = DRIVE_FOLDERS.KNOWLEDGE;

export const ensureKnowledgeFolder = async (accessToken: string): Promise<string> => {
    return findOrCreateFolderByName(accessToken, KNOWLEDGE_FOLDER_NAME);
};

// Helper to reuse finding/creating by name at root or unspecified parent
const findOrCreateFolderByName = async (accessToken: string, folderName: string): Promise<string> => {
    // 1. Search
    const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data = await response.json();

    if (data.files && data.files.length > 0) return data.files[0].id;

    // 2. Create
    const createUrl = 'https://www.googleapis.com/drive/v3/files';
    const metadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
    };

    const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
    });

    const folderData = await createResponse.json();
    return folderData.id;
};

export const uploadKnowledgeFile = async (accessToken: string, file: File) => {
    const folderId = await ensureKnowledgeFolder(accessToken);
    const metadata = {
        name: file.name,
        parents: [folderId]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: form
    });

    if (!response.ok) throw new Error("Failed to upload knowledge file");
    return await response.json();
};

export const searchKnowledgeBase = async (accessToken: string, queryText: string): Promise<string[]> => {
    try {
        const folderId = await ensureKnowledgeFolder(accessToken);
        // Deep search in knowledge folder
        // Note: Drive API 'fullText' search is powerful but can be laggy. name contains or fullText contains.
        const query = `'${folderId}' in parents and fullText contains '${queryText}' and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType)`;

        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const data = await response.json();

        if (!data.files || data.files.length === 0) return [];

        // Fetch content of top 3 files
        const topFiles = data.files.slice(0, 3);
        const contents = await Promise.all(topFiles.map(async (file: any) => {
            // Only try to read text-based files for now to avoid binary mess in prompt
            if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json' || file.name.endsWith('.md')) {
                const contentUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
                const res = await fetch(contentUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                const text = await res.text();
                return `--- SOURCE: ${file.name} ---\n${text.substring(0, 2000)}\n--- END SOURCE ---`; // Truncate to save tokens
            } else if (file.mimeType === 'application/pdf') {
                // NEW: Parse PDF content using pdfService!
                try {
                    const { extractTextFromPdfTruncated } = await import('./pdfService');
                    const contentUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
                    const res = await fetch(contentUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                    const blob = await res.blob();
                    const pdfText = await extractTextFromPdfTruncated(blob, 8000); // 8k chars per PDF
                    return `--- SOURCE: ${file.name} (PDF) ---\n${pdfText}\n--- END SOURCE ---`;
                } catch (pdfError) {
                    console.error(`Failed to parse PDF ${file.name}:`, pdfError);
                    return `--- SOURCE: ${file.name} (PDF - Parse Failed) ---`;
                }
            }
            return "";
        }));

        return contents.filter(c => c !== "");
    } catch (error) {
        console.error("Knowledge Base Search Error:", error);
        return [];
    }
};

/**
 * COMPREHENSIVE SEARCH: Searches ALL knowledge-related folders
 * - FSD_PRO_DATA/MANUALS
 * - FSD_PRO_DATA/PART_LISTS
 * - FSD_PRO_DATA/Error Code PDFs
 * - FSD_PRO_DATA/Fault codes
 * - FSD_PRO_KNOWLEDGE (root)
 */
export const searchAllKnowledgeFolders = async (
    accessToken: string,
    queryText: string,
    options?: { includePartsLists?: boolean; includeErrorCodes?: boolean; includeFaultCodes?: boolean }
): Promise<{ source: string; content: string; folder: string }[]> => {
    const results: { source: string; content: string; folder: string }[] = [];
    const opts = { includePartsLists: true, includeErrorCodes: true, includeFaultCodes: true, ...options };

    console.log(`[Deep Search] Searching all knowledge folders for: "${queryText}"`);

    try {
        const rootId = await findOrCreateFolder(accessToken);

        // Define folders to search
        const foldersToSearch: { name: string; parentId: string; enabled: boolean }[] = [
            { name: DRIVE_FOLDERS.MANUALS, parentId: rootId, enabled: true },
            { name: DRIVE_FOLDERS.PART_LISTS, parentId: rootId, enabled: opts.includePartsLists },
            { name: DRIVE_FOLDERS.ERROR_CODE_PDFS, parentId: rootId, enabled: opts.includeErrorCodes },
            { name: DRIVE_FOLDERS.FAULT_CODES, parentId: rootId, enabled: opts.includeFaultCodes },
        ];

        // Search each folder
        for (const folder of foldersToSearch) {
            if (!folder.enabled) continue;

            try {
                const folderId = await findSubfolder(accessToken, folder.parentId, folder.name);

                // Search for files containing the query
                const query = `'${folderId}' in parents and (name contains '${queryText}' or fullText contains '${queryText}') and trashed=false`;
                const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType)&pageSize=5`;

                const response = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                const data = await response.json();

                if (data.files && data.files.length > 0) {
                    console.log(`[Deep Search] Found ${data.files.length} results in ${folder.name}`);

                    // Process first 2 files from each folder
                    for (const file of data.files.slice(0, 2)) {
                        try {
                            let content = '';

                            if (file.mimeType === 'application/pdf') {
                                const { extractTextFromPdfTruncated } = await import('./pdfService');
                                const contentUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
                                const res = await fetch(contentUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                                const blob = await res.blob();
                                content = await extractTextFromPdfTruncated(blob, 4000);
                            } else if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json' || file.name.endsWith('.md') || file.name.endsWith('.csv')) {
                                const contentUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
                                const res = await fetch(contentUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                                content = (await res.text()).substring(0, 4000);
                            }

                            if (content) {
                                results.push({
                                    source: file.name,
                                    content: content,
                                    folder: folder.name
                                });
                            }
                        } catch (fileErr) {
                            console.warn(`[Deep Search] Could not read ${file.name}:`, fileErr);
                        }
                    }
                }
            } catch (folderErr) {
                // Folder doesn't exist, skip
                console.log(`[Deep Search] Folder ${folder.name} not found, skipping.`);
            }
        }

        // Also search the separate Knowledge folder
        try {
            const knowledgeFolderId = await ensureKnowledgeFolder(accessToken);
            const query = `'${knowledgeFolderId}' in parents and fullText contains '${queryText}' and trashed=false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType)&pageSize=3`;

            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            const data = await response.json();

            if (data.files && data.files.length > 0) {
                console.log(`[Deep Search] Found ${data.files.length} results in FSD_PRO_KNOWLEDGE`);
                for (const file of data.files.slice(0, 2)) {
                    try {
                        let content = '';
                        if (file.mimeType === 'application/pdf') {
                            const { extractTextFromPdfTruncated } = await import('./pdfService');
                            const contentUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
                            const res = await fetch(contentUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                            content = await extractTextFromPdfTruncated(await res.blob(), 4000);
                        } else {
                            const contentUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
                            const res = await fetch(contentUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                            content = (await res.text()).substring(0, 4000);
                        }
                        if (content) {
                            results.push({ source: file.name, content, folder: 'FSD_PRO_KNOWLEDGE' });
                        }
                    } catch (e) { /* skip */ }
                }
            }
        } catch { /* Knowledge folder doesn't exist */ }

        console.log(`[Deep Search] Total results: ${results.length}`);
        return results;


    } catch (error) {
        console.error("[Deep Search] Error:", error);
        return [];
    }
};

// --- SPO PARTS HELPERS ---

export const exportSheetAsCsv = async (accessToken: string, fileId: string, mimeType?: string): Promise<string> => {

    // STRATEGY: IF EXCEL, CONVERT TO TEMP GOOGLE SHEET FIRST
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mimeType === 'application/vnd.ms-excel') {
        console.log(`[DriveService] Converting Excel (${fileId}) to temp Sheet for export...`);

        // 1. Copy & Convert
        const copyUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/copy`;
        const metadata = {
            mimeType: 'application/vnd.google-apps.spreadsheet',
            name: `TEMP_CONVERT_${fileId}`
        };
        const copyRes = await fetch(copyUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(metadata)
        });

        if (!copyRes.ok) throw new Error(`Failed to convert Excel file: ${copyRes.statusText}`);
        const tempFile = await copyRes.json();
        const tempId = tempFile.id;

        try {
            // 2. Recursive Call with new ID and "correct" mimeType
            // We wait a brief moment for propagation? usually instant for copies.
            return await exportSheetAsCsv(accessToken, tempId, 'application/vnd.google-apps.spreadsheet');
        } finally {
            // 3. Cleanup: Delete Temp File
            console.log(`[DriveService] Cleaning up temp file ${tempId}...`);
            await fetch(`https://www.googleapis.com/drive/v3/files/${tempId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
        }
    }

    // STANDARD EXPORT (Google Sheets)
    const baseUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export`;
    const params = new URLSearchParams({
        mimeType: 'text/csv'
    });

    const response = await fetch(`${baseUrl}?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
        // Detailed error for debugging
        const errText = await response.text();
        throw new Error(`Failed to export sheet (${response.status}): ${errText}`);
    }

    return await response.text();
};

const SPO_TRACKING_FILE = 'spo_tracking.json';

export const loadSPOTracking = async (accessToken: string): Promise<string[]> => {
    try {
        const rootId = await findOrCreateFolder(accessToken);
        // Look for the file in FSD_PRO_DATA directly
        const query = `name='${SPO_TRACKING_FILE}' and '${rootId}' in parents and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;

        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const data = await res.json();

        if (data.files && data.files.length > 0) {
            const fileId = data.files[0].id;
            const contentUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
            const contentRes = await fetch(contentUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            const json = await contentRes.json();
            return json.completedIds || [];
        }
    } catch (e) {
        console.warn("Could not load SPO tracking", e);
    }
    return [];
};

export const saveSPOTracking = async (accessToken: string, completedIds: string[]) => {
    try {
        const rootId = await findOrCreateFolder(accessToken);
        const fileName = SPO_TRACKING_FILE;
        const content = { completedIds, lastUpdated: new Date().toISOString() };

        // Check if exists
        const query = `name='${fileName}' and '${rootId}' in parents and trashed=false`;
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;
        const res = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const data = await res.json();

        const fileId = (data.files && data.files.length > 0) ? data.files[0].id : null;

        if (fileId) {
            // Update existing file (Content Only) - simpler and more robust
            const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
            const updateRes = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(content)
            });
            if (!updateRes.ok) {
                const errText = await updateRes.text();
                throw new Error(`Failed to update tracking file: ${updateRes.status} ${errText}`);
            }
        } else {
            // Create New
            const metadata = {
                name: fileName,
                parents: [rootId],
                mimeType: 'application/json'
            };
            await createFile(accessToken, metadata, content);
        }
    } catch (e) {
        console.error("Error saving SPO tracking:", e);
        throw e; // Propagate to caller
    }
};

// --- GENERIC FILE HELPERS ---
// Validated Export
export const createFile = async (accessToken: string, metadata: any, content: any, contentType: string = 'application/json') => {
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([typeof content === 'string' ? content : JSON.stringify(content)], { type: contentType }));

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: form
    });
    return await res.json();
};

export const readFileContent = async (accessToken: string, fileId: string): Promise<any> => {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error("Failed to read file content");
    return await res.json();
};

