/**
 * DownloadEngine Interface
 * Standardizes interaction with different download providers.
 * FR-003: Multiple Engine Support
 */

export class DownloadEngine {
    constructor() {
        this.name = 'generic-engine';
        this.version = '0.0.0';
    }

    /**
     * Check if engine is available and healthy
     * @returns {Promise<{ available: boolean, error?: string }>}
     */
    async checkHealth() {
        throw new Error('checkHealth() must be implemented');
    }

    /**
     * Fetch metadata without downloading
     * @param {string} videoId 
     * @returns {Promise<VideoMetadata>}
     */
    async getMetadata(videoId) {
        throw new Error('getMetadata() must be implemented');
    }

    /**
     * Perform the download
     * @param {DownloadRequest} request 
     * @param {StorageController} storage 
     * @param {function(number): void} onProgress 
     * @returns {Promise<DownloadResult>}
     */
    async download(jobId, request, storage, onProgress) {
        throw new Error('download() must be implemented');
    }

    /**
     * Attempt to cancel the specific job
     * @returns {Promise<boolean>}
     */
    async cancel(jobId) {
        return false; // Default: cancellation not supported
    }
}
