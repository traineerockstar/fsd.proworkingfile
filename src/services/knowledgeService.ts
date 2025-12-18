import { findSubfolder, listFilesInFolder, findOrCreateFolder, getFileBase64 } from './googleDriveService';
import { KnowledgeItem } from '../types';

const MANUALS_FOLDER = 'MANUALS';

/**
 * Knowledge Service Center
 * Handles manual retrieval, storage, and Exa.ai fallback.
 */

// Placeholder for Exa API Key
const EXA_API_KEY = import.meta.env.VITE_EXA_API_KEY;

export const knowledgeService = {

    /**
     * Main entry point: Find manual for a model number
     */
    findManual: async (accessToken: string, modelNumber: string): Promise<KnowledgeItem | null> => {
        // 1. Check Drive First
        const driveResult = await searchDriveForManual(accessToken, modelNumber);
        if (driveResult) return driveResult;

        // 2. Fallback to Exa (Sniper Mode)
        console.log(`Manual for ${modelNumber} not found in Drive. Engaging Sniper Mode...`);
        const webResult = await searchWebForManual(modelNumber);

        if (webResult) {
            // 3. Auto-Save to Drive
            await saveManualToDrive(accessToken, webResult, modelNumber);
            return webResult;
        }

        return null;
    },

    // ... Helper functions will be implemented in following steps
};

async function searchDriveForManual(accessToken: string, modelNumber: string): Promise<KnowledgeItem | null> {
    try {
        const rootId = await findOrCreateFolder(accessToken);
        const manualsFolderId = await findSubfolder(accessToken, rootId, MANUALS_FOLDER);

        // Search for file with model number in name
        const query = `'${manualsFolderId}' in parents and name contains '${modelNumber}' and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, webContentLink)`;

        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const data = await response.json();

        if (data.files && data.files.length > 0) {
            const file = data.files[0];
            return {
                id: file.id,
                title: file.name,
                source: 'drive',
                url: file.webContentLink
            };
        }
    } catch (e) {
        console.error("Drive Manual Search Error", e);
    }
    return null;
}

async function searchWebForManual(modelNumber: string): Promise<KnowledgeItem | null> {
    if (!EXA_API_KEY) {
        console.warn("Skipping Exa Search: VITE_EXA_API_KEY not set.");
        return null;
    }

    try {
        const response = await fetch("https://api.exa.ai/search", {
            method: "POST",
            headers: {
                "x-api-key": EXA_API_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query: `${modelNumber} service manual or user guide pdf`,
                numResults: 1,
                useAutoprompt: true,
                contents: {
                    text: false
                }
            }),
        });

        if (!response.ok) {
            console.error("Exa API Error:", response.statusText);
            return null;
        }

        const data = await response.json();
        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            return {
                id: result.id,
                title: result.title || `Manual for ${modelNumber}`,
                url: result.url,
                source: 'web'
            };
        }

    } catch (e) {
        console.error("Exa Search Exception:", e);
    }

    return null;
}

async function saveManualToDrive(accessToken: string, manual: KnowledgeItem, modelNumber: string) {
    try {
        const rootId = await findOrCreateFolder(accessToken);
        const manualsFolderId = await findSubfolder(accessToken, rootId, MANUALS_FOLDER);

        // We will save a JSON reference to keep it simple and avoid CORS hell with PDFs
        const fileName = `${modelNumber}_Manual_Ref.json`;
        const metadata = {
            name: fileName,
            mimeType: 'application/json',
            parents: [manualsFolderId]
        };

        const body = JSON.stringify(manual);

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([body], { type: 'application/json' }));

        const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: form
        });
        console.log(`Saved Manual Ref for ${modelNumber} to Drive.`);

    } catch (e) {
        console.error("Failed to Auto-Save Manual to Drive:", e);
    }
}
