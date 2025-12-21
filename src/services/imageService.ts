
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY;
const SEARCH_ENGINE_ID = import.meta.env.VITE_GOOGLE_SEARCH_CX;

const CACHE_KEY = 'fsd_image_cache';

export const imageService = {
    searchProductImage: async (query: string): Promise<string | null> => {
        if (!query) return null;



        // 1. Check Cache
        try {
            const cacheRaw = localStorage.getItem(CACHE_KEY);
            const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
            if (cache[query]) {
                // console.log(`[ImageService] Cache Hit for: ${query}`);
                return cache[query];
            }
        } catch (e) {
            console.warn("Image Cache Read Error", e);
        }

        if (!GOOGLE_API_KEY || !SEARCH_ENGINE_ID) {
            console.warn("Skipping Image Search: API Key or CX not set.");
            return null;
        }

        // 2. Fetch from API
        try {
            const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&cx=${SEARCH_ENGINE_ID}&key=${GOOGLE_API_KEY}&searchType=image&num=1`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.items && data.items.length > 0) {
                const imageUrl = data.items[0].link;

                // 3. Save to Cache
                try {
                    const cacheRaw = localStorage.getItem(CACHE_KEY);
                    const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
                    cache[query] = imageUrl;
                    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
                } catch (e) {
                    console.warn("Image Cache Write Error", e);
                }

                return imageUrl;
            }
        } catch (e) {
            console.error("Image Search Error:", e);
        }
        return null;
    }
};
