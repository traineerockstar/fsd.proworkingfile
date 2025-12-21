import { findSubfolder, listFilesInFolder, findOrCreateFolder, getFileBase64 } from './googleDriveService';
import { KnowledgeItem } from '../types';
import { DRIVE_FOLDERS } from './driveConfig';

const MANUALS_FOLDER = DRIVE_FOLDERS.MANUALS;

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

// Product Category Mapping (used for smart folder search)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
    'Dishwashers': ['dishwasher', 'dw', 'dish'],
    'Fridge Freezers': ['fridge', 'freezer', 'ff', 'refrigerator', 'cold'],
    'Tumble Dryers': ['dryer', 'tumble', 'td', 'dry'],
    'Washing Machines': ['washer', 'washing', 'wm', 'laundry', 'wash', 'hw', 'h7w', 'hd']
};

/**
 * SMART MATCH: Extract searchable tokens from a model number
 * "HW80-B14959" → ["HW80", "B14959", "HW80-B14959"]
 * "H7W 412" → ["H7W", "412", "H7W412"]
 */
function extractSearchTokens(input: string): string[] {
    const normalized = input.toUpperCase().trim();
    const tokens: string[] = [normalized]; // Full string

    // Split by common separators
    const parts = normalized.split(/[-\s_]+/).filter(p => p.length > 0);
    tokens.push(...parts);

    // Also add glued version (no separators)
    const glued = parts.join('');
    if (glued !== normalized) tokens.push(glued);

    // Extract prefix (letters) and suffix (numbers) for patterns like "HW80" → "HW", "80"
    const prefixMatch = normalized.match(/^([A-Z]+)(\d+)/);
    if (prefixMatch) {
        tokens.push(prefixMatch[1]); // "HW"
    }

    return [...new Set(tokens)]; // Dedupe
}

/**
 * Guess which category folder to search based on model/context keywords
 */
function guessCategory(modelNumber: string): string | null {
    const lower = modelNumber.toLowerCase();
    for (const [folder, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        for (const kw of keywords) {
            if (lower.includes(kw)) return folder;
        }
    }
    return null;
}

async function searchDriveForManual(accessToken: string, modelNumber: string): Promise<KnowledgeItem | null> {
    try {
        const rootId = await findOrCreateFolder(accessToken);
        const manualsFolderId = await findSubfolder(accessToken, rootId, MANUALS_FOLDER);

        // SMART MATCH: Extract search tokens
        const tokens = extractSearchTokens(modelNumber);
        console.log(`[Smart Search] Model: "${modelNumber}" → Tokens: [${tokens.join(', ')}]`);

        // Try each token until we find a match
        for (const token of tokens) {
            const query = `'${manualsFolderId}' in parents and name contains '${token}' and trashed=false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, webContentLink)`;

            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            const data = await response.json();

            if (data.files && data.files.length > 0) {
                // Sort by best match (exact match first, then shortest name)
                const sorted = data.files.sort((a: any, b: any) => {
                    const aExact = a.name.toUpperCase().includes(modelNumber.toUpperCase()) ? 0 : 1;
                    const bExact = b.name.toUpperCase().includes(modelNumber.toUpperCase()) ? 0 : 1;
                    if (aExact !== bExact) return aExact - bExact;
                    return a.name.length - b.name.length;
                });

                const file = sorted[0];
                console.log(`[Smart Search] Found: ${file.name}`);
                return {
                    id: file.id,
                    title: file.name,
                    source: 'drive',
                    url: file.webContentLink
                };
            }
        }

        // FALLBACK: Try category folder search
        const category = guessCategory(modelNumber);
        if (category) {
            console.log(`[Smart Search] Trying category folder: ${category}`);
            try {
                const categoryFolderId = await findSubfolder(accessToken, manualsFolderId, category);
                // Search inside category folder
                for (const token of tokens) {
                    const query = `'${categoryFolderId}' in parents and name contains '${token}' and trashed=false`;
                    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, webContentLink)`;
                    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                    const data = await response.json();

                    if (data.files && data.files.length > 0) {
                        const file = data.files[0];
                        console.log(`[Smart Search] Found in ${category}: ${file.name}`);
                        return {
                            id: file.id,
                            title: file.name,
                            source: 'drive',
                            url: file.webContentLink
                        };
                    }
                }
            } catch {
                // Category folder doesn't exist, continue
            }
        }

        console.log(`[Smart Search] No manual found for: ${modelNumber}`);
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

        // SNIPER MODE UPGRADE: Try to download the actual PDF
        let fileName = `${modelNumber}_Manual_Ref.json`;
        let fileBlob: Blob;
        let mimeType = 'application/json';

        if (manual.url && manual.url.endsWith('.pdf')) {
            try {
                console.log(`[Sniper Mode] Attempting to download actual PDF from: ${manual.url}`);
                const pdfResponse = await fetch(manual.url);

                if (pdfResponse.ok) {
                    const pdfBlob = await pdfResponse.blob();
                    // Verify it's a PDF
                    if (pdfBlob.type === 'application/pdf' || pdfBlob.size > 10000) {
                        fileName = `${modelNumber}_Manual.pdf`;
                        fileBlob = pdfBlob;
                        mimeType = 'application/pdf';
                        console.log(`[Sniper Mode] PDF Downloaded (${(pdfBlob.size / 1024).toFixed(1)} KB)`);
                    } else {
                        throw new Error("Response was not a valid PDF");
                    }
                } else {
                    throw new Error(`HTTP ${pdfResponse.status}`);
                }
            } catch (downloadErr) {
                console.warn(`[Sniper Mode] PDF download failed (likely CORS): ${downloadErr}. Saving reference instead.`);
                // Fallback to JSON reference
                fileBlob = new Blob([JSON.stringify({
                    ...manual,
                    note: 'PDF could not be downloaded. Use URL to access manually.',
                    downloadAttemptedAt: new Date().toISOString()
                })], { type: 'application/json' });
            }
        } else {
            // Not a PDF URL, save as JSON reference
            fileBlob = new Blob([JSON.stringify(manual)], { type: 'application/json' });
        }

        const metadata = {
            name: fileName,
            mimeType: mimeType,
            parents: [manualsFolderId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', fileBlob!);

        const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: form
        });
        console.log(`Saved ${fileName} for ${modelNumber} to Drive.`);

    } catch (e) {
        console.error("Failed to Auto-Save Manual to Drive:", e);
    }
}
