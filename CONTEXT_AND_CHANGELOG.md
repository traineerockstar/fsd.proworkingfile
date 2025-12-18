
# Application Context and Changelog

This document serves as a persistent context for our development process. It tracks the application's state, features, and the history of changes requested and implemented.

## Initial Application State (as of first review)

### Overview

The application is a "Field Service Data Processor". It's a web-based tool built with React and TailwindCSS that leverages the Google Gemini API. Its primary function is to allow a user to upload screenshot images from a field service application. The AI then processes these images to extract specific data, formats it into a structured table, and generates customer notification messages.

### Core Components & Logic

*   **Frontend**:
    *   Built with **React**.
    *   Styled with **TailwindCSS**.
    *   A single-page application structure (`App.tsx` as the main component).
    *   **UI Components**:
        *   `ImageUploader`: Allows users to select, preview, and remove multiple PNG images.
        *   `DataTable`: Renders a Markdown table string into a styled HTML table.
        *   `Notifications`: Displays a list of generated customer notification messages.
        *   `Loader` & `Icons`: SVG components for UI feedback and iconography.

*   **Backend (AI Logic via Gemini API)**:
    *   The core logic resides in `services/geminiService.ts`.
    *   It uses the **`gemini-2.5-flash`** model (Upgraded from Pro for speed/efficiency).
    *   A comprehensive `MASTER_PROMPT` dictates the AI's behavior. This prompt is highly detailed, instructing the model to:
        1.  Scan "Schedule" screenshots to determine the original job order.
        2.  Extract detailed information from "Work Order" and "Asset" screens for each job.
        3.  Transform the data by assigning fixed time slots, decoding production years from serial numbers, and extracting error codes.
        4.  Generate a JSON output containing a Markdown `dataTable` and an array of `notifications`.
    *   The service requests a structured JSON response using `responseSchema` to ensure data consistency.

### User Flow

1.  The user visits the page.
2.  They use the `ImageUploader` to select one or more PNG screenshots of their field service app.
3.  They click the "Process Images" button.
4.  A loader appears, and the app converts the images to base64 and sends them to the Gemini API.
5.  The API processes the images based on the `MASTER_PROMPT`.
6.  The app receives the processed JSON data.
7.  The UI updates to display the data in a clean table and a list of formatted notification messages.
8.  Error handling is in place for API or data parsing issues.

---

## Changelog

### 2024-07-26: Initial Request - Create Context Document

*   **User Request**: "Please review all code in this app and create a document within the app so you can keep context of every chat we have and what we have done and chnaged"
*   **Changes Implemented**:
    *   Reviewed all existing files to understand the application's architecture, functionality, and AI prompting strategy.
    *   Created this file, `CONTEXT_AND_CHANGELOG.md`, and added it to the project root.
    *   Populated the file with an "Initial Application State" summary and started this changelog.

### 2024-07-26: Request for Automatic Chat Logging

*   **User Request**: "Please make the MD file save logs of our chats automatically"
*   **Resolution**: Explained that as an AI, I cannot *true* automate this process. However, I will adopt a workflow where I manually update this changelog with a summary of our interaction at the beginning of each response that involves code changes. This will effectively create the desired log.
*   **Changes Implemented**:
    *   Updated `CONTEXT_AND_CHANGELOG.md` to reflect this conversation and establish the new workflow.

### 2024-07-26: Implement Dynamic Time Slot Selection

*   **User Request**: "add drop down selection buttons for the times both start and finish, these should start from 7.30 and incriment in half hours."
*   **Resolution**: The hardcoded time slots in the AI prompt are too rigid. This change introduces a UI for the user to dynamically define the time slots for the jobs before processing.
*   **Changes Implemented**:
    *   **Created `components/TimeSlotManager.tsx`**: A new component to manage a list of time slots. It allows adding a new slot, removing an existing one, and setting a start/end time for each via dropdowns.
    *   **Updated `App.tsx`**:
        *   Integrated the `TimeSlotManager` component into the main UI.
        *   Added state management for the `timeSlots` array.
        *   The "Process Images" button is now disabled until both images are uploaded and at least one time slot is defined.
        *   Updated UI section headers to reflect the new step in the process.
    *   **Updated `services/geminiService.ts`**:
        *   Modified the `MASTER_PROMPT` to be dynamically generated.
        *   The hardcoded list of fixed time slots was removed.
        *   The prompt now includes a section with the user-defined time slots passed from the UI, instructing the AI to use those specific times.
    *   **Updated `components/Icons.tsx`**: Added a `PlusIcon` for the "Add Time Slot" button.

### 2024-07-26: Full Code Review for Context Synchronization

*   **User Request**: "Save all of this to the changelog" (after providing the complete source code of the application).
*   **Resolution**: The user provided a snapshot of all application files to ensure my context is synchronized with the current state of the project.
*   **Changes Implemented**:
    *   Reviewed all provided files (`index.tsx`, `metadata.json`, `index.html`, `App.tsx`, `types.ts`, `services/geminiService.ts`, and all components).
    *   Confirmed that the codebase reflects the latest changes, including the dynamic time slot manager.
    *   Updated this changelog to document this context synchronization step. No functional code changes were requested or made.

### 2024-07-26: Improve Time Slot Selection Logic

*   **User Request**: "Implement logic in the TimeSlotManager to ensure that the drop down list doesn't show the start time on the end time drop down menu"
*   **Resolution**: The end time dropdown for a job slot should not show times that are earlier than or the same as its selected start time to prevent invalid time ranges.
*   **Changes Implemented**:
    *   **Updated `components/TimeSlotManager.tsx`**:
        *   The dropdown menu for the "End Time" is now dynamically filtered based on the selected "Start Time" for the same job. It will only display times that are later than the start time.
        *   Added logic to `handleTimeChange` so that if a user selects a new "Start Time" that is later than or equal to the current "End Time", the "End Time" automatically adjusts to the next valid time slot, preventing invalid time ranges.

### 2024-07-26: Enforce Sequential Time Slots

*   **User Request**: "change the timeslot logic so that the drop down list for the start time of each sequential job does not show on the start time for the next job"
*   **Resolution**: The time slots should be strictly sequential and non-overlapping. The UI should enforce this to make scheduling intuitive and error-proof.
*   **Changes Implemented**:
    *   **Updated `components/TimeSlotManager.tsx`**:
        *   **Sequential Start Times**: The "Start Time" dropdown for a job is now filtered to only show times after the previous job's end time.
        *   **Cascading Updates**: When a job's time is changed, all subsequent jobs automatically adjust their start and end times to maintain a valid, non-overlapping sequence.
        *   **Intelligent "Add" Button**: The "Add Time Slot" button now adds a new job immediately following the last one and is disabled if there is no more time available in the day.

### 2024-07-26: Correct Time Slot Logic for Back-to-Back Scheduling

*   **User Request**: "This is still wrong, the second job starts time should have 8.00 available..."
*   **Resolution**: The previous "sequential" logic incorrectly enforced a 30-minute gap between jobs (e.g., end at 08:30, next must start at 09:00). This was wrong. The logic has been corrected to allow for true back-to-back scheduling.
*   **Changes Implemented**:
    *   **Updated `components/TimeSlotManager.tsx`**:
        *   The logic that calculates the next available start time has been fixed. The start time for a job can now be the exact same time that the previous job ends (e.g., end at 08:30, start at 08:30).
        *   The cascading update and "Add Time Slot" logic were also corrected to reflect this gapless scheduling, ensuring an intuitive and correct user experience.
        
### 2024-07-26: Implement Fluid Cascading Time Slots

*   **User Request**: "change the logic to start times available from half hour after the previous jobs start time, I may have jobs that only last half an hour..."
*   **Resolution**: The previous logic did not automatically "pull" subsequent jobs forward when an earlier job was shortened, creating unwanted gaps. The scheduling logic needed to be more fluid and intelligent.
*   **Changes Implemented**:
    *   **Updated `components/TimeSlotManager.tsx`**:
        *   Rebuilt the `handleTimeChange` function to implement a full, intelligent cascade.
        *   Now, when any job's start or end time is changed, all subsequent jobs in the schedule are automatically shifted to maintain a perfect back-to-back sequence, preserving their duration.
        *   This creates a "snap-to" or "magnetic" feel, making it easy to adjust the schedule without manually fixing gaps.

### 2024-07-26: Unlock Start Time Editing for Flexibility

*   **User Request**: "Do not lock the start time drop down list it must be editable"
*   **Resolution**: The previous "fluid cascade" logic was too restrictive by locking the start time for all but the first job. This prevented the user from manually creating a gap between jobs (e.g., for travel time). The logic has been updated to make all start time dropdowns editable.
*   **Changes Implemented**:
    *   **Updated `components/TimeSlotManager.tsx`**:
        *   Removed the `disabled={index > 0}` attribute from the start time `<select>` element.
        *   The dropdown options are still filtered to only show times after the previous job's end time, preventing overlaps while allowing the user to create intentional gaps in the schedule. The cascading logic for subsequent jobs remains intact.

### 2024-07-26: Simplify UI for Fixed-Duration Jobs

*   **User Request**: "apart from job one the end time slot is always 2 hours after the start ime so this doesnt need to be a drop down list"
*   **Resolution**: To simplify the UI for standard jobs, the end time for all jobs after the first will be auto-calculated and non-editable. This enforces a fixed 2-hour duration for these jobs.
*   **Changes Implemented**:
    *   **Updated `components/TimeSlotManager.tsx`**:
        *   **UI Change**: The end time for "Job 1" remains a dropdown. For all subsequent jobs, the end time is now a non-editable, styled text field that displays the calculated time.
        *   **Logic Change**: The `handleTimeChange`, `handleAddTimeSlot`, and `handleRemoveTimeSlot` functions have been updated. The duration of jobs after the first is now fixed at 2 hours. The cascading logic now automatically enforces this fixed duration for all subsequent jobs when the schedule is modified.
        *   The "Add Time Slot" button is now disabled if there isn't enough time left in the day to add a full 2-hour job slot.

### 2024-07-27: Revert Fixed Durations for Full Flexibility

*   **User Request**: "the start time for the jobs is not right check changelong ato what we discussed about half an hour after the previous start time"
*   **Resolution**: The fixed 2-hour duration for jobs was overly restrictive and conflicted with the user's need to schedule short, half-hour jobs. This logic has been reverted. All jobs now have fully editable start and end times, providing maximum flexibility.
*   **Changes Implemented**:
    *   **Updated `components/TimeSlotManager.tsx`**:
        *   **UI Change**: The end time for ALL jobs is now an editable dropdown menu again. The non-editable text field has been removed.
        *   **Logic Change**: A new, more robust cascading update logic has been implemented. When a job's start time is changed, its duration is preserved. When a job's end time is changed (thus changing its duration), all subsequent jobs shift to start immediately after, preserving their own durations. This creates an intuitive, fluid scheduling experience for back-to-back jobs of any length, while still allowing manual creation of gaps.
        *   The "Add Time Slot" button now adds a default 30-minute job slot.

### 2024-07-27: Implement Simplified and Structured Time Slot Logic

*   **User Request**: A detailed set of new rules for time slot management.
*   **Resolution**: The scheduling logic has been significantly refactored to be simpler and more structured. The goal is to provide a fixed, predictable framework for scheduling jobs.
*   **Changes Implemented**:
    *   **Updated `components/TimeSlotManager.tsx`**:
        *   **Fixed Job 1**: The first job is now immutable, with a fixed start time of `07:30` and end time of `08:30`. The UI for this job is non-editable.
        *   **Standardized Subsequent Jobs**: All jobs from the second one onwards have a fixed duration of exactly 2 hours.
        *   **Editable Start Times**: The start time for subsequent jobs is still editable via a dropdown. The available options for a job's start time now begin 30 minutes after the *start time* of the previous job.
        *   **Automatic End Times**: The end time for subsequent jobs is automatically calculated (start time + 2 hours) and displayed as a non-editable field.
        *   **Code Simplification**: Removed the previous complex cascading and duration calculation functions (`cascadeUpdates`, `getDurationInIncrements`) as they are no longer needed with this more rigid logic. Event handlers (`handleAddTimeSlot`, `handleTimeChange`, `handleRemoveTimeSlot`) have been rewritten to enforce the new rules.

### 2024-07-27: Add Copy to Clipboard Functionality

*   **User Request**: Add a "Copy" button to each generated notification message with visual feedback ("Copied!").
*   **Resolution**: Implement clipboard functionality using `navigator.clipboard.writeText` and add state management for UI feedback.
*   **Changes Implemented**:
    *   **Updated `components/Icons.tsx`**: Added `CopyIcon` and `CheckIcon`.
    *   **Updated `components/Notifications.tsx`**:
        *   Added `useState` to track the index of the copied message.
        *   Implemented `handleCopy` function to write text to clipboard and trigger the success state for 2 seconds.
        *   Added a styled button next to the message title that toggles between "Copy" and "Copied!" based on state.

### 2024-07-27: Architecture Documentation and Digital Worksheet Planning

*   **User Request**: Create an `ARCHITECTURE.md` file based on the current code and the goals for the upcoming "Digital Worksheet" refactor.
*   **Resolution**: Created the architecture document to map out the current state and the future state where time slots are automatically generated based on image count.
*   **Changes Implemented**:
    *   **Created `ARCHITECTURE.md`**: Documented directory structure, key components, state logic, and the "Future Data Flow" for the job automation refactor.

### 2024-07-27: Fix SDK Usage and Switch to Flash Model

*   **User Request**: Fix "Critical Errors" in app caused by older SDK methods and upgrade model usage.
*   **Resolution**: Updated the `geminiService` to use the correct `gemini-2.5-flash` model (replacing the non-existent `pro` variant in this context) and ensured the import map and local file usages were consistent with the current environment.
*   **Changes Implemented**:
    *   **Updated `services/geminiService.ts`**: Switched model to `gemini-2.5-flash`.
    *   **Updated `App.tsx`**: Added local storage logic for worksheet persistence and dynamic table syncing.
    *   **Updated `components/DataTable.tsx`**: Added "Copy to Sheets" functionality.
    *   **Updated `components/ImageUploader.tsx`**: Enhanced drag-and-drop UI.

### 2024-07-28: Add Sidebar Toggle

*   **User Request**: "Add a toggle side bar button".
*   **Resolution**: Added a button to show/hide the sidebar for better screen real estate management.
*   **Changes Implemented**:
    *   **Updated `App.tsx`**: Added `isSidebarOpen` state and a floating toggle button.
    *   **Updated `components/Sidebar.tsx`**: Added `isOpen` prop for sliding animation and a "Collapse" button inside.
    *   **Updated `components/Icons.tsx`**: Added `SidebarLeftIcon`.

### 2024-07-28: Make Sidebar Mobile Friendly

*   **User Request**: "Please make it mobile screen friendly".
*   **Resolution**: Enhanced the sidebar and toggle behavior for mobile devices.
*   **Changes Implemented**:
    *   **Updated `App.tsx`**:
        *   Sidebar state now initializes based on screen width (closed on mobile, open on desktop).
        *   Added a backdrop overlay on mobile that allows clicking outside the sidebar to close it.
        *   Adjusted toggle button positioning for mobile screens.
    *   **Updated `components/Sidebar.tsx`**:
        *   Removed the "mini" sidebar state on mobile. The sidebar is now always full width (256px) when open, overlaying the content on mobile.
        *   Nav labels and profile text are now visible on all screen sizes when the sidebar is open.
        *   Clicking a nav item on mobile now automatically closes the sidebar.

### 2024-07-28: Redesign Review Screen

*   **User Request**: "when the images have been processed... all I want on that page is the start time adjustment... and next to each start time the product type and the description of the fault, I don't want the messages on this screen, I don't want the full worksheet on this screen"
*   **Resolution**: Refocused the Review stage (Stage 2) to be purely about scheduling and verifying job details. Removed the clutter of the full data table and notification list from this specific view.
*   **Changes Implemented**:
    *   **Updated `App.tsx`**:
        *   Added logic to extract `productType` and `fault` from the processed data table.
        *   Updated the `renderContent` for the `review` stage to **remove** the `DataTable` and `Notifications` components.
        *   Passed the extracted `jobDetails` to the `TimeSlotManager`.
    *   **Updated `components/TimeSlotManager.tsx`**:
        *   Updated the job card layout.
        *   Added a new section in the middle of the card to display "Product Type" (Bold) and "Fault Description" (Text).
        *   This places the job context directly next to the time controls as requested.

### 2024-07-28: Unlock Start Time for First Job

*   **User Request**: "need to be able to change the first start time"
*   **Resolution**: Removed the restriction that locked the start time for the first job.
*   **Changes Implemented**:
    *   **Updated `components/TimeSlotManager.tsx`**:
        *   Removed `disabled={index === 0}` from the start time dropdown.
        *   Updated `handleStartTimeChange` to calculate the *current duration* of the slot being modified (e.g., 1 hour for Job 1, 2 hours for others) and preserve that duration when the start time is changed, rather than defaulting to a hardcoded 2-hour duration.

### 2024-07-28: Re-enable Fully Editable Time Slots

*   **User Request**: "i still cant change the start time"
*   **Resolution**: It appears that the `appearance-none` styling was hiding the dropdown arrows, making the inputs look like static text. Furthermore, the user likely needs to edit the End Time to adjust durations manually, which was previously read-only.
*   **Changes Implemented**:
    *   **Updated `components/TimeSlotManager.tsx`**:
        *   Removed `appearance-none` from the Start Time select to ensure the dropdown arrow is visible.
        *   Converted the "End Time" field back into a fully editable `<select>` dropdown.
        *   Extended the `timeOptions` range to 22:00 to accommodate late finish times.
        *   Added `handleEndTimeChange` to allow manual duration adjustments.

### 2024-07-28: Fix Start Time Visibility and Range

*   **User Request**: "you havent changed the relevant files" (in response to still not being able to change time).
*   **Resolution**: The default browser dropdown arrow is likely invisible on the dark background without `appearance-none` and a custom icon. Also, the user might want to set the start time earlier than 07:30.
*   **Changes Implemented**:
    *   **Updated `components/Icons.tsx`**: Added `ChevronDownIcon` to style the select inputs.
    *   **Updated `components/TimeSlotManager.tsx`**:
        *   Added a custom styled wrapper with the `ChevronDownIcon` to ensure the dropdown affordance is clearly visible and clickable.
        *   Extended the `timeOptions` to start from **06:00** (previously 07:30) to allow for earlier start times.
        *   Verified removal of all `disabled` attributes.

### 2024-07-28: Add Generate Worksheet Button (Google Sheets Integration)

*   **User Request**: "Add a button... label it 'Generate Worksheet'... When this button is clicked, it needs to run a JavaScript function that scrapes the data from the main data table and sends it to my Google Apps Script."
*   **Resolution**: Integrate the Google Apps Script POST logic into the `DataTable` component.
*   **Changes Implemented**:
    *   **Updated `components/Icons.tsx`**: Added `TableCellsIcon` for the new button.
    *   **Updated `components/DataTable.tsx`**:
        *   Added `handleGenerateWorksheet` function.
        *   Utilized the existing `rows` state (array of string arrays) as the payload for reliability, rather than DOM scraping.
        *   Implemented `fetch` with `mode: "no-cors"` to the provided script URL.
        *   Added the button to the UI next to the existing copy button.

### 2025-12-17: Major Feature Rollout - Dashboard & Smart Scheduler

*   **Status**: Confirmed existing codebase includes significantly advanced features beyond the initial "Image Processor" scope.
*   **New Features Found**:
    *   **Dashboard (`components/Dashboard.tsx`)**:
        *   Full "Mission Control" interface with Sidebar navigation.
        *   "Job Details" view with integrated map, contact, and machine info.
        *   **Quick Tools**: Diagnostic Wizard, Ingest Manager, Message Center, Training Center.
    *   **Oscar Chat (`components/OscarChat.tsx`)**:
        *   AI Assistant integrated directly into the dashboard.
        *   Context-aware of the currently selected job.
    *   **Smart Scheduler (`components/IngestManager.tsx`)**:
        *   Batch processing of input screenshots.
        *   Auto-calculation of gaps/travel time.
        *   "Smart Route" suggestions.
    *   **Job Sheet Upload (`components/JobDetail.tsx`)**:
        *   **Implementation**: Located inside the specific Job Detail view (Right Column).
        *   **Functionality**: Uploads handwritten job sheets.
        *   **AI Integration**: uses `analyzeJobSheet` service to extract:
            *   Detected Product
            *   Parts Used
            *   Engineer Notes
            *   Serial Number (with Barcode Scanner fallback).

### 2025-12-18: Implemented Smart Service JobCard
*   **Summary**: "Implemented Smart Service JobCard."
*   **Details**: "Added UI for AI Fault Summary, Part Finder Input, and Oscar Advice trigger. Updated component props to handle these actions."

### 2025-12-18: Wired JobCard 'Ask Oscar' Button
*   **Summary**: "Wired JobCard 'Ask Oscar' button to OscarChat."
*   **Details**: "Created activeJob state in Dashboard. Implemented context injection in OscarChat so it knows the current job details automatically."

### 2025-12-18: UI Design Mockup
*   **Summary**: "Created new UI design based on user-provided style reference."
*   **Details**: "Implemented a modern, blue-and-white card-based layout with generic placeholders, matching the requested aesthetic."


### 2025-12-18: Project Structure Consolidation
*   **Summary**: "Consolidated all source code into `src/` directory and aligned with Vite best practices."
*   **Details**:
    *   Moved `components`, `services`, `context`, `App.tsx`, `types.ts`, and `main.tsx` into `src/`.
    *   Deleted root-level source files to remove duplication.
    *   Updated `index.html` entry point.
    *   Fixed build errors in `geminiService.ts` (duplicate exports) and `Settings.tsx` (JSX syntax).
    *   Verified application loads successfully on development server.
