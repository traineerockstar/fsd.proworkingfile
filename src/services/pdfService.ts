/**
 * PDF Service - Extracts text from PDF blobs using pdfjs-dist
 */
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source (required for pdfjs-dist to work)
// Using the CDN version for simplicity in a Vite environment
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Extracts all text content from a PDF blob.
 * @param pdfBlob - The PDF file as a Blob.
 * @returns A promise that resolves to the extracted text string.
 */
export async function extractTextFromPdf(pdfBlob: Blob): Promise<string> {
    try {
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';
        const numPages = pdf.numPages;

        console.log(`[pdfService] Parsing PDF with ${numPages} pages...`);

        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            fullText += `\n--- PAGE ${i} ---\n${pageText}`;
        }

        console.log(`[pdfService] Extracted ${fullText.length} characters.`);
        return fullText;
    } catch (error) {
        console.error('[pdfService] Error extracting text from PDF:', error);
        return '';
    }
}

/**
 * Extracts text from a PDF, truncated to a maximum character count.
 * Useful for LLM context windows.
 * @param pdfBlob - The PDF file as a Blob.
 * @param maxChars - Maximum characters to return (default 20000).
 * @returns A promise that resolves to the truncated text string.
 */
export async function extractTextFromPdfTruncated(pdfBlob: Blob, maxChars: number = 20000): Promise<string> {
    const fullText = await extractTextFromPdf(pdfBlob);
    if (fullText.length > maxChars) {
        console.log(`[pdfService] Truncating from ${fullText.length} to ${maxChars} chars.`);
        return fullText.substring(0, maxChars) + '\n...[TRUNCATED]';
    }
    return fullText;
}
