/**
 * Analytics Service
 * Tracks Oscar usage patterns for improvement insights
 */

import { DRIVE_FOLDERS, DRIVE_FILES } from './driveConfig';
import { findOrCreateFolder } from './googleDriveService';

// Event types
interface AnalyticsEvent {
    type: 'agent_selected' | 'query_processed' | 'source_found' | 'feedback_given' | 'error';
    timestamp: string;
    data: Record<string, any>;
    sessionId: string;
}

// In-memory event buffer
let eventBuffer: AnalyticsEvent[] = [];
let sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const BUFFER_LIMIT = 50;

/**
 * Track an analytics event
 */
export function trackEvent(
    type: AnalyticsEvent['type'],
    data: Record<string, any>
): void {
    const event: AnalyticsEvent = {
        type,
        timestamp: new Date().toISOString(),
        data,
        sessionId
    };

    eventBuffer.push(event);
    console.log(`[Analytics] ${type}:`, data);

    // Auto-flush if buffer is full
    if (eventBuffer.length >= BUFFER_LIMIT) {
        console.log('[Analytics] Buffer full, events will be flushed on next sync');
    }
}

/**
 * Track agent selection
 */
export function trackAgentSelected(agent: string, query: string, latencyMs: number): void {
    trackEvent('agent_selected', {
        agent,
        queryLength: query.length,
        latencyMs
    });
}

/**
 * Track query processing
 */
export function trackQueryProcessed(
    query: string,
    agent: string,
    sourcesCount: number,
    responseLength: number,
    totalLatencyMs: number
): void {
    trackEvent('query_processed', {
        queryPreview: query.substring(0, 50),
        agent,
        sourcesCount,
        responseLength,
        totalLatencyMs
    });
}

/**
 * Track source retrieval
 */
export function trackSourceFound(sourceType: 'drive' | 'web' | 'learned', folderName: string): void {
    trackEvent('source_found', {
        sourceType,
        folderName
    });
}

/**
 * Track user feedback
 */
export function trackFeedback(helpful: boolean, faultCode?: string, model?: string): void {
    trackEvent('feedback_given', {
        helpful,
        faultCode,
        model
    });
}

/**
 * Track errors
 */
export function trackError(errorType: string, message: string, context?: Record<string, any>): void {
    trackEvent('error', {
        errorType,
        message,
        ...context
    });
}

/**
 * Get current session statistics
 */
export function getSessionStats(): {
    totalQueries: number;
    agentUsage: Record<string, number>;
    sourceHits: Record<string, number>;
    feedbackStats: { helpful: number; notHelpful: number };
    errors: number;
} {
    const queries = eventBuffer.filter(e => e.type === 'query_processed');
    const agentEvents = eventBuffer.filter(e => e.type === 'agent_selected');
    const sourceEvents = eventBuffer.filter(e => e.type === 'source_found');
    const feedbackEvents = eventBuffer.filter(e => e.type === 'feedback_given');
    const errorEvents = eventBuffer.filter(e => e.type === 'error');

    const agentUsage: Record<string, number> = {};
    for (const e of agentEvents) {
        const agent = e.data.agent || 'unknown';
        agentUsage[agent] = (agentUsage[agent] || 0) + 1;
    }

    const sourceHits: Record<string, number> = {};
    for (const e of sourceEvents) {
        const source = e.data.sourceType || 'unknown';
        sourceHits[source] = (sourceHits[source] || 0) + 1;
    }

    const helpfulCount = feedbackEvents.filter(e => e.data.helpful === true).length;
    const notHelpfulCount = feedbackEvents.filter(e => e.data.helpful === false).length;

    return {
        totalQueries: queries.length,
        agentUsage,
        sourceHits,
        feedbackStats: { helpful: helpfulCount, notHelpful: notHelpfulCount },
        errors: errorEvents.length
    };
}

/**
 * Flush events to Google Drive
 */
export async function flushToDrive(accessToken: string): Promise<boolean> {
    if (eventBuffer.length === 0) {
        console.log('[Analytics] No events to flush');
        return true;
    }

    try {
        const rootId = await findOrCreateFolder(accessToken);

        // Load existing analytics file
        const analyticsFileName = 'analytics.json';
        const query = `name='${analyticsFileName}' and '${rootId}' in parents and trashed=false`;
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;
        const searchRes = await fetch(searchUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const searchData = await searchRes.json();

        let existingEvents: AnalyticsEvent[] = [];

        if (searchData.files && searchData.files.length > 0) {
            // Load existing data
            const fileId = searchData.files[0].id;
            const contentUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
            const contentRes = await fetch(contentUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const existingData = await contentRes.json();
            existingEvents = existingData.events || [];
        }

        // Merge events (keep last 1000)
        const allEvents = [...existingEvents, ...eventBuffer];
        const trimmedEvents = allEvents.slice(-1000);

        const fileContent = JSON.stringify({
            events: trimmedEvents,
            lastUpdated: new Date().toISOString(),
            sessionCount: new Set(trimmedEvents.map(e => e.sessionId)).size
        }, null, 2);

        // Create or update file
        const metadata = {
            name: analyticsFileName,
            mimeType: 'application/json',
            parents: searchData.files?.length ? undefined : [rootId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([fileContent], { type: 'application/json' }));

        let uploadUrl: string;
        let method: string;

        if (searchData.files && searchData.files.length > 0) {
            uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${searchData.files[0].id}?uploadType=multipart`;
            method = 'PATCH';
        } else {
            uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
            method = 'POST';
        }

        await fetch(uploadUrl, {
            method,
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: form
        });

        console.log(`[Analytics] Flushed ${eventBuffer.length} events to Drive`);
        eventBuffer = []; // Clear buffer after successful flush
        return true;

    } catch (error) {
        console.error('[Analytics] Failed to flush to Drive:', error);
        return false;
    }
}

/**
 * Clear the event buffer
 */
export function clearBuffer(): void {
    eventBuffer = [];
}

/**
 * Get buffer size
 */
export function getBufferSize(): number {
    return eventBuffer.length;
}

/**
 * Start a new session
 */
export function startNewSession(): void {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[Analytics] New session started: ${sessionId}`);
}
