/**
 * AudioStemManager - Crash-safe audio stem mixing engine
 * 
 * Provides robust playback of band + vocal stems with:
 * - Lazy AudioContext initialization (prevents browser policy crashes)
 * - Buffer validation before playback
 * - Mutex pattern for atomic transport operations
 * - Volume smoothing via gain ramps
 * - Full cleanup on stop/seek/dispose
 * 
 * CRITICAL: This module is designed to NEVER crash the app.
 * All errors are caught and surfaced via callbacks.
 */

// Constants
const VOLUME_RAMP_TIME = 0.05; // 50ms for smooth volume transitions
const LOAD_TIMEOUT_MS = 30000; // 30s timeout for loading stems

/**
 * @typedef {Object} AudioStemManagerOptions
 * @property {function(Error):void} [onError] - Called when an error occurs
 * @property {function('stopped'|'playing'|'paused'|'loading'):void} [onStateChange] - State change callback
 * @property {function(number):void} [onTimeUpdate] - Called with current time during playback
 */

export class AudioStemManager {
    /**
     * @param {AudioStemManagerOptions} options
     */
    constructor(options = {}) {
        // Callbacks
        this.onError = options.onError || ((err) => console.error('[AudioStemManager]', err));
        this.onStateChange = options.onStateChange || (() => { });
        this.onTimeUpdate = options.onTimeUpdate || (() => { });

        // AudioContext - NOT created until first user interaction
        /** @type {AudioContext|null} */
        this._ctx = null;

        // Buffers (decoded audio data)
        /** @type {AudioBuffer|null} */
        this._bandBuffer = null;
        /** @type {AudioBuffer|null} */
        this._vocalBuffer = null;

        // Source nodes (recreated on each play)
        /** @type {AudioBufferSourceNode|null} */
        this._bandSource = null;
        /** @type {AudioBufferSourceNode|null} */
        this._vocalSource = null;

        // Gain nodes (persistent)
        /** @type {GainNode|null} */
        this._bandGain = null;
        /** @type {GainNode|null} */
        this._vocalGain = null;

        // State
        this._state = 'stopped'; // 'stopped' | 'loading' | 'playing' | 'paused'
        this._startContextTime = 0; // ctx.currentTime when play started
        this._startOffset = 0; // playback offset in seconds
        this._duration = 0;

        // Volume values (0-1)
        this._bandVolume = 1;
        this._vocalVolume = 1;

        // Mutex for atomic operations
        this._operationLock = false;

        // Animation frame for time updates
        this._rafId = null;
    }

    /**
     * Ensures AudioContext exists and is resumed.
     * MUST be called from a user gesture handler.
     * @returns {AudioContext}
     */
    _ensureContext() {
        if (!this._ctx) {
            try {
                this._ctx = new (window.AudioContext || window.webkitAudioContext)();

                // Create persistent gain nodes
                this._bandGain = this._ctx.createGain();
                this._vocalGain = this._ctx.createGain();
                this._bandGain.connect(this._ctx.destination);
                this._vocalGain.connect(this._ctx.destination);

                // Set initial volumes
                this._bandGain.gain.value = this._bandVolume;
                this._vocalGain.gain.value = this._vocalVolume;

                console.log('[AudioStemManager] AudioContext created');
            } catch (err) {
                this.onError(new Error(`Failed to create AudioContext: ${err.message}`));
                throw err;
            }
        }

        // Resume if suspended (browser policy)
        if (this._ctx.state === 'suspended') {
            this._ctx.resume().catch(err => {
                console.warn('[AudioStemManager] Could not resume context:', err);
            });
        }

        return this._ctx;
    }

    /**
     * Load and decode audio stems from URLs.
     * This method is safe to call multiple times - it will replace previous buffers.
     * 
     * @param {string} bandUrl - URL to band/instrumental stem
     * @param {string} vocalUrl - URL to vocal stem
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async loadStems(bandUrl, vocalUrl) {
        // Prevent concurrent loads
        if (this._operationLock) {
            console.warn('[AudioStemManager] Operation in progress, ignoring loadStems');
            return { success: false, error: 'Operation in progress' };
        }

        this._operationLock = true;
        this._setState('loading');

        try {
            // Stop any current playback
            this._stopSources();

            // Ensure context exists
            const ctx = this._ensureContext();

            // Fetch and decode both stems in parallel with timeout
            const [bandResult, vocalResult] = await Promise.all([
                this._fetchAndDecode(ctx, bandUrl, 'band'),
                this._fetchAndDecode(ctx, vocalUrl, 'vocal')
            ]);

            if (!bandResult.buffer || !vocalResult.buffer) {
                throw new Error('Failed to decode one or both stems');
            }

            this._bandBuffer = bandResult.buffer;
            this._vocalBuffer = vocalResult.buffer;

            // Use the longer duration
            this._duration = Math.max(
                this._bandBuffer.duration,
                this._vocalBuffer.duration
            );

            console.log(`[AudioStemManager] Loaded stems. Duration: ${this._duration.toFixed(2)}s`);
            this._setState('stopped');

            return { success: true };
        } catch (err) {
            console.error('[AudioStemManager] loadStems failed:', err);
            this.onError(err);
            this._setState('stopped');
            return { success: false, error: err.message };
        } finally {
            this._operationLock = false;
        }
    }

    /**
     * Fetch and decode audio from URL with timeout
     * @private
     */
    async _fetchAndDecode(ctx, url, name) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);

        try {
            console.log(`[AudioStemManager] Fetching ${name}: ${url}`);

            const response = await fetch(url, { signal: controller.signal });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} for ${name}`);
            }

            const arrayBuffer = await response.arrayBuffer();

            if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                throw new Error(`Empty response for ${name}`);
            }

            console.log(`[AudioStemManager] Decoding ${name} (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);

            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

            console.log(`[AudioStemManager] Decoded ${name}: ${audioBuffer.duration.toFixed(2)}s`);

            return { buffer: audioBuffer };
        } catch (err) {
            if (err.name === 'AbortError') {
                throw new Error(`Timeout loading ${name} stem`);
            }
            throw new Error(`Failed to load ${name}: ${err.message}`);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Start playback from a specific time.
     * Safe to call even if already playing (will restart from new position).
     * 
     * @param {number} [startTime=0] - Start position in seconds
     * @returns {boolean} - Whether play was successful
     */
    play(startTime = 0) {
        // Guard: must have buffers
        if (!this._bandBuffer && !this._vocalBuffer) {
            console.warn('[AudioStemManager] No stems loaded, cannot play');
            this.onError(new Error('No audio loaded. Please load stems first.'));
            return false;
        }

        // Guard: prevent concurrent operations
        if (this._operationLock) {
            console.warn('[AudioStemManager] Operation in progress, ignoring play');
            return false;
        }

        try {
            const ctx = this._ensureContext();

            // Stop any existing sources first
            this._stopSources();

            // Clamp start time
            const clampedStart = Math.max(0, Math.min(startTime, this._duration));

            // Create new source nodes (they can only be started once)
            if (this._bandBuffer) {
                this._bandSource = ctx.createBufferSource();
                this._bandSource.buffer = this._bandBuffer;
                this._bandSource.connect(this._bandGain);
                this._bandSource.start(0, clampedStart);
            }

            if (this._vocalBuffer) {
                this._vocalSource = ctx.createBufferSource();
                this._vocalSource.buffer = this._vocalBuffer;
                this._vocalSource.connect(this._vocalGain);
                this._vocalSource.start(0, clampedStart);
            }

            // Track timing
            this._startContextTime = ctx.currentTime;
            this._startOffset = clampedStart;

            this._setState('playing');
            this._startTimeUpdates();

            console.log(`[AudioStemManager] Playing from ${clampedStart.toFixed(2)}s`);
            return true;
        } catch (err) {
            console.error('[AudioStemManager] play failed:', err);
            this.onError(err);
            return false;
        }
    }

    /**
     * Pause playback at current position.
     */
    pause() {
        if (this._state !== 'playing') {
            return;
        }

        try {
            // Store current position before stopping
            this._startOffset = this.getCurrentTime();

            this._stopSources();
            this._stopTimeUpdates();
            this._setState('paused');

            console.log(`[AudioStemManager] Paused at ${this._startOffset.toFixed(2)}s`);
        } catch (err) {
            console.error('[AudioStemManager] pause failed:', err);
            this.onError(err);
        }
    }

    /**
     * Stop playback and reset to beginning.
     */
    stop() {
        try {
            this._stopSources();
            this._stopTimeUpdates();
            this._startOffset = 0;
            this._setState('stopped');

            console.log('[AudioStemManager] Stopped');
        } catch (err) {
            console.error('[AudioStemManager] stop failed:', err);
            this.onError(err);
        }
    }

    /**
     * Seek to a specific time. Works whether playing or paused.
     * 
     * @param {number} timeSeconds - Target time in seconds
     */
    seekTo(timeSeconds) {
        const wasPlaying = this._state === 'playing';

        // Clamp to valid range
        const clampedTime = Math.max(0, Math.min(timeSeconds, this._duration));

        if (wasPlaying) {
            // If playing, restart from new position
            this.play(clampedTime);
        } else {
            // If paused/stopped, just update offset
            this._startOffset = clampedTime;
            // Fire a time update so UI syncs
            this.onTimeUpdate(clampedTime);
        }

        console.log(`[AudioStemManager] Seek to ${clampedTime.toFixed(2)}s`);
    }

    /**
     * Set volume for a stem with smooth ramping.
     * 
     * @param {'band'|'vocal'} stem - Which stem to adjust
     * @param {number} value - Volume 0-1
     */
    setVolume(stem, value) {
        const clampedValue = Math.max(0, Math.min(1, value));

        if (stem === 'band') {
            this._bandVolume = clampedValue;
            if (this._bandGain && this._ctx) {
                this._bandGain.gain.linearRampToValueAtTime(
                    clampedValue,
                    this._ctx.currentTime + VOLUME_RAMP_TIME
                );
            }
        } else if (stem === 'vocal') {
            this._vocalVolume = clampedValue;
            if (this._vocalGain && this._ctx) {
                this._vocalGain.gain.linearRampToValueAtTime(
                    clampedValue,
                    this._ctx.currentTime + VOLUME_RAMP_TIME
                );
            }
        }
    }

    /**
     * Get current playback time in seconds.
     * This is the SINGLE SOURCE OF TRUTH for playback position.
     * 
     * @returns {number}
     */
    getCurrentTime() {
        if (this._state === 'playing' && this._ctx) {
            const elapsed = this._ctx.currentTime - this._startContextTime;
            return Math.min(this._startOffset + elapsed, this._duration);
        }
        return this._startOffset;
    }

    /**
     * @returns {number} Total duration in seconds
     */
    getDuration() {
        return this._duration;
    }

    /**
     * @returns {boolean}
     */
    isPlaying() {
        return this._state === 'playing';
    }

    /**
     * @returns {'stopped'|'loading'|'playing'|'paused'}
     */
    getState() {
        return this._state;
    }

    /**
     * Check if stems are loaded and ready to play
     * @returns {boolean}
     */
    isReady() {
        return this._bandBuffer !== null || this._vocalBuffer !== null;
    }

    /**
     * Clean up all resources. Call when unmounting.
     */
    dispose() {
        this._stopSources();
        this._stopTimeUpdates();

        if (this._ctx) {
            this._ctx.close().catch(() => { });
            this._ctx = null;
        }

        this._bandBuffer = null;
        this._vocalBuffer = null;
        this._bandGain = null;
        this._vocalGain = null;

        console.log('[AudioStemManager] Disposed');
    }

    // ============ Private Methods ============

    /**
     * Stop source nodes safely
     * @private
     */
    _stopSources() {
        if (this._bandSource) {
            try {
                this._bandSource.stop();
                this._bandSource.disconnect();
            } catch (e) {
                // Ignore - source may already be stopped
            }
            this._bandSource = null;
        }

        if (this._vocalSource) {
            try {
                this._vocalSource.stop();
                this._vocalSource.disconnect();
            } catch (e) {
                // Ignore
            }
            this._vocalSource = null;
        }
    }

    /**
     * Update internal state and notify callback
     * @private
     */
    _setState(newState) {
        if (this._state !== newState) {
            this._state = newState;
            this.onStateChange(newState);
        }
    }

    /**
     * Start requestAnimationFrame loop for time updates
     * @private
     */
    _startTimeUpdates() {
        this._stopTimeUpdates();

        const update = () => {
            if (this._state === 'playing') {
                const time = this.getCurrentTime();
                this.onTimeUpdate(time);

                // Check if playback completed
                if (time >= this._duration) {
                    this.stop();
                } else {
                    this._rafId = requestAnimationFrame(update);
                }
            }
        };

        this._rafId = requestAnimationFrame(update);
    }

    /**
     * Stop time update loop
     * @private
     */
    _stopTimeUpdates() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }
}

export default AudioStemManager;
