/**
 * AudioShake Adapter - Tasks API v2
 * Migrated from Legacy API to new Tasks API
 *
 * AudioShake API Reference: https://developer.audioshake.ai
 *
 * Flow: Upload audio asset → Upload transcript asset → Create task with alignment target → Poll → Fetch result
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
        this.name = 'AudioShake Tasks API v2';
    }

    async checkHealth() {
        if (!this.apiKey) {
            return { available: false, error: 'Missing AUDIOSHAKE_API_KEY' };
        }
        try {
            const res = await fetch(`${AUDIOSHAKE_API_BASE}/assets`, {
                method: 'GET',
                headers: { 'x-api-key': this.apiKey }
            });
            return { available: res.ok };
        } catch (e) {
            return { available: false, error: e.message };
        }
    }

    /**
     * Submit alignment task to AudioShake Tasks API
     * Strict Mode: Uploads lyrics as a transcript asset to force alignment-only (no transcription).
     * @param {Object} params
     * @param {string} params.audioPath - Local path to vocal stem
     * @param {string} params.lyricsText - Required lyrics text
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

        // Step 1: Upload the audio file to /assets
        const assetId = await this.uploadAsset(audioPath);
        console.log(`[AudioShakeAdapter] Audio Asset uploaded: ${assetId}`);

        // Step 2: Upload the lyrics text as a transcript asset
        console.log(`[AudioShakeAdapter] Uploading transcript asset...`);
        const transcriptAssetId = await this.uploadLyricsAsset(lyricsText);
        console.log(`[AudioShakeAdapter] Transcript Asset uploaded: ${transcriptAssetId}`);

        // Step 3: Create alignment task using Tasks API
        const taskPayload = {
            assetId: assetId,
            targets: [
                {
                    model: 'alignment',
                    formats: ['json'],
                    transcriptAssetId: transcriptAssetId,
                    language: 'en'
                }
            ]
        };

        console.log(`[AudioShakeAdapter] Creating task with payload:`, JSON.stringify(taskPayload, null, 2));

        const res = await fetch(`${AUDIOSHAKE_API_BASE}/tasks`, {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskPayload)
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`[AudioShakeAdapter] Task creation failed: ${res.status} - ${errorText}`);
            throw new Error(`AudioShake task creation failed: ${res.status} - ${errorText}`);
        }

        const data = await res.json();
        console.log(`[AudioShakeAdapter] Task created:`, JSON.stringify(data, null, 2));

        const taskId = data.id || data.taskId;
        if (!taskId) {
            throw new Error('AudioShake did not return a task ID');
        }

        return taskId;
    }

    /**
     * Helper to upload lyrics as a temporary transcript asset
     */
    async uploadLyricsAsset(text) {
        const tmpDir = os.tmpdir();
        const tmpPath = path.join(tmpDir, `lyrics_${Date.now()}.txt`);

        // Write plain text — the Tasks API alignment model expects a transcript file
        fs.writeFileSync(tmpPath, text);

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
     * Upload file to AudioShake /assets endpoint
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

                const url = new URL(`${AUDIOSHAKE_API_BASE}/assets`);
                const options = {
                    method: 'POST',
                    headers: {
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
                                reject(new Error(`Invalid JSON response: ${data.substring(0, 200)}`));
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
     * Poll task status via Tasks API
     * @param {string} taskId - Provider task ID
     * @returns {Promise<{state: string, progress?: number, result?: object, error?: string}>}
     */
    async poll(taskId) {
        const res = await fetch(`${AUDIOSHAKE_API_BASE}/tasks/${taskId}`, {
            method: 'GET',
            headers: {
                'x-api-key': this.apiKey
            }
        });

        if (!res.ok) {
            throw new Error(`AudioShake poll failed: ${res.status}`);
        }

        const data = await res.json();

        // Tasks API nests status and output inside targets[0]
        const target = data.targets?.[0];
        const targetStatus = target?.status?.toLowerCase();

        console.log(`[AudioShakeAdapter] POLL: target.status="${targetStatus}", output count=${target?.output?.length || 0}`);

        // Map AudioShake Tasks API status to our internal states
        const stateMap = {
            'queued': 'queued',
            'pending': 'queued',
            'processing': 'processing',
            'in_progress': 'processing',
            'completed': 'completed',
            'succeeded': 'completed',
            'failed': 'failed',
            'error': 'error'
        };

        const state = stateMap[targetStatus] || targetStatus || 'processing';

        const result = {
            state,
            progress: data.progress || (state === 'completed' ? 1.0 : 0.5)
        };

        if (state === 'completed') {
            const outputs = target?.output;
            if (outputs && outputs.length > 0) {
                result.result = await this.fetchResult(outputs);
            } else {
                console.warn('[AudioShakeAdapter] Task completed but no outputs found. Full response:', JSON.stringify(data, null, 2));
                result.result = data;
            }
        }

        if (state === 'failed' || state === 'error') {
            console.log('[AudioShakeAdapter] Task failed details:', JSON.stringify(data, null, 2));
            result.error = target?.error || data.error || data.message || 'Unknown error';
        }

        return result;
    }

    /**
     * Fetch alignment result from task outputs
     */
    async fetchResult(outputs) {
        console.log('[AudioShakeAdapter] Available Outputs:', JSON.stringify(outputs, null, 2));

        // Find the JSON output
        const jsonOutput = outputs.find(a =>
            a.format === 'json' ||
            a.name?.endsWith('.json') ||
            a.link?.endsWith('.json') ||
            a.type === 'json'
        );

        if (!jsonOutput) {
            return { rawAssets: outputs };
        }

        const link = jsonOutput.link || jsonOutput.url || jsonOutput.download;
        if (!link) return { rawAssets: outputs };

        const res = await fetch(link);
        if (!res.ok) {
            throw new Error(`Failed to fetch result: ${res.status}`);
        }

        const json = await res.json();
        console.log('[AudioShakeAdapter] Fetched result JSON keys:', Object.keys(json));
        const snippet = JSON.stringify(json).substring(0, 500);
        console.log('[AudioShakeAdapter] Result JSON snippet:', snippet);
        return json;
    }

    /**
     * Cancel a task
     */
    async cancel(taskId) {
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
