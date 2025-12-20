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

const knowledge: KnowledgeBase = {
    faultCodes: [],
    manuals: []
};

let isInitialized = false;

// Initialize knowledge base from JSON files
export async function initializeKnowledge(): Promise<void> {
    if (isInitialized) return;

    try {
        console.log('📚 Loading local knowledge base...');

        const [faultCodesRes, manualsRes] = await Promise.all([
            fetch('/knowledge/fault_codes.json'),
            fetch('/knowledge/manuals.json')
        ]);

        if (!faultCodesRes.ok || !manualsRes.ok) {
            console.warn('⚠️ Knowledge files not found, using empty knowledge base');
            isInitialized = true;
            return;
        }

        const faultCodesData = await faultCodesRes.json();
        const manualsData = await manualsRes.json();

        knowledge.faultCodes = faultCodesData.codes || [];
        knowledge.manuals = manualsData.manuals || [];

        console.log(`✅ Loaded ${knowledge.faultCodes.length} fault codes and ${knowledge.manuals.length} manuals`);
        isInitialized = true;
    } catch (error) {
        console.error('❌ Failed to load local knowledge:', error);
        isInitialized = true; // Don't block app if knowledge fails to load
    }
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
