
// @ts-ignore
const API_KEY = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY || import.meta.env.VITE_GEMINI_API_KEY; // Fallback to Gemini Key if user reused it (rare but possible) or expects me to use it.
// Actually, Custom Search needs its own key usually, but often projects use one GMP Project key.
// @ts-ignore
const CX = import.meta.env.VITE_GOOGLE_SEARCH_CX || '0123456789:placeholder_cx'; // Placeholder

export interface WebResult {
    title: string;
    link: string;
    snippet: string;
    sourceType: 'web';
}

export const searchWeb = async (query: string): Promise<WebResult[]> => {
    if (!API_KEY || !CX) {
        console.warn("Web Search Missing Credentials");
        return [];
    }

    try {
        const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX}&q=${encodeURIComponent(query)}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error("Web Search API Error", response.statusText);
            return [];
        }

        const data = await response.json();

        if (!data.items) return [];

        return data.items.map((item: any) => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet,
            sourceType: 'web'
        })).slice(0, 3); // Top 3

    } catch (error) {
        console.error("Web Search Service Error:", error);
        return [];
    }
};
