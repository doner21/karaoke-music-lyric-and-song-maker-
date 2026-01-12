import fs from 'fs-extra';
/* 
  PROVIDER A: Local Archive (Authorized Archivist)
  SEED: 12007
  Adheres to "Local-Source-Only" compliance. 
  Simulates resolving a videoId to a locally authorized asset.
*/

export class LocalArchiveAdapter {
    constructor(logger = console) {
        this.name = 'local-archive';
        this.version = 'v3.0.0-authorized';
        this.logger = logger;
    }

    async checkHealth() {
        return { available: true, message: 'Local Archive Mounted' };
    }

    async getMetadata(videoId) {
        // In a real local archive, this would look up a JSON index.
        // For simulation, we return deterministic mock data.
        return {
            videoId,
            title: `Archive Asset: ${videoId}`,
            channelTitle: 'Authorized Library',
            channelId: 'LIB_001',
            thumbnailUrl: '', // UI handles missing thumbs
            duration: 240,
            uploadDate: '2024-01-01',
            viewCount: 0,
            description: 'Asset resolved from local authorized archive.',
            rawFormats: []
        };
    }

    async download(jobId, request, storage, onProgress) {
        return new Promise((resolve, reject) => {
            const { mediaType } = request;
            const ext = mediaType === 'audio' ? 'mp3' : 'mp4';
            const filename = `archive_${request.video.videoId}.${ext}`;
            const filePath = storage.getFilePath(jobId, filename);

            try {
                // Ensure directory
                fs.ensureFileSync(filePath);

                // DATA GENERATION (Simulated Ingestion)
                // Write enough data to be detected as a file.
                const content = `AUTHORIZED_ARCHIVE_CONTENT::${request.video.videoId}::${new Date().toISOString()}`.repeat(500);
                fs.writeFileSync(filePath, content);

                // Simulation Loop
                let p = 0;
                const i = setInterval(() => {
                    p += 0.05; // 20 ticks = ~4 seconds ingestion
                    onProgress(Math.min(p, 1));
                    if (p >= 1) {
                        clearInterval(i);
                        resolve([{
                            type: mediaType,
                            path: filePath,
                            filename: filename,
                            downloadUrl: `/download/file/${jobId}/${filename}`,
                            sizeBytes: content.length,
                            format: 'archive_ingest',
                            bitrate: 320000
                        }]);
                    }
                }, 100); // Fast ingestion
            } catch (error) {
                console.error('[LocalArchive] Ingest Error:', error);
                reject(error);
            }
        });
    }

    async cancel(jobId) {
        return true;
    }
}
