
import { processFieldDataFromImages } from './geminiService';
import { listFilesInFolder, getFileBase64 } from './googleDriveService';
import { Job } from '../context/JobContext';
import { v4 as uuidv4 } from 'uuid';

const INPUT_FOLDER = 'INPUT_SCREENSHOTS';

export const scanInputFolder = async (accessToken: string): Promise<any[]> => {
    // 1. List files in 'INPUT_SCREENSHOTS' inside FSD_PRO_DATA
    const files = await listFilesInFolder(accessToken, INPUT_FOLDER);
    return files.filter(f => f.mimeType.startsWith('image/'));
};

const addHours = (timeStr: string, hours: number): string => {
    // Simple parser for HH:MM format
    // Assuming 24h format for now or standard time without AM/PM checks for MVP
    const [h, m] = timeStr.split(':').map(Number);
    let newH = h + hours;

    // Formatting back
    return `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export interface StructuredSchedule {
    jobs: Job[];
    date: string;
}

export const processScheduleImages = async (accessToken: string, fileIds: string[]): Promise<StructuredSchedule> => {
    // 1. Download images
    const base64Images = await Promise.all(fileIds.map(id => getFileBase64(accessToken, id)));

    // 2. Gemini Analysis
    // Note: We are reusing standard processFieldDataFromImages. 
    // Ideally we might want a new tailored prompt for "Schedule Mode" if the main one is too focused on single job cards,
    // but the main prompt IS designed for Schedule + Jobs loop.
    // However, here we might be feeding it just schedule screenshots.
    // Let's assume the user dumps EVERYTHING (Schedule + Job Cards) into the input folder.

    // For MVP, lets assume the Gemini Service handles the "bulk" logic as described in its Master Prompt.
    const processedData = await processFieldDataFromImages(base64Images);

    // 3. Convert Gemini Data Table to Job Objects
    // The Gemini service returns a 'dataTable' string (markdown) and 'notifications'.
    // We need to parse that markdown table into Job objects.

    return parseGeminiResponseToJobs(processedData);
};

export const processManualScheduleImages = async (base64Images: string[]): Promise<StructuredSchedule> => {
    // Direct processing for manual uploads
    const processedData = await processFieldDataFromImages(base64Images);
    return parseGeminiResponseToJobs(processedData);
};

export const parseGeminiResponseToJobs = (data: any): StructuredSchedule => {
    if (!data.service_appointments || !Array.isArray(data.service_appointments)) {
        console.warn("Invalid Gemini response format", data);
        return { jobs: [], date: new Date().toISOString().split('T')[0] };
    }

    let startTime = "08:00"; // Default start for first job

    // Extract date from root or fallback
    const extractedDate = data.schedule_date || new Date().toISOString().split('T')[0];

    const jobs = data.service_appointments.map((appt: any, index: number) => {
        // Calculate Time Slots (Naive Chain)
        // If extracted "original_time_slot" exists, maybe we prioritize that? 
        // For now, adhering to the "Layout Analysis" rule that "Time" is TBD/Blank and we define it.
        const endTime = addHours(startTime, 1); // 1 Hour slots default based on user preference? Or 2? Original code had 2. Let's stick to simple logic or just use what's there.
        // Let's use 2 hours as a safe standard for repairs.
        const calcEndTime = addHours(startTime, 2);

        const finalTimeSlot = `${startTime} - ${calcEndTime}`;

        // Prepare Job Structure
        const job: Job = {
            id: appt.service_appointment_id || uuidv4(),
            customerName: appt.customer_name || 'Unknown Customer',
            address: appt.address || 'Unknown Address',
            timeSlot: finalTimeSlot,
            status: 'pending',
            priority: appt.work_order?.status === 'In Progress' ? 'high' : 'normal',
            travelTime: '15 mins', // Placeholder

            // Product Details
            modelNumber: appt.asset?.asset_name || appt.asset?.product_id,
            serialNumber: appt.asset?.serial_number,
            detectedProduct: `${appt.asset?.brand || ''} ${appt.asset?.product_category || 'Appliance'}`,

            // Engineer Notes combining Fault and access info
            engineerNotes: `${appt.work_order?.subject || ''}: ${appt.work_order?.description || ''}`,

            // Store raw analysis data if needed (optional)
            // detectedProduct: appt.asset?.product_line
        };

        // Advance Time
        startTime = calcEndTime;

        return job;
    });

    return { jobs, date: extractedDate };
};

export const calculateGaps = (jobs: Job[]): { jobId: string, gapText: string }[] => {
    // Sort by start time
    // Return gaps between them
    // Placeholder logic
    return jobs.map((j, i) => {
        if (i === 0) return { jobId: j.id, gapText: 'Start of Day' };
        return { jobId: j.id, gapText: 'Gap: 45 mins' }; // logic to be refined with real Date objects
    });
};
