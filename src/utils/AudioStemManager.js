/**
 * AudioStemManager - Electron-safe audio stem mixing engine
 * 
 * Uses HTMLAudioElement for streaming playback instead of Web Audio API buffers.
 * This avoids the memory crash caused by decodeAudioData on large files.
 * 
 * For volume control, we route HTMLAudioElement through Web Audio API gain nodes
 * using MediaElementSourceNode - but we DON'T decode the audio into buffers.
 */

// Constants
const TIME_UPDATE_INTERVAL = 50; // 50ms for smooth time updates

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

        // HTMLAudioElements for streaming playback
        /** @type {HTMLAudioElement|null} */
        this._bandAudio = null;
        /** @type {HTMLAudioElement|null} */
        this._vocalAudio = null;

        // AudioContext for volume control (optional, created lazily)
        /** @type {AudioContext|null} */
        this._ctx = null;
        /** @type {GainNode|null} */
        this._bandGain = null;
        /** @type {GainNode|null} */
        this._vocalGain = null;
        /** @type {MediaElementAudioSourceNode|null} */
        this._bandSource = null;
        /** @type {MediaElementAudioSourceNode|null} */
        this._vocalSource = null;

        // State
        this._state = 'stopped'; // 'stopped' | 'loading' | 'playing' | 'paused'
        this._duration = 0;

        // Volume values (0-1)
        this._bandVolume = 1;
        this._vocalVolume = 1;

        // Mutex for atomic operations
        this._operationLock = false;

        // Interval for time updates
        this._timeUpdateInterval = null;
    }

    /**
     * Load audio stems from URLs using HTMLAudioElement (streaming, no decode crash)
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
            // Clean up any existing audio elements
            this._disposeAudioElements();

            console.log('[AudioStemManager] Loading stems via HTMLAudioElement (streaming)...');
            console.log('[AudioStemManager] Band URL:', bandUrl);
            console.log('[AudioStemManager] Vocal URL:', vocalUrl);

            // Create new Audio elements
            this._bandAudio = new Audio();
            this._vocalAudio = new Audio();

            // Configure for smooth playback
            this._bandAudio.preload = 'auto';
            this._vocalAudio.preload = 'auto';
            this._bandAudio.crossOrigin = 'anonymous';
            this._vocalAudio.crossOrigin = 'anonymous';

            // Load both stems
            const loadPromises = [
                this._loadAudioElement(this._bandAudio, bandUrl, 'band'),
                this._loadAudioElement(this._vocalAudio, vocalUrl, 'vocal')
            ];

            await Promise.all(loadPromises);

            // Get duration from the longer stem
            this._duration = Math.max(
                this._bandAudio.duration || 0,
                this._vocalAudio.duration || 0
            );

            console.log(`[AudioStemManager] Stems loaded. Duration: ${this._duration.toFixed(2)}s`);

            // Set up Web Audio API for volume control (optional)
            this._setupVolumeControl();

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
     * Load an HTMLAudioElement from URL
     * @private
     */
    _loadAudioElement(audio, url, name) {
        return new Promise((resolve, reject) => {
            const onCanPlayThrough = () => {
                console.log(`[AudioStemManager] ${name} stem ready for playback`);
                audio.removeEventListener('canplaythrough', onCanPlayThrough);
                audio.removeEventListener('error', onError);
                resolve();
            };

            const onError = (e) => {
                audio.removeEventListener('canplaythrough', onCanPlayThrough);
                audio.removeEventListener('error', onError);
                reject(new Error(`Failed to load ${name} stem: ${e.message || 'Unknown error'}`));
            };

            audio.addEventListener('canplaythrough', onCanPlayThrough);
            audio.addEventListener('error', onError);

            // Start loading
            audio.src = url;
            audio.load();
        });
    }

    /**
     * Set up Web Audio API gain nodes for volume control
     * @private
     */
    _setupVolumeControl() {
        if (!this._bandAudio || !this._vocalAudio) return;

        try {
            // Create AudioContext if needed
            if (!this._ctx) {
                this._ctx = new (window.AudioContext || window.webkitAudioContext)();
                console.log('[AudioStemManager] AudioContext created for volume control');
            }

            // Create MediaElementSourceNodes (connects HTMLAudioElement to Web Audio)
            if (!this._bandSource) {
                this._bandSource = this._ctx.createMediaElementSource(this._bandAudio);
                this._bandGain = this._ctx.createGain();
                this._bandSource.connect(this._bandGain);
                this._bandGain.connect(this._ctx.destination);
            }

            if (!this._vocalSource) {
                this._vocalSource = this._ctx.createMediaElementSource(this._vocalAudio);
                this._vocalGain = this._ctx.createGain();
                this._vocalSource.connect(this._vocalGain);
                this._vocalGain.connect(this._ctx.destination);
            }

            // Apply current volumes
            this._bandGain.gain.value = this._bandVolume;
            this._vocalGain.gain.value = this._vocalVolume;
        } catch (err) {
            // Volume control via Web Audio failed, fall back to element volume
            console.warn('[AudioStemManager] Web Audio volume control failed, using element volume:', err);
            this._bandAudio.volume = this._bandVolume;
            this._vocalAudio.volume = this._vocalVolume;
        }
    }

    /**
     * Start playback from a specific time.
     * 
     * @param {number} [startTime=0] - Start position in seconds
     * @returns {boolean} - Whether play was successful
     */
    play(startTime = 0) {
        if (!this._bandAudio && !this._vocalAudio) {
            console.warn('[AudioStemManager] No stems loaded, cannot play');
            this.onError(new Error('No audio loaded. Please load stems first.'));
            return false;
        }

        try {
            // Resume AudioContext if suspended
            if (this._ctx && this._ctx.state === 'suspended') {
                this._ctx.resume();
            }

            // Clamp start time
            const clampedStart = Math.max(0, Math.min(startTime, this._duration));

            // Seek and play both stems
            if (this._bandAudio) {
                this._bandAudio.currentTime = clampedStart;
                this._bandAudio.play().catch(e => console.warn('[AudioStemManager] Band play error:', e));
            }
            if (this._vocalAudio) {
                this._vocalAudio.currentTime = clampedStart;
                this._vocalAudio.play().catch(e => console.warn('[AudioStemManager] Vocal play error:', e));
            }

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
            if (this._bandAudio) this._bandAudio.pause();
            if (this._vocalAudio) this._vocalAudio.pause();

            this._stopTimeUpdates();
            this._setState('paused');

            console.log(`[AudioStemManager] Paused at ${this.getCurrentTime().toFixed(2)}s`);
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
            if (this._bandAudio) {
                this._bandAudio.pause();
                this._bandAudio.currentTime = 0;
            }
            if (this._vocalAudio) {
                this._vocalAudio.pause();
                this._vocalAudio.currentTime = 0;
            }

            this._stopTimeUpdates();
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
        const clampedTime = Math.max(0, Math.min(timeSeconds, this._duration));

        if (this._bandAudio) this._bandAudio.currentTime = clampedTime;
        if (this._vocalAudio) this._vocalAudio.currentTime = clampedTime;

        // Fire a time update so UI syncs
        this.onTimeUpdate(clampedTime);

        console.log(`[AudioStemManager] Seek to ${clampedTime.toFixed(2)}s`);
    }

    /**
     * Set volume for a stem.
     * 
     * @param {'band'|'vocal'} stem - Which stem to adjust
     * @param {number} value - Volume 0-1
     */
    setVolume(stem, value) {
        const clampedValue = Math.max(0, Math.min(1, value));

        if (stem === 'band') {
            this._bandVolume = clampedValue;
            if (this._bandGain) {
                this._bandGain.gain.value = clampedValue;
            } else if (this._bandAudio) {
                this._bandAudio.volume = clampedValue;
            }
        } else if (stem === 'vocal') {
            this._vocalVolume = clampedValue;
            if (this._vocalGain) {
                this._vocalGain.gain.value = clampedValue;
            } else if (this._vocalAudio) {
                this._vocalAudio.volume = clampedValue;
            }
        }
    }

    /**
     * Get current playback time in seconds.
     * 
     * @returns {number}
     */
    getCurrentTime() {
        // Use band audio as reference (or vocal if band not available)
        if (this._bandAudio) return this._bandAudio.currentTime;
        if (this._vocalAudio) return this._vocalAudio.currentTime;
        return 0;
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
        return this._bandAudio !== null || this._vocalAudio !== null;
    }

    /**
     * Clean up all resources. Call when unmounting.
     */
    dispose() {
        this._stopTimeUpdates();
        this._disposeAudioElements();

        if (this._ctx) {
            this._ctx.close().catch(() => { });
            this._ctx = null;
        }

        this._bandGain = null;
        this._vocalGain = null;
        this._bandSource = null;
        this._vocalSource = null;

        console.log('[AudioStemManager] Disposed');
    }

    // ============ Private Methods ============

    /**
     * Clean up audio elements
     * @private
     */
    _disposeAudioElements() {
        if (this._bandAudio) {
            this._bandAudio.pause();
            this._bandAudio.src = '';
            this._bandAudio = null;
        }
        if (this._vocalAudio) {
            this._vocalAudio.pause();
            this._vocalAudio.src = '';
            this._vocalAudio = null;
        }

        // Clear source nodes too
        this._bandSource = null;
        this._vocalSource = null;
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
     * Start interval for time updates
     * @private
     */
    _startTimeUpdates() {
        this._stopTimeUpdates();

        this._timeUpdateInterval = setInterval(() => {
            if (this._state === 'playing') {
                const time = this.getCurrentTime();
                this.onTimeUpdate(time);

                // Check if playback completed
                if (time >= this._duration) {
                    this.stop();
                }
            }
        }, TIME_UPDATE_INTERVAL);
    }

    /**
     * Stop time update interval
     * @private
     */
    _stopTimeUpdates() {
        if (this._timeUpdateInterval) {
            clearInterval(this._timeUpdateInterval);
            this._timeUpdateInterval = null;
        }
    }
}

export default AudioStemManager;
