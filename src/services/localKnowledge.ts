// Local Knowledge Base Service
// Loads and searches pre-built knowledge from JSON files

interface FaultCode {
    code: string;
    description: string;
    models: string[];
    diagnosis: string;
    commonCauses: string[];
    fix: string;
    parts: string[];
    difficulty: string;
    estimatedTime: string;
}

interface Manual {
    model: string;
    brand: string;
    category: string;
    faultCodes: Record<string, string>;
    commonIssues: Array<{
        issue: string;
        causes: string[];
        diagnosis: string;
        solutions: string[];
    }>;
    parts: Array<{
        partNumber: string;
        name: string;
        price: string;
    }>;
}

interface KnowledgeBase {
    faultCodes: FaultCode[];
    manuals: Manual[];
}

import { cacheFaultCodes, getCachedFaultCodes, cacheManual, getCachedManual, STORES, getCachedGeneral, cacheGeneral } from './offlineStorage';

const knowledge: KnowledgeBase = {
    faultCodes: [],
    manuals: []
};

let isInitialized = false;

// Initialize knowledge base from JSON files
export async function initializeKnowledge(): Promise<void> {
    if (isInitialized) return;

    try {
        console.log('📚 Initializing knowledge base...');

        // 1. Try to load from Offline Cache first
        const cachedCodes = await getCachedFaultCodes();
        const cachedManuals = await getCachedGeneral<Manual[]>('all_manuals'); // Storing manuals list in general cache for now

        if (cachedCodes && cachedManuals) {
            console.log(`✅ Loaded knowledge from offline cache (${cachedCodes.length} codes, ${cachedManuals.length} manuals)`);
            knowledge.faultCodes = cachedCodes;
            knowledge.manuals = cachedManuals;
            isInitialized = true;

            // Background refresh (optional: strictly offline-first means we might skip network if cache exists)
            // For now, let's try to update in background without blocking
            refreshKnowledgeFromNetwork().catch(err => console.warn('Background refresh failed', err));
            return;
        }

        // 2. If no cache, fetch from network
        await refreshKnowledgeFromNetwork();

    } catch (error) {
        console.error('❌ Failed to load local knowledge:', error);
        isInitialized = true; // Don't block app
    }
}

async function refreshKnowledgeFromNetwork(): Promise<void> {
    console.log('🌐 Fetching knowledge from network...');

    const [faultCodesRes, manualsRes] = await Promise.all([
        fetch('/knowledge/fault_codes.json'),
        fetch('/knowledge/manuals.json')
    ]);

    if (!faultCodesRes.ok || !manualsRes.ok) {
        console.warn('⚠️ Knowledge files not found on server');
        return;
    }

    const faultCodesData = await faultCodesRes.json();
    const manualsData = await manualsRes.json();

    const newCodes = faultCodesData.codes || [];
    const newManuals = manualsData.manuals || [];

    knowledge.faultCodes = newCodes;
    knowledge.manuals = newManuals;
    isInitialized = true;

    // Update Cache
    await Promise.all([
        cacheFaultCodes(newCodes),
        cacheGeneral('all_manuals', newManuals, 30 * 24 * 60 * 60 * 1000) // 30 days
    ]);

    console.log(`✅ Network sync complete: ${newCodes.length} codes, ${newManuals.length} manuals`);
}


// Search for a specific fault code
export function searchFaultCode(code: string): FaultCode | undefined {
    return knowledge.faultCodes.find(fc =>
        fc.code.toUpperCase() === code.toUpperCase()
    );
}

// Search for equipment manual by model name
export function searchManual(model: string): Manual | undefined {
    const modelLower = model.toLowerCase();
    return knowledge.manuals.find(m =>
        m.model.toLowerCase().includes(modelLower) ||
        m.brand.toLowerCase().includes(modelLower)
    );
}

// Search all knowledge for a query
export function searchAllKnowledge(query: string): {
    faultCodes: FaultCode[];
    manuals: Manual[];
} {
    const queryLower = query.toLowerCase();

    const matchingCodes = knowledge.faultCodes.filter(fc =>
        fc.code.toLowerCase().includes(queryLower) ||
        fc.description.toLowerCase().includes(queryLower) ||
        fc.diagnosis.toLowerCase().includes(queryLower) ||
        fc.commonCauses.some(cause => cause.toLowerCase().includes(queryLower))
    );

    const matchingManuals = knowledge.manuals.filter(m =>
        m.model.toLowerCase().includes(queryLower) ||
        m.brand.toLowerCase().includes(queryLower) ||
        m.commonIssues.some(issue =>
            issue.issue.toLowerCase().includes(queryLower) ||
            issue.causes.some(cause => cause.toLowerCase().includes(queryLower))
        )
    );

    return {
        faultCodes: matchingCodes,
        manuals: matchingManuals
    };
}

// Get all fault codes for a specific model
export function getFaultCodesForModel(model: string): FaultCode[] {
    const modelLower = model.toLowerCase();
    return knowledge.faultCodes.filter(fc =>
        fc.models.some(m => m.toLowerCase().includes(modelLower))
    );
}

// Get knowledge base statistics
export function getKnowledgeStats() {
    return {
        faultCodesCount: knowledge.faultCodes.length,
        manualsCount: knowledge.manuals.length,
        isInitialized
    };
}

export type { FaultCode, Manual };
