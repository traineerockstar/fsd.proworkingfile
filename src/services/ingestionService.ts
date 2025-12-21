
import { processFieldDataFromImages, classifyDocument } from './geminiService';
import { listFilesInFolder, getFileBase64 } from './googleDriveService';
import { Job } from '../context/JobContext';
import { v4 as uuidv4 } from 'uuid';
import { DRIVE_FOLDERS } from './driveConfig';

const INPUT_FOLDER = DRIVE_FOLDERS.INPUT_SCREENSHOTS;

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

// 2b. Classification Interface
interface FileWithClassification {
    id: string;
    base64: string;
    type: string;
}

export const processScheduleImages = async (accessToken: string, fileIds: string[]): Promise<StructuredSchedule> => {
    // 1. Download images
    const rawImages = await Promise.all(fileIds.map(async id => {
        const base64 = await getFileBase64(accessToken, id);
        return { id, base64 };
    }));

    // 2. Classify & Filter
    console.log("[@Ingestion-Agent]: Classifying documents...");
    const validImages: string[] = [];

    for (const img of rawImages) {
        // Use the new classification tool
        const analysis = await classifyDocument(img.base64);
        console.log(`File ${img.id} classified as: ${analysis.docType} (${analysis.summary})`);

        if (['SCHEDULE', 'JOB_SHEET'].includes(analysis.docType)) {
            validImages.push(img.base64);
        } else {
            console.warn(`Skipping ${analysis.docType}: Not a schedule or job sheet.`);
            // TODO: Move to Knowledge Folder if MANUAL
        }
    }

    if (validImages.length === 0) {
        console.warn("No valid schedule/job images found.");
        return { jobs: [], date: new Date().toISOString().split('T')[0] };
    }

    // 3. Process Valid Images
    // Note: We are reusing standard processFieldDataFromImages. 
    // Ideally we might want a new tailored prompt for "Schedule Mode" if the main one is too focused on single job cards,
    // but the main prompt IS designed for Schedule + Jobs loop.
    // However, here we might be feeding it just schedule screenshots.
    // Let's assume the user dumps EVERYTHING (Schedule + Job Cards) into the input folder.

    // For MVP, lets assume the Gemini Service handles the "bulk" logic as described in its Master Prompt.
    const processedData = await processFieldDataFromImages(validImages);

    // 3. Convert Gemini Data Table to Job Objects
    // The Gemini service returns a 'dataTable' string (markdown) and 'notifications'.
    // We need to parse that markdown table into Job objects.

    const initialSchedule = parseGeminiResponseToJobs(processedData);

    // 4. Enrich with Fault Analysis
    const enrichedJobs = await enrichJobsWithAnalysis(initialSchedule.jobs, accessToken);

    return { ...initialSchedule, jobs: enrichedJobs };
};

export const processManualScheduleImages = async (base64Images: string[], accessToken?: string): Promise<StructuredSchedule> => {
    // Direct processing for manual uploads
    const processedData = await processFieldDataFromImages(base64Images);
    const initialSchedule = parseGeminiResponseToJobs(processedData);

    if (accessToken) {
        const enrichedJobs = await enrichJobsWithAnalysis(initialSchedule.jobs, accessToken);
        return { ...initialSchedule, jobs: enrichedJobs };
    }

    return initialSchedule;
};

export const parseGeminiResponseToJobs = (data: any): StructuredSchedule => {
    if (!data.service_appointments || !Array.isArray(data.service_appointments)) {
        console.warn("Invalid Gemini response format", data);
        return { jobs: [], date: new Date().toISOString().split('T')[0] };
    }

    let startTime = "08:00"; // Default start for first job

    // Extract date from root or fallback
    let extractedDate = data.schedule_date || new Date().toISOString().split('T')[0];

    // Validate Year Logic: fixing widely reported "wrong year" issue
    try {
        const dateObj = new Date(extractedDate);
        const currentYear = new Date().getFullYear();
        const extractedYear = dateObj.getFullYear();
        const currentMonth = new Date().getMonth(); // 0-11
        const extractedMonth = dateObj.getMonth();

        // If extracted year is not current year
        if (extractedYear !== currentYear) {
            // Exception: If we are in Dec (11) and extracted is Jan (0), allow next year (currentYear + 1)
            if (currentMonth === 11 && extractedMonth === 0 && extractedYear === currentYear + 1) {
                // This is valid (next year)
            } else {
                // Otherwise force current year
                console.warn(`[Ingestion] Correcting year from ${extractedYear} to ${currentYear}`);
                dateObj.setFullYear(currentYear);
                extractedDate = dateObj.toISOString().split('T')[0];
            }
        }
    } catch (e) {
        console.error("Error validating date:", e);
    }

    const jobs = data.service_appointments.map((appt: any, index: number) => {
        // Calculate Time Slots (Naive Chain)
        // If extracted "original_time_slot" exists, maybe we prioritize that? 
        let finalTimeSlot = "";

        if (appt.original_time_slot && appt.original_time_slot.length > 3) {
            finalTimeSlot = appt.original_time_slot;
            // Update our running startTime to the end of this extracted slot for the next fallback if needed
            // Simple hack: if it looks like "HH:MM - HH:MM", take the second part
            const parts = appt.original_time_slot.split('-');
            if (parts.length > 1) {
                startTime = parts[1].trim();
            }
        } else {
            // Fallback to calculation
            const endTime = addHours(startTime, 1);
            const calcEndTime = addHours(startTime, 2);
            finalTimeSlot = `${startTime} - ${calcEndTime}`;
            // Advance Time
            startTime = calcEndTime;
        }

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

        // Advance Time logic moved inside conditional above

        return job;
    });

    // 4. AUTO-DIAGNOSIS (Phase 1 AI)
    // We can't await this inside the map lightly if it takes too long, 
    // but for "Job Creation", users expect a spinner.
    // Ideally we run this in parallel for all jobs.

    // NOTE: This requires accessToken which we don't have here easily without modifying signature.
    // TEMPORARY FIX: We will return the Jobs, and let the UI or Context trigger the enrichment.
    // OR we pass token. 
    // Looking at `processScheduleImages`, it HAS `accessToken`.
    // But `parseGeminiResponseToJobs` is a pure function.
    // Let's modify `processScheduleImages` to run the enrichment after parsing.

    return { jobs, date: extractedDate };
};

// HELPER: Enrich Jobs with AI Analysis
export const enrichJobsWithAnalysis = async (jobs: Job[], accessToken: string): Promise<Job[]> => {
    if (!accessToken) return jobs;

    // Import dynamically to avoid circular deps if any
    const { generateFaultDiagnosis } = await import('./geminiService');

    console.log(`[@Ingestion-Agent]: Enriching ${jobs.length} jobs with AI Diagnosis...`);

    const enrichedJobs = await Promise.all(jobs.map(async (job) => {
        // Only analyze if there's something to analyze
        if (job.engineerNotes && job.engineerNotes.length > 5) {
            const analysis = await generateFaultDiagnosis(job, accessToken);
            if (analysis) {
                return { ...job, aiAnalysis: analysis };
            }
        }
        return job;
    }));

    return enrichedJobs;
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
