/**
 * GPU Capability Detection — Singleton Module
 * 
 * Detects available GPU acceleration features at app startup and caches results.
 * Used by the export pipeline to select the optimal rendering and encoding path.
 * 
 * Detection:
 * - WebGL2 context availability + max texture size + GPU renderer string
 * - NVENC / QSV encoder availability via IPC to main process (FFmpeg probe)
 * - WebCodecs hardware encoding support
 * 
 * Fallback hierarchy:
 *   Encoder:     h264_nvenc → h264_qsv → libx264
 *   Render mode: webgl2 → canvas2d
 */

// Cached capabilities — null until first detection
let cachedCapabilities = null;
let detectionPromise = null;

/**
 * Probe WebGL2 capabilities from the renderer process.
 * @returns {{ webgl2: boolean, maxTextureSize: number, gpuRenderer: string }}
 */
function probeWebGL2() {
    try {
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 1;
        testCanvas.height = 1;
        const gl = testCanvas.getContext('webgl2', {
            failIfMajorPerformanceCaveat: false,
            preserveDrawingBuffer: true
        });

        if (!gl) {
            console.warn('[GPU] WebGL2 context not available');
            return { webgl2: false, maxTextureSize: 0, gpuRenderer: 'unknown' };
        }

        const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

        // Try to get GPU renderer info
        let gpuRenderer = 'unknown';
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown';
        }

        // Clean up
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();

        console.log(`[GPU] WebGL2: available, maxTexture: ${maxTextureSize}, renderer: ${gpuRenderer}`);
        return { webgl2: true, maxTextureSize, gpuRenderer };
    } catch (err) {
        console.warn('[GPU] WebGL2 probe failed:', err.message);
        return { webgl2: false, maxTextureSize: 0, gpuRenderer: 'unknown' };
    }
}

/**
 * Probe FFmpeg GPU encoders via IPC to main process.
 * @returns {{ nvenc: boolean, qsv: boolean }}
 */
async function probeFFmpegEncoders() {
    try {
        const isElectron = typeof window !== 'undefined' && window.require;
        if (!isElectron) {
            console.warn('[GPU] Not in Electron — skipping FFmpeg encoder probe');
            return { nvenc: false, qsv: false };
        }

        const { ipcRenderer } = window.require('electron');
        const result = await ipcRenderer.invoke('probe-gpu-encoders');

        if (!result.success) {
            console.warn('[GPU] FFmpeg encoder probe failed:', result.error);
            return { nvenc: false, qsv: false };
        }

        console.log(`[GPU] FFmpeg encoders — NVENC: ${result.nvenc}, QSV: ${result.qsv}`);
        return { nvenc: result.nvenc, qsv: result.qsv };
    } catch (err) {
        console.warn('[GPU] FFmpeg encoder probe error:', err.message);
        return { nvenc: false, qsv: false };
    }
}

/**
 * Probe WebCodecs hardware encoding support.
 * @returns {boolean}
 */
async function probeWebCodecsHardware() {
    try {
        if (typeof VideoEncoder === 'undefined' || !VideoEncoder.isConfigSupported) {
            console.warn('[GPU] VideoEncoder API not available');
            return false;
        }

        const result = await VideoEncoder.isConfigSupported({
            codec: 'avc1.4d002a',
            width: 1920,
            height: 1080,
            bitrate: 10_000_000,
            framerate: 30,
            hardwareAcceleration: 'prefer-hardware'
        });

        const supported = result?.supported === true;
        console.log(`[GPU] WebCodecs hardware encoding: ${supported}`);
        return supported;
    } catch (err) {
        console.warn('[GPU] WebCodecs hardware probe failed:', err.message);
        return false;
    }
}

/**
 * Detect all GPU capabilities. Called once, result is cached.
 * 
 * @returns {Promise<{
 *   webgl2: boolean,
 *   nvenc: boolean,
 *   qsv: boolean,
 *   maxTextureSize: number,
 *   gpuRenderer: string,
 *   webCodecsHardware: boolean,
 *   preferredEncoder: 'h264_nvenc' | 'h264_qsv' | 'libx264',
 *   preferredRenderMode: 'webgl2' | 'canvas2d'
 * }>}
 */
export async function detectGpuCapabilities() {
    // Return cached result if already detected
    if (cachedCapabilities) {
        return cachedCapabilities;
    }

    // Prevent parallel detection calls — return the same promise
    if (detectionPromise) {
        return detectionPromise;
    }

    detectionPromise = (async () => {
        console.log('[GPU] Starting GPU capability detection...');

        // Run probes in parallel
        const [webglInfo, encoderInfo, webCodecsHw] = await Promise.all([
            Promise.resolve(probeWebGL2()),
            probeFFmpegEncoders(),
            probeWebCodecsHardware()
        ]);

        // Determine preferred encoder (fallback hierarchy)
        let preferredEncoder = 'libx264';
        if (encoderInfo.nvenc) {
            preferredEncoder = 'h264_nvenc';
        } else if (encoderInfo.qsv) {
            preferredEncoder = 'h264_qsv';
        }

        // Determine preferred render mode
        // WebGL2 is preferred if available and max texture size can handle the target resolution
        const preferredRenderMode = webglInfo.webgl2 ? 'webgl2' : 'canvas2d';

        cachedCapabilities = {
            webgl2: webglInfo.webgl2,
            nvenc: encoderInfo.nvenc,
            qsv: encoderInfo.qsv,
            maxTextureSize: webglInfo.maxTextureSize,
            gpuRenderer: webglInfo.gpuRenderer,
            webCodecsHardware: webCodecsHw,
            preferredEncoder,
            preferredRenderMode
        };

        console.log('[GPU] Capabilities detected:', cachedCapabilities);
        return cachedCapabilities;
    })();

    return detectionPromise;
}

/**
 * Get cached GPU capabilities (synchronous).
 * Returns null if detection hasn't been run yet.
 * 
 * @returns {object|null}
 */
export function getGpuCapabilities() {
    return cachedCapabilities;
}

/**
 * Force re-detection (e.g., if GPU state changes).
 * Typically not needed — detection runs once at startup.
 */
export function resetGpuCapabilities() {
    cachedCapabilities = null;
    detectionPromise = null;
}

/**
 * Resolve the GPU config for an export based on user preference.
 * 
 * @param {'auto' | 'force-gpu' | 'force-cpu'} gpuAcceleration
 * @param {object} gpuCaps — result from detectGpuCapabilities()
 * @returns {{ encoder: string, renderMode: string }}
 */
export function resolveGpuConfig(gpuAcceleration, gpuCaps) {
    if (!gpuCaps || gpuAcceleration === 'force-cpu') {
        return { encoder: 'libx264', renderMode: 'canvas2d' };
    }

    if (gpuAcceleration === 'force-gpu') {
        return {
            encoder: gpuCaps.preferredEncoder,
            renderMode: gpuCaps.webgl2 ? 'webgl2' : 'canvas2d'
        };
    }

    // 'auto' — use GPU if available
    return {
        encoder: gpuCaps.preferredEncoder,
        renderMode: gpuCaps.preferredRenderMode
    };
}
