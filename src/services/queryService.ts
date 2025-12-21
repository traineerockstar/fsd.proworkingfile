/**
 * Query Service
 * Expands and refines user queries for better RAG retrieval
 */

// FSE-specific synonym mappings
const SYNONYM_MAP: Record<string, string[]> = {
    // Symptoms
    'not heating': ['no heat', 'cold', 'heating element', 'thermostat', 'NTC'],
    'not spinning': ['drum not turning', 'motor', 'belt', 'carbon brushes'],
    'not draining': ['water not draining', 'pump', 'blockage', 'filter'],
    'leaking': ['water leak', 'seal', 'gasket', 'door seal', 'pump seal'],
    'noisy': ['loud noise', 'banging', 'grinding', 'bearing', 'drum spider'],
    'not starting': ['won\'t start', 'no power', 'door lock', 'PCB', 'control board'],
    'error code': ['fault code', 'error', 'fault', 'E', 'F'],
    'tripping': ['trips', 'RCD', 'fuse', 'short circuit'],

    // Appliances
    'washer': ['washing machine', 'WM', 'laundry'],
    'dryer': ['tumble dryer', 'TD', 'clothes dryer'],
    'dishwasher': ['DW', 'dish washer'],
    'fridge': ['refrigerator', 'freezer', 'FF', 'fridge freezer'],

    // Parts
    'motor': ['drive motor', 'brushless motor', 'inverter motor'],
    'pump': ['drain pump', 'circulation pump', 'water pump'],
    'belt': ['drive belt', 'drum belt', 'poly-v belt'],
    'element': ['heating element', 'heater', 'tubular heater'],
    'board': ['PCB', 'control board', 'main board', 'module'],
    'sensor': ['NTC', 'temperature sensor', 'pressure switch'],
    'seal': ['door seal', 'gasket', 'boot', 'rubber seal'],

    // Brands
    'hoover': ['HOOVER', 'Candy', 'CANDY'],
    'candy': ['CANDY', 'Hoover', 'HOOVER'],
    'haier': ['HAIER'],
    'bosch': ['BOSCH', 'Siemens', 'SIEMENS'],
    'samsung': ['SAMSUNG'],
    'lg': ['LG'],
};

// Common fault code patterns
const FAULT_CODE_PATTERNS = [
    /\b([EF]\d{1,3})\b/gi,       // E5, F3, E123
    /\bE-?\d{1,3}\b/gi,         // E-5, E5
    /\bErr\s*\d{1,3}\b/gi,      // Err 5, Err05
    /\bError\s*\d{1,3}\b/gi,    // Error 5
];

/**
 * Extract fault codes from query
 */
export function extractFaultCodes(query: string): string[] {
    const codes: string[] = [];

    for (const pattern of FAULT_CODE_PATTERNS) {
        const matches = query.match(pattern);
        if (matches) {
            for (const match of matches) {
                // Normalize to uppercase, remove spaces/dashes
                const normalized = match.toUpperCase().replace(/[\s-]/g, '');
                if (!codes.includes(normalized)) {
                    codes.push(normalized);
                }
            }
        }
    }

    return codes;
}

/**
 * Expand query with synonyms
 */
export function expandWithSynonyms(query: string): string[] {
    const queryLower = query.toLowerCase();
    const expansions: string[] = [];

    for (const [term, synonyms] of Object.entries(SYNONYM_MAP)) {
        if (queryLower.includes(term)) {
            expansions.push(...synonyms);
        }
    }

    return [...new Set(expansions)]; // Deduplicate
}

/**
 * Main query expansion function
 * Returns expanded query string for better retrieval
 */
export function expandQuery(query: string): string {
    const parts: string[] = [query];

    // 1. Extract and add fault codes explicitly
    const faultCodes = extractFaultCodes(query);
    if (faultCodes.length > 0) {
        parts.push(`Fault codes: ${faultCodes.join(', ')}`);
    }

    // 2. Add synonym expansions
    const synonyms = expandWithSynonyms(query);
    if (synonyms.length > 0) {
        // Limit to top 5 most relevant
        const relevantSynonyms = synonyms.slice(0, 5);
        parts.push(`Related terms: ${relevantSynonyms.join(', ')}`);
    }

    console.log(`[QueryService] Expanded: "${query}" -> "${parts.join(' | ')}"`);
    return parts.join(' | ');
}

/**
 * Analyze query intent for better routing
 */
export function analyzeQueryIntent(query: string): {
    hasFaultCode: boolean;
    isPartsQuery: boolean;
    isDiagnostic: boolean;
    extractedInfo: {
        faultCodes: string[];
        appliances: string[];
        symptoms: string[];
    };
} {
    const queryLower = query.toLowerCase();
    const faultCodes = extractFaultCodes(query);

    // Check for parts-related keywords
    const partsKeywords = ['part number', 'part no', 'price', 'order', 'stock', 'buy', 'where to get'];
    const isPartsQuery = partsKeywords.some(kw => queryLower.includes(kw));

    // Check for diagnostic keywords
    const diagnosticKeywords = ['why', 'cause', 'fix', 'diagnose', 'problem', 'issue', 'error', 'fault', 'not working'];
    const isDiagnostic = diagnosticKeywords.some(kw => queryLower.includes(kw)) || faultCodes.length > 0;

    // Extract appliances mentioned
    const applianceKeywords = ['washer', 'washing machine', 'dryer', 'tumble dryer', 'dishwasher', 'fridge', 'freezer', 'oven', 'hob'];
    const appliances = applianceKeywords.filter(app => queryLower.includes(app));

    // Extract symptoms mentioned
    const symptomKeywords = ['not heating', 'not spinning', 'not draining', 'leaking', 'noisy', 'not starting', 'tripping', 'won\'t start'];
    const symptoms = symptomKeywords.filter(sym => queryLower.includes(sym));

    return {
        hasFaultCode: faultCodes.length > 0,
        isPartsQuery,
        isDiagnostic,
        extractedInfo: {
            faultCodes,
            appliances,
            symptoms
        }
    };
}

/**
 * Generate search terms for vector search
 */
export function generateSearchTerms(query: string): string[] {
    const terms: string[] = [query];
    const analysis = analyzeQueryIntent(query);

    // Add fault codes as separate terms
    terms.push(...analysis.extractedInfo.faultCodes);

    // Add appliances
    terms.push(...analysis.extractedInfo.appliances);

    // Add symptoms
    terms.push(...analysis.extractedInfo.symptoms);

    // Add expanded synonyms
    terms.push(...expandWithSynonyms(query));

    return [...new Set(terms)].filter(t => t.length > 1);
}
