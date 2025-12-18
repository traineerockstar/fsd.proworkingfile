
import { findOrCreateFolder } from './googleDriveService';
import { FaultCode } from '../types';

const DB_FILENAME = 'fault_codes.json';

interface LearningDB {
    faults: FaultCode[];
    lastUpdated: string;
}

export const learningService = {

    getSolutions: async (accessToken: string): Promise<FaultCode[]> => {
        try {
            const rootId = await findOrCreateFolder(accessToken);

            // Search for file
            const query = `'${rootId}' in parents and name = '${DB_FILENAME}' and trashed=false`;
            const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mediaLink)`;
            const headers = { 'Authorization': `Bearer ${accessToken}` };

            const resp = await fetch(searchUrl, { headers });
            const data = await resp.json();

            if (data.files && data.files.length > 0) {
                // Download content
                const fileId = data.files[0].id;
                const fileUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
                const contentResp = await fetch(fileUrl, { headers });
                try {
                    const json = await contentResp.json() as LearningDB;
                    return json.faults || [];
                } catch (parseError) {
                    console.warn("Fault DB corrupted or legacy format, returning empty.");
                    return [];
                }
            }

            // File missing: Initialize details
            console.log("Fault DB missing. Initializing...");
            const initialData: LearningDB = { faults: [], lastUpdated: new Date().toISOString() };

            // Create the file
            const metadata = {
                name: DB_FILENAME,
                mimeType: 'application/json',
                parents: [rootId]
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([JSON.stringify(initialData)], { type: 'application/json' }));

            await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` },
                body: form
            });

            return []; // Return empty for now, next call will get it or we can return initialData.faults
        } catch (e) {
            console.error("Failed to load solutions DB", e);
            return [];
        }
    },

    findFix: async (accessToken: string, code: string): Promise<FaultCode | null> => {
        const solutions = await learningService.getSolutions(accessToken);
        // Fuzzy match or exact? Exact for now.
        if (!code) return null;
        const match = solutions.find(s => s.errorCode.toLowerCase() === code.toLowerCase());
        return match || null;
    },

    recordFix: async (accessToken: string, solution: FaultCode) => {
        try {
            const solutions = await learningService.getSolutions(accessToken);
            const index = solutions.findIndex(s => s.errorCode === solution.errorCode && s.fix === solution.fix);

            if (index >= 0) {
                solutions[index].successCount += 1;
                solutions[index].lastVerified = new Date().toISOString();
            } else {
                solutions.push(solution);
            }

            const dbData: LearningDB = {
                faults: solutions,
                lastUpdated: new Date().toISOString()
            };

            // Save back to Drive
            const rootId = await findOrCreateFolder(accessToken);

            // Reuse save logic
            const metadata = {
                name: DB_FILENAME,
                mimeType: 'application/json',
                parents: [rootId]
            };

            // We need to overwrite if exists. 
            // Simplified: find file ID first, then update.
            const query = `'${rootId}' in parents and name = '${DB_FILENAME}' and trashed=false`;
            const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;
            const searchResp = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            const searchData = await searchResp.json();

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([JSON.stringify(dbData, null, 2)], { type: 'application/json' }));

            if (searchData.files && searchData.files.length > 0) {
                const fileId = searchData.files[0].id;
                await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    body: form
                });
            } else {
                await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    body: form
                });
            }

        } catch (e) {
            console.error("Failed to save solution", e);
        }
    }
};
