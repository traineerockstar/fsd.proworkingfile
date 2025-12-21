
import { saveJobToDrive } from './googleDriveService';
import { toast } from 'sonner';

interface QueueItem {
    id: string; // Job ID
    accessToken: string;
    data: any;
    retries: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1s initial delay

class SyncQueueService {
    private queue: QueueItem[] = [];
    private isProcessing: boolean = false;
    private onQueueChange: ((count: number) => void) | null = null;

    /**
     * Add a job save operation to the queue.
     * Use debounce-like logic: if a job is already in the queue, update its data instead of adding a new entry.
     */
    enqueue(accessToken: string, jobId: string, data: any) {
        const existingIndex = this.queue.findIndex(item => item.id === jobId);

        if (existingIndex !== -1) {
            // Update existing pending save with latest data
            this.queue[existingIndex].data = data;
            // Reset retries since it's a "fresh" request
            this.queue[existingIndex].retries = 0;
            console.log(`[SyncQueue] Updated pending save for Job ${jobId}`);
        } else {
            this.queue.push({
                id: jobId,
                accessToken,
                data,
                retries: 0
            });
            console.log(`[SyncQueue] Added Job ${jobId} to queue`);
        }

        this.notifyListeners();
        this.processNext();
    }

    setListener(callback: (count: number) => void) {
        this.onQueueChange = callback;
    }

    private notifyListeners() {
        if (this.onQueueChange) {
            this.onQueueChange(this.queue.length);
        }
    }

    private async processNext() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        const item = this.queue[0]; // Peek

        try {
            console.log(`[SyncQueue] Processing Job ${item.id}...`);
            const fileId = await saveJobToDrive(item.accessToken, item.data);

            if (fileId) {
                // Success
                console.log(`[SyncQueue] Job ${item.id} saved successfully.`);
                this.queue.shift(); // Remove from queue
                this.notifyListeners();

                // If we have a mechanism to update the context with the new fileId, we should do it here?
                // For now, the implementation plan says Context handles optimistic UI. 
                // Ideally, we'd emit an event back to update the driveFileId if it was a new creation.
                // We'll rely on the next load or valid ID presence for now, or add a callback later.
            } else {
                throw new Error("Save returned null ID");
            }

        } catch (error) {
            console.error(`[SyncQueue] Failed to save Job ${item.id}`, error);
            item.retries++;

            if (item.retries >= MAX_RETRIES) {
                console.error(`[SyncQueue] Max retries reached for Job ${item.id}. Dropping.`);
                toast.error(`Failed to sync changes for Job ${item.id} after multiple attempts.`);
                this.queue.shift();
                this.notifyListeners();
            } else {
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * item.retries));
            }
        } finally {
            this.isProcessing = false;
            // Process next item immediately if exists
            if (this.queue.length > 0) {
                this.processNext();
            }
        }
    }

    getQueueLength() {
        return this.queue.length;
    }
}

export const syncQueue = new SyncQueueService();
