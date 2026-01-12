import play from 'play-dl';
import { DownloadEngine } from '../engine-interface.js';

export class PlayDlAdapter extends DownloadEngine {
    constructor() {
        super();
        this.name = 'play-dl';
    }

    async checkHealth() {
        // Play-dl doesn't have a specific health check, just assume true or test fetch
        return { available: true };
    }

    async getMetadata(videoId) {
        try {
            const info = await play.video_info(videoId);
            const details = info.video_details;
            return {
                title: details.title,
                channel: details.channel.name,
                duration: details.durationInSec,
                thumbnail: details.thumbnails[details.thumbnails.length - 1]?.url,
                source: 'youtube'
            };
        } catch (e) {
            throw new Error(`PlayDL Metadata: ${e.message}`);
        }
    }

    async download(jobId, request, storage, onProgress) {
        const videoId = request.video.videoId;
        console.log(`[PlayDL] Starting download for ${videoId}`);

        try {
            // play-dl stream
            // type: 'audioonly' for best audio
            const stream = await play.stream(videoId, {
                discordPlayerCompatibility: false, // We want raw stream
                quality: 2 // 0: low, 1: medium, 2: high
            });

            const filename = 'audio.webm'; // play-dl typically returns webm/opus for youtube
            const writeStream = await storage.createWriteStream(jobId, filename);

            return new Promise((resolve, reject) => {
                let total = 0;

                stream.stream.on('data', (chunk) => {
                    total += chunk.length;
                    // play-dl stream doesn't give easy progress total
                    onProgress(0.5); // Fake progress to show activity
                });

                stream.stream.pipe(writeStream);

                writeStream.on('finish', () => {
                    resolve([{
                        type: 'audio',
                        filename: filename,
                        path: storage.getFilePath(jobId, filename),
                        sizeBytes: total,
                        format: 'webm'
                    }]);
                });

                writeStream.on('error', reject);
                stream.stream.on('error', reject);
            });

        } catch (e) {
            throw new Error(`PlayDL Download Failed: ${e.message}`);
        }
    }
}
