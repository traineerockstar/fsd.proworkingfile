/**
 * Chunking Service
 * Splits documents into optimally-sized chunks for RAG retrieval
 */

export interface Chunk {
    id: string;
    content: string;
    tokenCount: number;
    source: string;
    pageNumber?: number;
    position: number; // Position within original document
}

// Rough token estimation (4 chars ≈ 1 token)
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Split text into chunks with overlap
 * @param text - Full text to chunk
 * @param source - Source document name
 * @param maxTokens - Maximum tokens per chunk (default 500)
 * @param overlapTokens - Overlap between chunks (default 50)
 */
export function chunkText(
    text: string,
    source: string,
    maxTokens: number = 500,
    overlapTokens: number = 50
): Chunk[] {
    const chunks: Chunk[] = [];
    const maxChars = maxTokens * 4; // Approximate character limit
    const overlapChars = overlapTokens * 4;

    // Split by natural boundaries (paragraphs, then sentences)
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';
    let position = 0;

    for (const paragraph of paragraphs) {
        const trimmedPara = paragraph.trim();
        if (!trimmedPara) continue;

        // If paragraph itself is too long, split by sentences
        if (estimateTokens(trimmedPara) > maxTokens) {
            // Flush current chunk first
            if (currentChunk.trim()) {
                chunks.push({
                    id: `${source}_chunk_${chunks.length}`,
                    content: currentChunk.trim(),
                    tokenCount: estimateTokens(currentChunk),
                    source,
                    position: position++
                });
                currentChunk = '';
            }

            // Split long paragraph by sentences
            const sentences = trimmedPara.match(/[^.!?]+[.!?]+/g) || [trimmedPara];
            for (const sentence of sentences) {
                if (estimateTokens(currentChunk + sentence) > maxTokens) {
                    if (currentChunk.trim()) {
                        chunks.push({
                            id: `${source}_chunk_${chunks.length}`,
                            content: currentChunk.trim(),
                            tokenCount: estimateTokens(currentChunk),
                            source,
                            position: position++
                        });
                        // Keep overlap from end of previous chunk
                        currentChunk = currentChunk.slice(-overlapChars) + ' ';
                    }
                }
                currentChunk += sentence + ' ';
            }
        } else {
            // Check if adding this paragraph would exceed limit
            if (estimateTokens(currentChunk + trimmedPara) > maxTokens) {
                // Save current chunk and start new one with overlap
                if (currentChunk.trim()) {
                    chunks.push({
                        id: `${source}_chunk_${chunks.length}`,
                        content: currentChunk.trim(),
                        tokenCount: estimateTokens(currentChunk),
                        source,
                        position: position++
                    });
                    // Keep overlap from end of previous chunk
                    currentChunk = currentChunk.slice(-overlapChars) + '\n\n';
                }
            }
            currentChunk += trimmedPara + '\n\n';
        }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
        chunks.push({
            id: `${source}_chunk_${chunks.length}`,
            content: currentChunk.trim(),
            tokenCount: estimateTokens(currentChunk),
            source,
            position: position
        });
    }

    console.log(`[ChunkingService] Split "${source}" into ${chunks.length} chunks`);
    return chunks;
}

/**
 * PDF-aware chunking that preserves page markers
 */
export function chunkPdf(pdfText: string, sourceName: string): Chunk[] {
    const chunks: Chunk[] = [];

    // Split by page markers from pdfService (--- PAGE N ---)
    const pageRegex = /--- PAGE (\d+) ---/g;
    const pages: { pageNum: number; content: string }[] = [];

    let lastIndex = 0;
    let match;
    let currentPageNum = 1;

    while ((match = pageRegex.exec(pdfText)) !== null) {
        if (lastIndex > 0 || match.index > 0) {
            const content = pdfText.slice(lastIndex, match.index).trim();
            if (content) {
                pages.push({ pageNum: currentPageNum, content });
            }
        }
        currentPageNum = parseInt(match[1], 10);
        lastIndex = match.index + match[0].length;
    }

    // Add remaining content after last page marker
    if (lastIndex < pdfText.length) {
        const content = pdfText.slice(lastIndex).trim();
        if (content) {
            pages.push({ pageNum: currentPageNum, content });
        }
    }

    // Chunk each page
    for (const page of pages) {
        const pageChunks = chunkText(page.content, sourceName, 500, 50);
        for (const chunk of pageChunks) {
            chunk.pageNumber = page.pageNum;
            chunk.id = `${sourceName}_p${page.pageNum}_chunk_${chunks.length}`;
            chunks.push(chunk);
        }
    }

    if (chunks.length === 0) {
        // Fallback: if no page markers, treat as plain text
        return chunkText(pdfText, sourceName, 500, 50);
    }

    console.log(`[ChunkingService] PDF "${sourceName}" chunked into ${chunks.length} chunks across ${pages.length} pages`);
    return chunks;
}

export { estimateTokens };
