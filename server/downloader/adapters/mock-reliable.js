import fs from 'fs-extra';

/* 
  MOCK_ADAPTER_v1.1
  Fix: Removed dependency on storage.fs, uses fs-extra directly.
  Simulates a reliable local download.
*/

export class MockReliableAdapter {
    constructor(logger = console) {
        this.name = 'mock-reliable';
        this.version = '1.0.1-fix';
        this.logger = logger;
    }

    async checkHealth() {
        return { available: true };
    }

    async getMetadata(videoId) {
        return {
            videoId,
            title: `Mock Video - ${videoId}`,
            channelTitle: 'Mock Channel',
            channelId: 'UC_MOCK',
            thumbnailUrl: 'https://via.placeholder.com/640x360',
            duration: 180,
            uploadDate: '2025-01-01',
            viewCount: 1000,
            rawFormats: []
        };
    }

    async download(jobId, request, storage, onProgress) {
        return new Promise((resolve, reject) => {
            const mediaType = request.mediaType || request.options?.mediaType || 'audio';
            const filename = `mock_${request.video.videoId}.${mediaType === 'audio' ? 'mp3' : 'mp4'}`;
            const filePath = storage.getFilePath(jobId, filename);

            try {
                // Ensure directory
                fs.ensureFileSync(filePath);

                // Write dummy content
                const content = `MOCK_${mediaType.toUpperCase()}_DATA_STREAM_OK`.repeat(200);
                fs.writeFileSync(filePath, content);

                console.log(`[Mock] Writing to ${filePath}`);

                let p = 0;
                const i = setInterval(() => {
                    p += 0.1;
                    onProgress(Math.min(p, 1));
                    if (p >= 1) {
                        clearInterval(i);
                        resolve([{
                            type: mediaType,
                            path: filePath,
                            filename: filename,
                            downloadUrl: `/download/file/${jobId}/${filename}`,
                            sizeBytes: content.length,
                            format: 'mock'
                        }]);
                    }
                }, 200);
            } catch (error) {
                console.error('[Mock] Error:', error);
                reject(error);
            }
        });
    }

    async cancel(jobId) {
        return true;
    }
}
