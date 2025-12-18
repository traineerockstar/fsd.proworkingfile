
export const exportToGoogleSheets = async (data: any[], scriptUrl: string) => {
    try {
        const response = await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors', // Typical for RAS execution
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        // With no-cors we can't check response.ok, so we assume success if no network error
        console.log("Export request sent to Google Sheets Script");
        return true;
    } catch (error) {
        console.error("Failed to export to sheets:", error);
        throw error;
    }
};
