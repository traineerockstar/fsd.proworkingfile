// Learning Service - Self-Improving Knowledge Base
// Stores successful fixes in Google Drive (replacing localStorage) and retrieves them for future reference
import { findOrCreateFolder, findSubfolder } from './googleDriveService';

interface LearnedSolution {
    id: string;
    faultCode: string;
    model: string;
    symptoms: string;
    diagnosis: string;
    fix: string;
    partsUsed: string[];
    successCount: number;
    lastUsed: string;
    addedBy: string;
    confidence: 'high' | 'medium' | 'low';
    createdAt: string;
}

const LEARNING_FILE_NAME = 'learned_solutions.json';
const APP_FOLDER_NAME = 'FSD_PRO_DATA';

// In-Memory Cache
let solutionsCache: LearnedSolution[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

// Load all learned solutions (from Cache or Drive)
// NOW ASYNC to support Drive Fetch
export async function getLearnedSolutions(accessToken?: string): Promise<LearnedSolution[]> {
    // 1. Return Cache if valid
    if (solutionsCache && (Date.now() - lastFetchTime < CACHE_TTL)) {
        return solutionsCache;
    }

    // 2. Fetch from Drive if Token provided
    if (accessToken) {
        try {
            console.log("Downloading Oscar's Brain from Drive...");
            const rootId = await findOrCreateFolder(accessToken);
            // Check if file exists in root or data folder. 
            // The plan said FSD_PRO_DATA. findOrCreateFolder returns FSD_PRO_DATA id by default in googleDriveService?
            // checking googleDriveService: findOrCreateFolder creates 'FSD_PRO_DATA'. So rootId is correct.

            const query = `name='${LEARNING_FILE_NAME}' and '${rootId}' in parents and trashed=false`;
            const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;
            const res = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            const data = await res.json();

            if (data.files && data.files.length > 0) {
                const fileId = data.files[0].id;
                const contentUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
                const contentRes = await fetch(contentUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                const json = await contentRes.json();

                solutionsCache = json.solutions || [];
                lastFetchTime = Date.now();
                return solutionsCache!;
            }
        } catch (e) {
            console.warn("Failed to load learnings from Drive:", e);
        }
    }

    // 3. Fallback to Empty or keep existing stale cache
    return solutionsCache || [];
}

// Save solutions to Drive
async function saveSolutions(accessToken: string, solutions: LearnedSolution[]): Promise<void> {
    // Update Cache immediately
    solutionsCache = solutions;
    lastFetchTime = Date.now();

    try {
        const rootId = await findOrCreateFolder(accessToken);

        // Prepare File
        const fileMetadata = {
            name: LEARNING_FILE_NAME,
            parents: [rootId]
        };
        const media = {
            mimeType: 'application/json',
            body: JSON.stringify({ solutions, lastUpdated: new Date().toISOString() })
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
        form.append('file', new Blob([media.body], { type: 'application/json' }));

        // Check for existing file to update
        const query = `name='${LEARNING_FILE_NAME}' and '${rootId}' in parents and trashed=false`;
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;
        const res = await fetch(searchUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const data = await res.json();

        if (data.files && data.files.length > 0) {
            // PATCH
            const fileId = data.files[0].id;
            const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
            await fetch(updateUrl, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${accessToken}` },
                body: form
            });
            console.log("Saved Oscar's Brain to Drive (Update)");
        } else {
            // POST
            const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
            await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` },
                body: form
            });
            console.log("Saved Oscar's Brain to Drive (New)");
        }

    } catch (error) {
        console.error('Error saving learned solutions to Drive:', error);
    }
}

// Calculate confidence level based on success count
function calculateConfidence(successCount: number): 'high' | 'medium' | 'low' {
    if (successCount >= 5) return 'high';
    if (successCount >= 2) return 'medium';
    return 'low';
}

// Record a new solution or increment existing one
export async function recordSolution(
    accessToken: string,
    solution: Omit<LearnedSolution, 'id' | 'successCount' | 'lastUsed' | 'confidence' | 'createdAt'>
): Promise<void> {
    const solutions = await getLearnedSolutions(accessToken);
    const now = new Date().toISOString().split('T')[0];

    // Check if similar solution already exists
    const existingIndex = solutions.findIndex(s =>
        s.faultCode.toUpperCase() === solution.faultCode.toUpperCase() &&
        s.model.toLowerCase() === solution.model.toLowerCase() &&
        s.fix.toLowerCase().includes(solution.fix.toLowerCase().substring(0, 50))
    );

    if (existingIndex !== -1) {
        // Increment success count for existing solution
        solutions[existingIndex].successCount++;
        solutions[existingIndex].lastUsed = now;
        solutions[existingIndex].confidence = calculateConfidence(solutions[existingIndex].successCount);

        console.log(`✅ Updated existing solution (now used ${solutions[existingIndex].successCount}x)`);
    } else {
        // Add new solution
        const newSolution: LearnedSolution = {
            ...solution,
            id: `sol_${Date.now()}`,
            successCount: 1,
            lastUsed: now,
            createdAt: now,
            confidence: 'low'
        };

        solutions.push(newSolution);
        console.log('✅ New solution recorded');
    }

    await saveSolutions(accessToken, solutions);
}

// Find learned solutions for a specific fault code
// SYNC Wrapper for Cache Access (Helper for UI/Gemini that needs instant reply)
export function findLearnedSolution(faultCode: string, model?: string): LearnedSolution[] {
    // Uses In-Memory Cache ONLY
    const solutions = solutionsCache || [];
    const codeLower = faultCode.toUpperCase();

    let filtered = solutions.filter(s => s.faultCode.toUpperCase() === codeLower);

    // If model specified, prioritize matching model but include all
    if (model) {
        const modelLower = model.toLowerCase();
        filtered.sort((a, b) => {
            const aMatches = a.model.toLowerCase().includes(modelLower);
            const bMatches = b.model.toLowerCase().includes(modelLower);

            if (aMatches && !bMatches) return -1;
            if (!aMatches && bMatches) return 1;

            // Both match or both don't - sort by success count
            return b.successCount - a.successCount;
        });
    } else {
        // Sort by success count only
        filtered.sort((a, b) => b.successCount - a.successCount);
    }

    return filtered;
}

// Search learned solutions by symptoms or fix description
// Now Async to ensure latest data
export async function searchLearnedSolutions(query: string, accessToken?: string): Promise<LearnedSolution[]> {
    const solutions = await getLearnedSolutions(accessToken);
    const queryLower = query.toLowerCase();

    return solutions
        .filter(s =>
            s.symptoms.toLowerCase().includes(queryLower) ||
            s.diagnosis.toLowerCase().includes(queryLower) ||
            s.fix.toLowerCase().includes(queryLower) ||
            s.faultCode.toLowerCase().includes(queryLower)
        )
        .sort((a, b) => b.successCount - a.successCount);
}

// Get statistics about learned solutions
export function getLearningStats() {
    const solutions = solutionsCache || [];

    const totalSolutions = solutions.length;
    const totalSuccesses = solutions.reduce((sum, s) => sum + s.successCount, 0);
    const highConfidence = solutions.filter(s => s.confidence === 'high').length;
    const mediumConfidence = solutions.filter(s => s.confidence === 'medium').length;
    const lowConfidence = solutions.filter(s => s.confidence === 'low').length;

    // Get most common fault codes
    const codes = solutions.reduce((acc, s) => {
        acc[s.faultCode] = (acc[s.faultCode] || 0) + s.successCount;
        return acc;
    }, {} as Record<string, number>);

    const topCodes = Object.entries(codes)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([code, count]) => ({ code, count }));

    return {
        totalSolutions,
        totalSuccesses,
        highConfidence,
        mediumConfidence,
        lowConfidence,
        topCodes
    };
}

// Export all learnings as JSON string for backup
export function exportLearnings(): string {
    const solutions = solutionsCache || [];
    return JSON.stringify({ solutions, exportedAt: new Date().toISOString() }, null, 2);
}

// Import learnings from JSON string
export async function importLearnings(jsonData: string, accessToken: string): Promise<boolean> {
    try {
        const data = JSON.parse(jsonData);
        if (!data.solutions || !Array.isArray(data.solutions)) {
            console.error('Invalid learnings data format');
            return false;
        }

        await saveSolutions(accessToken, data.solutions);
        console.log(`✅ Imported ${data.solutions.length} solutions`);
        return true;
    } catch (error) {
        console.error('Error importing learnings:', error);
        return false;
    }
}

// Clear all learned solutions (use with caution!)
// Does NOT delete file from Drive, just clears cache and local ref. 
// Implementation of Drive Clean needed if we want Full Wipe.
export function clearInMemoryCache(): void {
    solutionsCache = [];
    console.log('🗑️ InMemory solutions cleared');
}

export type { LearnedSolution };
