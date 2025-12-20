// Learning Service - Self-Improving Knowledge Base
// Stores successful fixes in localStorage and retrieves them for future reference

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

const STORAGE_KEY = 'oscar_learned_solutions';

// Load all learned solutions from localStorage
export function getLearnedSolutions(): LearnedSolution[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];

        const data = JSON.parse(stored);
        return data.solutions || [];
    } catch (error) {
        console.error('Error loading learned solutions:', error);
        return [];
    }
}

// Save solutions to localStorage
function saveSolutions(solutions: LearnedSolution[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ solutions }));
    } catch (error) {
        console.error('Error saving learned solutions:', error);
    }
}

// Calculate confidence level based on success count
function calculateConfidence(successCount: number): 'high' | 'medium' | 'low' {
    if (successCount >= 5) return 'high';
    if (successCount >= 2) return 'medium';
    return 'low';
}

// Record a new solution or increment existing one
export function recordSolution(
    solution: Omit<LearnedSolution, 'id' | 'successCount' | 'lastUsed' | 'confidence' | 'createdAt'>
): void {
    const solutions = getLearnedSolutions();
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

    saveSolutions(solutions);
}

// Find learned solutions for a specific fault code
export function findLearnedSolution(faultCode: string, model?: string): LearnedSolution[] {
    const solutions = getLearnedSolutions();
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

// Get all solutions for a specific model
export function getModelHistory(model: string): LearnedSolution[] {
    const solutions = getLearnedSolutions();
    const modelLower = model.toLowerCase();

    return solutions
        .filter(s => s.model.toLowerCase().includes(modelLower))
        .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
}

// Search learned solutions by symptoms or fix description
export function searchLearnedSolutions(query: string): LearnedSolution[] {
    const solutions = getLearnedSolutions();
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
    const solutions = getLearnedSolutions();

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
    const solutions = getLearnedSolutions();
    return JSON.stringify({ solutions, exportedAt: new Date().toISOString() }, null, 2);
}

// Import learnings from JSON string
export function importLearnings(jsonData: string): boolean {
    try {
        const data = JSON.parse(jsonData);
        if (!data.solutions || !Array.isArray(data.solutions)) {
            console.error('Invalid learnings data format');
            return false;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify({ solutions: data.solutions }));
        console.log(`✅ Imported ${data.solutions.length} solutions`);
        return true;
    } catch (error) {
        console.error('Error importing learnings:', error);
        return false;
    }
}

// Clear all learned solutions (use with caution!)
export function clearAllLearnings(): void {
    localStorage.removeItem(STORAGE_KEY);
    console.log('🗑️ All learned solutions cleared');
}

export type { LearnedSolution };
