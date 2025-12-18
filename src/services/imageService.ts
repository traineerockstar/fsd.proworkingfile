
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY;
const SEARCH_ENGINE_ID = import.meta.env.VITE_GOOGLE_SEARCH_CX;

export const imageService = {
    searchProductImage: async (query: string): Promise<string | null> => {
        if (!GOOGLE_API_KEY || !SEARCH_ENGINE_ID) {
            console.warn("Skipping Image Search: API Key or CX not set.");
            // Return a placeholder or null
            return null;
        }

        try {
            const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&cx=${SEARCH_ENGINE_ID}&key=${GOOGLE_API_KEY}&searchType=image&num=1`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.items && data.items.length > 0) {
                return data.items[0].link;
            }
        } catch (e) {
            console.error("Image Search Error:", e);
        }
        return null; // Fallback handled by UI
    }
};
