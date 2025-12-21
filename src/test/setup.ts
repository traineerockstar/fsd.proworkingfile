// Test setup file
import '@testing-library/jest-dom';

// Mock IndexedDB for tests
const mockIndexedDB = {
    open: () => ({
        result: {
            objectStoreNames: { contains: () => false },
            createObjectStore: () => ({ createIndex: () => { } }),
            transaction: () => ({
                objectStore: () => ({
                    put: () => ({ onsuccess: null, onerror: null }),
                    get: () => ({ onsuccess: null, onerror: null }),
                    getAll: () => ({ onsuccess: null, onerror: null, result: [] }),
                    delete: () => ({ onsuccess: null, onerror: null }),
                    count: () => ({ onsuccess: null, onerror: null, result: 0 }),
                    clear: () => ({ onsuccess: null, onerror: null }),
                    index: () => ({ getAll: () => ({ onsuccess: null, onerror: null, result: [] }) })
                }),
                oncomplete: null,
                onerror: null
            })
        },
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null
    })
};

// @ts-ignore
global.indexedDB = mockIndexedDB;

// Mock fetch for API calls in tests
global.fetch = vi.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
        blob: () => Promise.resolve(new Blob())
    })
) as any;

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
};
global.localStorage = localStorageMock;

// Suppress console.log in tests unless debugging
const originalLog = console.log;
console.log = (...args: any[]) => {
    if (process.env.DEBUG_TESTS) {
        originalLog(...args);
    }
};
