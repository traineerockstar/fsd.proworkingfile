/**
 * Drive Folder Configuration
 * Single source of truth for all Google Drive folder names and structure
 * 
 * Structure:
 * FSD_PRO_DATA/
 * ├── MANUALS/               - Service manuals and PDFs for Oscar
 * ├── PART_LISTS/            - Parts lists and BOMs
 * ├── INPUT_SCREENSHOTS/     - Screenshots to process via ingestion
 * ├── Error Code PDFs/       - Error code documentation
 * ├── Fault codes/           - Fault code reference files
 * ├── oscar_brain.json       - Oscar's learned solutions
 * ├── manifest.json          - Job manifest for fast loading
 * ├── job_SA-*.json          - Individual job files
 * ├── YYYY-MM-DD/            - Daily schedule folders
 * │   ├── schedule.json      - Jobs for that day
 * │   └── job_details.json   - Detailed job info
 * 
 * FSD_PRO_KNOWLEDGE/         - Knowledge base documents (separate root folder)
 */

export const DRIVE_FOLDERS = {
    // Root application folder
    ROOT: 'FSD_PRO_DATA',

    // Subfolders inside FSD_PRO_DATA
    SCHEDULES: 'SCHEDULES',          // All daily schedules (YYYY-MM-DD.json files)
    MANUALS: 'MANUALS',
    PART_LISTS: 'PART_LISTS',
    INPUT_SCREENSHOTS: 'INPUT_SCREENSHOTS',
    ERROR_CODE_PDFS: 'Error Code PDFs',
    FAULT_CODES: 'Fault codes',

    // Separate root folder for knowledge base
    KNOWLEDGE: 'FSD_PRO_KNOWLEDGE',
} as const;

export const DRIVE_FILES = {
    // Files in root folder
    OSCAR_BRAIN: 'oscar_brain.json',
    MANIFEST: 'manifest.json',
    CALENDAR: 'calendar.json',       // Master calendar index

    // Files in SCHEDULES folder (named as YYYY-MM-DD.json)
    // No constant needed - filename is dynamic based on date
} as const;

// Type for folder names
export type DriveFolderName = typeof DRIVE_FOLDERS[keyof typeof DRIVE_FOLDERS];

// Helper to get folder structure documentation for Oscar
export const getDriveFolderStructure = (): string => {
    return `
## FSD.PRO Drive Folder Structure

The app stores data in Google Drive under the following structure:

**Root Folder:** \`${DRIVE_FOLDERS.ROOT}\`

### Subfolders:
- \`${DRIVE_FOLDERS.SCHEDULES}/\` - Daily schedules (files named YYYY-MM-DD.json)
- \`${DRIVE_FOLDERS.MANUALS}/\` - Service manuals, PDFs, technical documentation
- \`${DRIVE_FOLDERS.PART_LISTS}/\` - Parts lists, BOMs, inventory data
- \`${DRIVE_FOLDERS.INPUT_SCREENSHOTS}/\` - Screenshots uploaded for schedule processing
- \`${DRIVE_FOLDERS.ERROR_CODE_PDFS}/\` - Error code documentation and guides
- \`${DRIVE_FOLDERS.FAULT_CODES}/\` - Fault code reference files

### Files in Root:
- \`${DRIVE_FILES.CALENDAR}\` - Master calendar index (dates with job counts)
- \`${DRIVE_FILES.OSCAR_BRAIN}\` - Learned solutions from successful fixes
- \`${DRIVE_FILES.MANIFEST}\` - Job manifest for fast loading

### Separate Knowledge Folder:
- \`${DRIVE_FOLDERS.KNOWLEDGE}/\` - Knowledge base documents (root level)
`.trim();
};
