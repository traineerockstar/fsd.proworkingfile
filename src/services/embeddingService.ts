/**
 * Embedding Service
 * Uses Gemini text-embedding-004 for semantic vector generation
 */

import { GoogleGenAI } from '@google/genai';

// @ts-ignore
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

const ai = new GoogleGenAI({ apiKey: API_KEY });

const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIMENSION = 768; // text-embedding-004 outputs 768 dimensions

/**
 * Generate embedding vector for a single text
 */
export async function embedText(text: string): Promise<number[]> {
    try {
        const result = await ai.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: [{ role: 'user', parts: [{ text }] }]
        });

        if (result.embeddings && result.embeddings.length > 0) {
            return result.embeddings[0].values || [];
        }

        console.warn('[EmbeddingService] No embedding returned');
        return [];
    } catch (error) {
        console.error('[EmbeddingService] Error generating embedding:', error);
        return [];
    }
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
    try {
        const results = await Promise.all(texts.map(text => embedText(text)));
        return results;
    } catch (error) {
        console.error('[EmbeddingService] Batch embedding error:', error);
        return texts.map(() => []);
    }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export { EMBEDDING_DIMENSION };
