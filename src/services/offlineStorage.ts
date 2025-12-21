/**
 * Offline Storage Service
 * IndexedDB-based caching for offline-first operation
 */

const DB_NAME = 'OscarOfflineDB';
const DB_VERSION = 1;

interface CacheEntry<T> {
    key: string;
    data: T;
    cachedAt: string;
    expiresAt?: string;
}

let dbInstance: IDBDatabase | null = null;

// Store names
const STORES = {
    FAULT_CODES: 'faultCodes',
    MANUALS: 'manuals',
    SOLUTIONS: 'solutions',
    GENERAL: 'general'
} as const;

/**
 * Initialize IndexedDB connection
 */
async function getDB(): Promise<IDBDatabase> {
    if (dbInstance) return dbInstance;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[OfflineStorage] Failed to open database');
            reject(request.error);
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Create stores for different data types
            for (const storeName of Object.values(STORES)) {
                if (!db.objectStoreNames.contains(storeName)) {
                    const store = db.createObjectStore(storeName, { keyPath: 'key' });
                    store.createIndex('cachedAt', 'cachedAt', { unique: false });
                }
            }
        };
    });
}

/**
 * Store data in cache
 */
async function setCache<T>(storeName: string, key: string, data: T, ttlMs?: number): Promise<void> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        const entry: CacheEntry<T> = {
            key,
            data,
            cachedAt: new Date().toISOString(),
            expiresAt: ttlMs ? new Date(Date.now() + ttlMs).toISOString() : undefined
        };

        const request = store.put(entry);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get data from cache (returns null if expired or not found)
 */
async function getCache<T>(storeName: string, key: string): Promise<T | null> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => {
            const entry = request.result as CacheEntry<T> | undefined;

            if (!entry) {
                resolve(null);
                return;
            }

            // Check expiry
            if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
                // Entry expired, delete it
                const deleteTx = db.transaction(storeName, 'readwrite');
                deleteTx.objectStore(storeName).delete(key);
                resolve(null);
                return;
            }

            resolve(entry.data);
        };

        request.onerror = () => reject(request.error);
    });
}

// ============ Public API ============

/**
 * Cache fault codes for offline access
 */
export async function cacheFaultCodes(codes: any[]): Promise<void> {
    await setCache(STORES.FAULT_CODES, 'all_codes', codes, 7 * 24 * 60 * 60 * 1000); // 7 days TTL
    console.log(`[OfflineStorage] Cached ${codes.length} fault codes`);
}

/**
 * Get cached fault codes
 */
export async function getCachedFaultCodes(): Promise<any[] | null> {
    return getCache<any[]>(STORES.FAULT_CODES, 'all_codes');
}

/**
 * Cache a manual document
 */
export async function cacheManual(id: string, content: string, metadata?: object): Promise<void> {
    await setCache(STORES.MANUALS, id, { content, metadata }, 30 * 24 * 60 * 60 * 1000); // 30 days TTL
    console.log(`[OfflineStorage] Cached manual: ${id}`);
}

/**
 * Get cached manual
 */
export async function getCachedManual(id: string): Promise<{ content: string; metadata?: object } | null> {
    return getCache(STORES.MANUALS, id);
}

/**
 * Cache learned solutions
 */
export async function cacheSolutions(solutions: any[]): Promise<void> {
    await setCache(STORES.SOLUTIONS, 'learned_solutions', solutions, 24 * 60 * 60 * 1000); // 24 hours TTL
    console.log(`[OfflineStorage] Cached ${solutions.length} solutions`);
}

/**
 * Get cached solutions
 */
export async function getCachedSolutions(): Promise<any[] | null> {
    return getCache<any[]>(STORES.SOLUTIONS, 'learned_solutions');
}

/**
 * General purpose cache get/set
 */
export async function cacheGeneral<T>(key: string, data: T, ttlMs?: number): Promise<void> {
    await setCache(STORES.GENERAL, key, data, ttlMs);
}

export async function getCachedGeneral<T>(key: string): Promise<T | null> {
    return getCache<T>(STORES.GENERAL, key);
}

/**
 * Check if device is online
 */
export function isOnline(): boolean {
    return navigator.onLine;
}

/**
 * Clear all cached data
 */
export async function clearAllCache(): Promise<void> {
    const db = await getDB();

    return new Promise((resolve, reject) => {
        const storeNames = Object.values(STORES);
        const tx = db.transaction(storeNames, 'readwrite');

        for (const storeName of storeNames) {
            tx.objectStore(storeName).clear();
        }

        tx.oncomplete = () => {
            console.log('[OfflineStorage] Cache cleared');
            resolve();
        };
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<Record<string, number>> {
    const db = await getDB();
    const stats: Record<string, number> = {};

    for (const storeName of Object.values(STORES)) {
        const count = await new Promise<number>((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const request = tx.objectStore(storeName).count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        stats[storeName] = count;
    }

    return stats;
}

export { STORES };
