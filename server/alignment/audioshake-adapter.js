/**
 * AudioShake Adapter - Hides Tasks API internals
 * SEED 44019 | SSE Observability Persona
 * 
 * AudioShake API Reference: https://docs.audioshake.ai
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import os from 'os';

const AUDIOSHAKE_API_BASE = 'https://api.audioshake.ai';

export class AudioShakeAdapter {
    constructor(apiKey) {
        this.apiKey = apiKey?.trim();
        this.name = 'AudioShake Tasks API';
    }

    async checkHealth() {
        if (!this.apiKey) {
            return { available: false, error: 'Missing AUDIOSHAKE_API_KEY' };
        }
        // Simple health check - try to access API
        try {
            const res = await fetch(`${AUDIOSHAKE_API_BASE}/`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });
            return { available: true };
        } catch (e) {
            return { available: false, error: e.message };
        }
    }

    /**
     * Submit alignment job to AudioShake
     * Strict Mode: Uploads lyrics as a separate asset to force alignment-only.
     * @param {Object} params
     * @param {string} params.audioPath - Local path to vocal stem
     * @param {string} [params.lyricsText] - Optional lyrics text
     * @returns {Promise<string>} Provider task ID
     */
    async submitAlignment({ audioPath, lyricsText }) {
        console.log(`[AudioShakeAdapter] Starting strict alignment for: ${audioPath}`);
        console.log(`[AudioShakeAdapter] API Key prefix: ${this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'undefined'}`);

        // REQUIRE lyrics - no transcription fallback
        if (!lyricsText || lyricsText.trim().length === 0) {
            throw new Error('Lyrics text is required for alignment. Transcription mode has been disabled.');
        }

        // DEBUG: Log the lyrics being used
        const lyricsPreview = lyricsText.substring(0, 100).replace(/\n/g, ' ');
        const lyricsHash = crypto.createHash('md5').update(lyricsText).digest('hex').substring(0, 8);
        console.log(`[AudioShakeAdapter] LYRICS DEBUG: hash=${lyricsHash}, preview="${lyricsPreview}..."`);

        // Step 1: Upload the audio file
        const assetId = await this.uploadAsset(audioPath);
        console.log(`[AudioShakeAdapter] Audio Asset uploaded: ${assetId}`);

        // Step 2: Upload the lyrics text as an asset (Strict Mode)
        // Note: Creating JSON asset as per documentation ("transcription in JSON format")
        console.log(`[AudioShakeAdapter] Uploading lyrics text asset (JSON format)...`);
        const textAssetId = await this.uploadLyricsAsset(lyricsText);
        console.log(`[AudioShakeAdapter] Text Asset uploaded: ${textAssetId}`);

        // Step 3: Create alignment-only job using otherSourceAssets
        const jobPayload = {
            assetId: assetId,
            callbackUrl: 'https://audioshake.ai/dummy-callback',
            metadata: {
                format: 'json',
                name: 'alignment',
                language: 'en'
            },
            otherSourceAssets: [
                {
                    id: textAssetId,
                    type: 'transcription',
                    name: 'transcription'
                }
            ]
            // Note: 'text' field is explicitly OMITTED to avoid ambiguity
        };

        console.log(`[AudioShakeAdapter] Creating job with payload:`, JSON.stringify(jobPayload, null, 2));

        const res = await fetch(`${AUDIOSHAKE_API_BASE}/job`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(jobPayload)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`[AudioShakeAdapter] Job creation failed: ${res.status} - ${errorText}`);
            throw new Error(`AudioShake job creation failed: ${res.status} - ${errorText}`);
        }

        const data = await res.json();
        console.log(`[AudioShakeAdapter] Job created:`, JSON.stringify(data, null, 2));

        const jobId = data.job?.id || data.id || data.jobId;
        if (!jobId) {
            throw new Error('AudioShake did not return a job ID');
        }

        return jobId;
    }

    /**
     * Helper to upload lyrics as a temporary JSON asset
     */
    async uploadLyricsAsset(text) {
        const tmpDir = os.tmpdir();
        const tmpPath = path.join(tmpDir, `lyrics_${Date.now()}.json`);

        // Wrap text in JSON object as per typical API expectation for unstructured text payload
        const content = JSON.stringify({ text: text });
        fs.writeFileSync(tmpPath, content);

        try {
            const assetId = await this.uploadAsset(tmpPath);
            return assetId;
        } finally {
            try { fs.unlinkSync(tmpPath); } catch (e) {
                console.warn('[AudioShakeAdapter] Failed to clean up temp file:', e.message);
            }
        }
    }

    /**
     * Upload audio file to AudioShake
     * @param {string} filePath - Local file path
     * @returns {Promise<string>} Asset ID
     */
    async uploadAsset(filePath) {
        return new Promise((resolve, reject) => {
            try {
                const fileBuffer = fs.readFileSync(filePath);
                const fileName = path.basename(filePath);
                const mimeType = this.getMimeType(filePath);
                const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);

                const bodyParts = [
                    `--${boundary}\r\n`,
                    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`,
                    `Content-Type: ${mimeType}\r\n\r\n`
                ];
                const bodyStart = Buffer.from(bodyParts.join(''));
                const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`);
                const fullBody = Buffer.concat([bodyStart, fileBuffer, bodyEnd]);

                const url = new URL(`${AUDIOSHAKE_API_BASE}/upload/`); // Ensure trailing slash
                const options = {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'x-api-key': this.apiKey,
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                        'Content-Length': fullBody.length
                    }
                };

                const req = https.request(url, options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            try {
                                const json = JSON.parse(data);
                                resolve(json.id || json.assetId);
                            } catch (e) {
                                reject(new Error(`Invalid JSON response: ${data.substring(0, 100)}`));
                            }
                        } else {
                            reject(new Error(`AudioShake upload failed: ${res.statusCode} - ${data}`));
                        }
                    });
                });

                req.on('error', (e) => {
                    console.error('[AudioShakeAdapter] HTTPS Request Error:', e);
                    reject(e);
                });

                req.write(fullBody);
                req.end();

            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Poll job status
     * @param {string} taskId - Provider task ID
     * @returns {Promise<{state: string, progress?: number, result?: object, error?: string}>}
     */
    async poll(taskId) {
        const res = await fetch(`${AUDIOSHAKE_API_BASE}/job/${taskId}/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        if (!res.ok) {
            throw new Error(`AudioShake poll failed: ${res.status}`);
        }

        const data = await res.json();

        // Map AudioShake status to our internal states
        const stateMap = {
            'queued': 'queued',
            'processing': 'processing',
            'in_progress': 'processing',
            'completed': 'completed',
            'succeeded': 'completed',
            'failed': 'failed',
            'error': 'error'
        };

        const state = stateMap[data.status?.toLowerCase()] || data.status || 'processing';

        const result = {
            state,
            progress: data.progress || (state === 'completed' ? 1.0 : 0.5)
        };

        if (state === 'completed' && data.outputAssets) {
            // Fetch the actual result
            result.result = await this.fetchResult(data.outputAssets);
        }

        if (state === 'failed' || state === 'error') {
            console.log('[AudioShakeAdapter] Job failed details:', JSON.stringify(data, null, 2));
            result.error = data.error || data.message || 'Unknown error';
        }

        return result;
    }

    /**
     * Fetch alignment result from output assets
     */
    async fetchResult(outputAssets) {
        console.log('[AudioShakeAdapter] Available Output Assets:', JSON.stringify(outputAssets, null, 2));

        // Find the JSON output
        const jsonAsset = outputAssets.find(a =>
            a.format === 'json' ||
            a.name?.endsWith('.json') ||
            a.link?.endsWith('.json')
        );

        if (!jsonAsset) {
            // Return raw assets if no JSON found
            return { rawAssets: outputAssets };
        }

        const link = jsonAsset.link || jsonAsset.url;
        if (!link) return { rawAssets: outputAssets };

        const res = await fetch(link);
        if (!res.ok) {
            throw new Error(`Failed to fetch result: ${res.status}`);
        }

        const json = await res.json();
        console.log('[AudioShakeAdapter] Fetched result JSON keys:', Object.keys(json));
        // Log deep structure snippet to help identify where tokens are
        const snippet = JSON.stringify(json).substring(0, 500);
        console.log('[AudioShakeAdapter] Result JSON snippet:', snippet);
        return json;
    }

    /**
     * Cancel a job
     */
    async cancel(taskId) {
        // AudioShake may not support cancellation - log and continue
        console.log(`[AudioShakeAdapter] Cancel requested for ${taskId} (may not be supported)`);
        return true;
    }

    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.flac': 'audio/flac',
            '.m4a': 'audio/mp4',
            '.ogg': 'audio/ogg',
            '.webm': 'audio/webm',
            '.txt': 'text/plain',
            '.json': 'application/json'
        };
        return mimeTypes[ext] || 'audio/mpeg';
    }
}
