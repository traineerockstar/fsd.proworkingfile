import {
    findOrCreateFolder,
    findSubfolder,
    exportSheetAsCsv,
    saveSPOTracking,
    loadSPOTracking,
    createFile,
    readFileContent
} from './googleDriveService';

// Interfaces based on the User's Script Logic
export interface SPOJob {
    id: string; // Unique ID (Name_Zip)
    name: string; // "Account"
    zip: string;  // "Post Code"
    sa: string;   // "Service Appointment" / "Code"
    jobStatus: string; // From Jobs File
    backupStatus: string; // From Parts File "Work Order Status"
    jobDate: string;
    parts: Omit<SPOPart, 'jobId'>[];
    category: 'DANGER' | 'READY' | 'WAITING' | 'HISTORY';
}

export interface SPOPart {
    desc: string;
    code: string;
    rawStatus: string;
    isArrived: boolean;
}

export interface TrafficReport {
    danger: SPOJob[];
    ready: SPOJob[];
    waiting: SPOJob[];
    history: SPOJob[];
    stats: {
        danger: number;
        ready: number;
        waiting: number;
        history: number;
    };
    lastUpdated: Date;
}

const FSD_DATA_FOLDER = 'FSD_PRO_DATA';
const SPO_DROP_FOLDER = 'SPO_DROPS';
const REPORT_FILE_NAME = 'spo_report_v2.json';

// Keywords from Script
const GOOD_PART_KEYWORDS = ['delivered', 'received', 'consumed', 'used', 'in stock', 'stock', 'picked', 'available', 'complete', 'arrived', 'depot'];
const CLOSED_KEYWORDS = ['complete', 'closed', 'done', 'cannot', 'cancel'];

export class SPOProcessor {
    accessToken: string;

    constructor(token: string) {
        this.accessToken = token;
    }

    // --- MAIN REPORT GENERATION ---

    async generateReport(): Promise<TrafficReport> {
        console.log("[SPOProcessor] Starting Traffic Control Report generation...");
        // Validated Fix

        // 1. Find Files
        const files = await this.findDropFiles();

        // RELAXED REQUIREMENT: Only Parts file is strictly required. 
        if (!files.partsFile) {
            throw new Error("Missing required '18836...' Parts file in 'SPO_DROPS' folder.");
        }

        console.log(`[SPOProcessor] Processing. Parts: ${files.partsFile.name}, Jobs: ${files.jobsFile?.name || "None (Parts Only Mode)"}`);

        // 2. Read & Parse
        let jobsCsv = "";
        let partsCsv = "";

        if (files.jobsFile) {
            [jobsCsv, partsCsv] = await Promise.all([
                exportSheetAsCsv(this.accessToken, files.jobsFile.id, files.jobsFile.mimeType),
                exportSheetAsCsv(this.accessToken, files.partsFile.id, files.partsFile.mimeType)
            ]);
        } else {
            partsCsv = await exportSheetAsCsv(this.accessToken, files.partsFile.id, files.partsFile.mimeType);
        }

        // 3. Build Job Map
        const jobMap = this.processJobsFile(jobsCsv);

        // 4. Process Parts & Merge
        const mergedJobs = this.processPartsFile(partsCsv, jobMap);

        // 5. Categorize
        const report = await this.categorizeJobs(mergedJobs);

        // 6. PERSIST Report
        await this.saveReport(report);

        return report;
    }

    // --- PERSISTENCE METHODS ---

    async saveReport(report: TrafficReport) {
        try {
            const dropId = await this.ensureDropFolder();

            // Delete existing cache if any (simple strategy)
            const existing = await this.findFileInFolder(dropId, REPORT_FILE_NAME);

            if (existing) {
                // Update existing file content
                await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(report)
                });
            } else {
                // Create new file
                const metadata = {
                    name: REPORT_FILE_NAME,
                    mimeType: 'application/json',
                    parents: [dropId]
                };
                await createFile(this.accessToken, metadata, report);
            }
            console.log("[SPOProcessor] Saved cache to Drive.");
        } catch (e) {
            console.error("[SPOProcessor] Failed to save cache:", e);
        }
    }

    async loadReport(): Promise<TrafficReport | null> {
        try {
            const dropId = await this.ensureDropFolder();
            const file = await this.findFileInFolder(dropId, REPORT_FILE_NAME);

            if (!file) return null;

            // Load saved report
            const cachedReport: TrafficReport = await readFileContent(this.accessToken, file.id);

            // RE-APPLY Tracking (Categorization updates) because "Manual Completion" lives in a separate tracking file
            const completedIds = await loadSPOTracking(this.accessToken);

            // Combine all jobs back into a single list
            const allJobs = [...cachedReport.ready, ...cachedReport.waiting, ...cachedReport.danger, ...cachedReport.history];

            // Re-run categorization to apply latest tracking status
            return await this.categorizeJobs(allJobs);

        } catch (e) {
            console.warn("[SPOProcessor] No cached report found or error loading:", e);
            return null;
        }
    }

    // --- FOLDER & FILE HELPERS ---

    async ensureDropFolder(): Promise<string> {
        const rootId = await findOrCreateFolder(this.accessToken);
        return await findSubfolder(this.accessToken, rootId, SPO_DROP_FOLDER);
    }

    private async findDropFiles() {
        const dropId = await this.ensureDropFolder();

        const query = `'${dropId}' in parents and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, createdTime, mimeType)&orderBy=createdTime desc`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${this.accessToken}` } });
        const data = await res.json();
        const files = data.files || [];

        let jobsFile = null;
        let partsFile = null;

        for (const f of files) {
            if (f.name.includes("Service Appointments") && !jobsFile) {
                jobsFile = f;
            }
            if (f.name.includes("18836") && !f.name.includes("~$") && !partsFile) {
                partsFile = f;
            }
        }

        return { jobsFile, partsFile };
    }

    private async findFileInFolder(folderId: string, name: string) {
        const query = `'${folderId}' in parents and name = '${name}' and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${this.accessToken}` } });
        const data = await res.json();
        return data.files && data.files.length > 0 ? data.files[0] : null;
    }

    // --- LOGIC PORT: JOB MAPPING ---
    private processJobsFile(csv: string): Map<string, any> {
        const lines = this.parseCSV(csv);
        const map = new Map<string, any>();

        const headerInfo = this.findHeaderRow(lines, ['customer', 'account', 'name'], ['status', 'appointment']);
        if (headerInfo.rowIdx === -1) return map;

        const { idx, rowIdx } = headerInfo;

        for (let i = rowIdx + 1; i < lines.length; i++) {
            const row = lines[i];
            const name = this.cleanName(row[idx.name]);
            const zip = this.cleanZip(row[idx.zip]);

            if (!name) continue;

            const key = `${name}_${zip}`;
            map.set(key, {
                status: (idx.status > -1 ? row[idx.status] : "").toLowerCase(),
                date: (idx.date > -1 ? row[idx.date] : ""),
                sa: (idx.sa > -1 ? row[idx.sa] : "").toString()
            });
        }
        return map;
    }

    // --- LOGIC PORT: PARTS PROCESSING ---
    private processPartsFile(csv: string, jobMap: Map<string, any>): SPOJob[] {
        const lines = this.parseCSV(csv);
        const jobs: Record<string, SPOJob> = {};

        const headerInfo = this.findHeaderRow(lines, ['customer', 'account', 'name'], ['status', 'line item status']);

        if (headerInfo.rowIdx === -1) {
            console.warn("Could not find headers in Parts file.");
            return [];
        }

        const { idx, rowIdx } = headerInfo;

        for (let i = rowIdx + 1; i < lines.length; i++) {
            const row = lines[i];
            const name = this.cleanName(row[idx.name]);
            const zip = this.cleanZip(row[idx.zip]);

            if (!name) continue;

            const partStatus = (idx.status > -1 ? row[idx.status] : "").trim();
            if (partStatus.toLowerCase().includes('deleted')) continue;

            const key = `${name}_${zip}`;
            const mappedJob = jobMap.get(key) || { status: 'open', date: '', sa: '' };

            if (!jobs[key]) {
                jobs[key] = {
                    id: key,
                    name: row[idx.name],
                    zip: row[idx.zip],
                    sa: mappedJob.sa,
                    jobStatus: mappedJob.status,
                    backupStatus: "",
                    jobDate: mappedJob.date,
                    parts: [],
                    category: 'WAITING'
                };
            }

            jobs[key].parts.push({
                desc: (idx.desc > -1 ? row[idx.desc] : "N/A"),
                code: (idx.code > -1 ? row[idx.code] : ""),
                rawStatus: partStatus,
                isArrived: GOOD_PART_KEYWORDS.some(k => partStatus.toLowerCase().includes(k))
            });
        }

        return Object.values(jobs);
    }

    // --- HELPER: SMART HEADER DETECTION ---
    private findHeaderRow(lines: string[][], nameKeys: string[], statusKeys: string[]) {
        for (let i = 0; i < Math.min(lines.length, 20); i++) {
            const row = lines[i].map(c => c.toLowerCase());
            const rowStr = row.join(" ");

            if (nameKeys.some(k => rowStr.includes(k)) && statusKeys.some(k => rowStr.includes(k))) {

                const getIdx = (keywords: string[]) => row.findIndex(cell => keywords.some(k => cell.includes(k)));

                return {
                    rowIdx: i,
                    idx: {
                        name: getIdx(['account', 'customer', 'name']),
                        zip: getIdx(['zip', 'post', 'postal']),
                        desc: getIdx(['desc', 'product', 'spare part']),
                        code: getIdx(['code', 'part number', 'material', 'appointment']),
                        status: getIdx(['line item status', 'status', 'state']),
                        date: getIdx(['date', 'start']),
                        sa: getIdx(['appointment', 'number', 'sa'])
                    }
                };
            }
        }
        return { rowIdx: -1, idx: {} as any };
    }

    // --- LOGIC PORT: CATEGORIZATION ---
    private async categorizeJobs(jobs: SPOJob[]): Promise<TrafficReport> {
        const completedIds = await loadSPOTracking(this.accessToken);

        const report: TrafficReport = {
            danger: [],
            ready: [],
            waiting: [],
            history: [],
            stats: { danger: 0, ready: 0, waiting: 0, history: 0 },
            lastUpdated: new Date()
        };

        for (const job of jobs) {
            if (completedIds.includes(job.id)) {
                job.category = 'HISTORY';
                report.history.push(job);
                continue;
            }

            const s1 = (job.jobStatus || "").toLowerCase();
            const s2 = (job.backupStatus || "").toLowerCase();
            const isClosed = CLOSED_KEYWORDS.some(k => s1.includes(k) || s2.includes(k));

            if (isClosed) {
                job.category = 'HISTORY';
                report.history.push(job);
                continue;
            }

            const allPartsArrived = job.parts.every(p => p.isArrived);

            if (allPartsArrived) {
                job.category = 'READY';
                report.ready.push(job);
            } else {
                const isBooked = (job.jobDate && job.jobDate.length > 5) ||
                    s1.includes('schedule') || s1.includes('dispatch');

                if (isBooked) {
                    job.category = 'DANGER';
                    report.danger.push(job);
                } else {
                    job.category = 'WAITING';
                    report.waiting.push(job);
                }
            }
        }

        report.stats = {
            danger: report.danger.length,
            ready: report.ready.length,
            waiting: report.waiting.length,
            history: report.history.length
        };

        return report;
    }

    // --- HELPERS ---
    private cleanName(n: string) { return (n || "").replace(/^Account:\s*/i, "").trim(); }
    private cleanZip(z: string) { return (z || "").replace(/\s+/g, "").toUpperCase(); }

    private parseCSV(text: string) {
        const result = [];
        const lines = text.split('\n');
        for (const line of lines) {
            if (!line.trim()) continue;
            const row = [];
            let cell = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const c = line[i];
                if (c === '"') { inQuotes = !inQuotes; }
                else if (c === ',' && !inQuotes) { row.push(cell.trim()); cell = ''; }
                else { cell += c; }
            }
            row.push(cell.trim());
            result.push(row);
        }
        return result;
    }
}
