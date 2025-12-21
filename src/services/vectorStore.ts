/**
 * Vector Store
 * IndexedDB-based vector storage for semantic search
 */

import { cosineSimilarity, EMBEDDING_DIMENSION } from './embeddingService';

const DB_NAME = 'OscarVectorDB';
const DB_VERSION = 1;
const STORE_NAME = 'vectors';

interface VectorDocument {
    id: string;
    content: string;
    embedding: number[];
    source: string;
    pageNumber?: number;
    position?: number;
    createdAt: string;
}

interface SearchResult {
    id: string;
    content: string;
    source: string;
    score: number;
    pageNumber?: number;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize IndexedDB connection
 */
async function getDB(): Promise<IDBDatabase> {
    if (dbInstance) return dbInstance;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[VectorStore] Failed to open database');
            reject(request.error);
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('source', 'source', { unique: false });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };
    });
}

/**
 * Add a document with its embedding to the store
 */
export async function addDocument(
    id: string,
    content: string,
    embedding: number[],
    source: string,
    pageNumber?: number,
    position?: number
): Promise<void> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        const doc: VectorDocument = {
            id,
            content,
            embedding,
            source,
            pageNumber,
            position,
            createdAt: new Date().toISOString()
        };

        const request = store.put(doc);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Add multiple documents (batch insert)
 */
export async function addDocuments(docs: Array<{
    id: string;
    content: string;
    embedding: number[];
    source: string;
    pageNumber?: number;
    position?: number;
}>): Promise<void> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        for (const doc of docs) {
            store.put({
                ...doc,
                createdAt: new Date().toISOString()
            });
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Search for similar documents using cosine similarity
 */
export async function search(
    queryEmbedding: number[],
    topK: number = 5,
    sourceFilter?: string
): Promise<SearchResult[]> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const docs: VectorDocument[] = request.result;

            // Calculate similarities
            let results: SearchResult[] = docs
                .filter(doc => !sourceFilter || doc.source.includes(sourceFilter))
                .map(doc => ({
                    id: doc.id,
                    content: doc.content,
                    source: doc.source,
                    pageNumber: doc.pageNumber,
                    score: cosineSimilarity(queryEmbedding, doc.embedding)
                }))
                .filter(r => r.score > 0.3) // Minimum relevance threshold
                .sort((a, b) => b.score - a.score)
                .slice(0, topK);

            resolve(results);
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Delete a document by ID
 */
export async function deleteDocument(id: string): Promise<void> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Delete all documents from a specific source
 */
export async function deleteBySource(source: string): Promise<void> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('source');
        const request = index.getAll(IDBKeyRange.only(source));

        request.onsuccess = () => {
            const docs: VectorDocument[] = request.result;
            for (const doc of docs) {
                store.delete(doc.id);
            }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Get count of documents in store
 */
export async function getDocumentCount(): Promise<number> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Clear all documents
 */
export async function clearAll(): Promise<void> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export type { VectorDocument, SearchResult };
