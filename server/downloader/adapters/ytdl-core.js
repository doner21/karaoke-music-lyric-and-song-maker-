import ytdl from '@distube/ytdl-core';
import { DownloadEngine } from '../engine-interface.js';

export class YtdlCoreAdapter extends DownloadEngine {
    constructor(logger = console) {
        super();
        this.name = 'ytdl-core';
        this.logger = logger;
    }

    async checkHealth() {
        try {
            // Simple check: can we Resolve a known video ID?
            // "Me at the zoo" or something small
            await ytdl.getBasicInfo('jNQXAC9IVRw');
            return { available: true };
        } catch (e) {
            return { available: false, error: e.message };
        }
    }

    async getMetadata(videoId) {
        try {
            const info = await ytdl.getBasicInfo(videoId);
            const thumbnails = info.videoDetails.thumbnails || [];
            const highResThumb = thumbnails[thumbnails.length - 1]?.url;

            return {
                title: info.videoDetails.title,
                channel: info.videoDetails.author.name,
                duration: parseInt(info.videoDetails.lengthSeconds),
                thumbnail: highResThumb,
                source: 'youtube'
            };
        } catch (e) {
            throw new Error(`YTDL Metadata Error: ${e.message}`);
        }
    }

    async download(jobId, request, storage, onProgress) {
        const videoId = request.video.videoId;
        const quality = request.options.quality || 'highestaudio';

        this.logger.log(`[YTDL] Starting download for ${videoId} with quality ${quality}`);

        return new Promise(async (resolve, reject) => {
            try {
                // Get Full Info for Format Selection
                const info = await ytdl.getInfo(videoId);
                const format = ytdl.chooseFormat(info.formats, {
                    quality: quality,
                    filter: 'audioonly'
                });

                if (!format) {
                    return reject(new Error('No suitable format found'));
                }

                this.logger.log(`[YTDL] Selected format: ${format.container} ${format.audioBitrate}kbps`);

                const stream = ytdl.downloadFromInfo(info, { format: format });
                const filename = `audio.${format.container || 'mp3'}`; // Default to mp3 container naming, though it might be webm/m4a

                // Storage needs to handle the stream
                // We'll assume Storage.saveStream returns a promise or we pass stream to it
                // Based on previous code, Storage might expect we pipe to a file stream
                const writeStream = await storage.createWriteStream(jobId, filename);

                let loaded = 0;
                stream.on('data', (chunk) => {
                    loaded += chunk.length;
                    // Mock Total? YTDL doesn't always give content-length reliably on DASH
                    // Just emit loaded bytes or fake progress?
                    // YTDL 'progress' event is better
                    // onProgress(0.5); 
                });

                stream.on('progress', (chunkLength, downloaded, total) => {
                    const percent = total > 0 ? (downloaded / total) : 0;
                    onProgress(percent);
                });

                stream.pipe(writeStream);

                writeStream.on('finish', () => {
                    this.logger.log(`[YTDL] Download finished: ${filename}`);
                    resolve([{
                        type: 'audio',
                        filename: filename,
                        path: storage.getFilePath(jobId, filename), // Helper needed?
                        sizeBytes: loaded, // Approximation if needed
                        format: format.container || 'mp3'
                    }]);
                });

                writeStream.on('error', (err) => reject(err));
                stream.on('error', (err) => {
                    // Check for 403
                    if (err.message.includes('403')) {
                        console.error('[YTDL] 403 Forbidden detected');
                    }
                    reject(err);
                });

            } catch (e) {
                reject(e);
            }
        });
    }
}
