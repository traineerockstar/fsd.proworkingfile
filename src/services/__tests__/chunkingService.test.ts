import { describe, it, expect } from 'vitest';
import { chunkText, chunkPdf, estimateTokens, type Chunk } from '../chunkingService';

describe('chunkingService', () => {
    describe('estimateTokens', () => {
        it('should estimate roughly 4 chars per token', () => {
            expect(estimateTokens('')).toBe(0);
            expect(estimateTokens('test')).toBe(1);
            expect(estimateTokens('hello world!')).toBe(3); // 12 chars / 4 = 3
            expect(estimateTokens('a'.repeat(100))).toBe(25);
        });
    });

    describe('chunkText', () => {
        it('should return single chunk for short text', () => {
            const text = 'This is a short text.';
            const chunks = chunkText(text, 'test-source');

            expect(chunks.length).toBe(1);
            expect(chunks[0].content).toBe(text);
            expect(chunks[0].source).toBe('test-source');
            expect(chunks[0].position).toBe(0);
        });

        it('should split long text into multiple chunks', () => {
            // Create text that exceeds 500 tokens (~2000 chars)
            const longParagraph = 'This is a sentence that repeats. '.repeat(100);
            const chunks = chunkText(longParagraph, 'long-source', 500, 50);

            expect(chunks.length).toBeGreaterThan(1);
            expect(chunks.every(c => estimateTokens(c.content) <= 600)).toBe(true); // Allow some buffer
        });

        it('should preserve paragraph structure', () => {
            const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
            const chunks = chunkText(text, 'structured', 1000, 0);

            // Should be single chunk since it fits
            expect(chunks.length).toBe(1);
            expect(chunks[0].content).toContain('First paragraph');
            expect(chunks[0].content).toContain('Second paragraph');
        });

        it('should assign unique IDs to each chunk', () => {
            const text = 'Short.\n\n'.repeat(50);
            const chunks = chunkText(text, 'ids-test', 100, 0);

            const ids = chunks.map(c => c.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });
    });

    describe('chunkPdf', () => {
        it('should handle PDF with page markers', () => {
            const pdfText = `--- PAGE 1 ---
Content on page 1.

--- PAGE 2 ---
Content on page 2.

--- PAGE 3 ---
Content on page 3.`;

            const chunks = chunkPdf(pdfText, 'test.pdf');

            expect(chunks.length).toBeGreaterThanOrEqual(3);
            expect(chunks.some(c => c.pageNumber === 1)).toBe(true);
            expect(chunks.some(c => c.pageNumber === 2)).toBe(true);
            expect(chunks.some(c => c.pageNumber === 3)).toBe(true);
        });

        it('should fallback to regular chunking without page markers', () => {
            const plainText = 'Just some plain text without any page markers.';
            const chunks = chunkPdf(plainText, 'plain.pdf');

            expect(chunks.length).toBeGreaterThanOrEqual(1);
            expect(chunks[0].source).toBe('plain.pdf');
        });

        it('should create IDs with page numbers', () => {
            const pdfText = `--- PAGE 5 ---
Some content here.`;

            const chunks = chunkPdf(pdfText, 'numbered.pdf');

            expect(chunks[0].id).toContain('p5');
            expect(chunks[0].pageNumber).toBe(5);
        });
    });
});
