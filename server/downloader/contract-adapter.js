/**
 * Contract Adapter Layer
 * Bridging Parent System (Karaoke Maker OS v1.1) <-> Internal Audio Service
 */

export class ContractAdapter {
    /**
     * Convert parent system's SelectedSongRef to internal DownloadRequest
     */
    selectedSongToDownloadRequest(selected, options) {
        return {
            video: {
                source: "youtube",
                videoId: selected.videoId
            },
            options: {
                mediaType: "audio", // Always audio for karaoke
                quality: options?.quality || "highestaudio",
                format: options?.format || "mp3"
            }
        };
    }

    /**
     * Convert internal DownloadResult to parent system's AudioAssetRef
     */
    downloadResultToAudioAsset(result, selected) {
        const audioFile = result.files.find(f => f.type === "audio");

        return {
            kind: "youtube_acquired",
            assetId: this.generateAssetId(result.videoId),
            displayName: selected.title,
            linkedVideoId: selected.videoId,
            mimeType: this.getMimeType(audioFile?.format),
            durationSec: result.metadata.duration,
            createdAt: Date.now(),
            // Adding internal path reference for Splitter Service to find it
            // This is technically an extension of the spec, but vital for local operation
            files: result.files
        };
    }

    /**
     * Convert internal job state to parent system's AcquireJob state
     */
    mapJobState(internalState) {
        const stateMap = {
            "queued": "queued",
            "resolving": "running",
            "downloading": "running",
            "postprocess": "running",
            "done": "done",
            "error": "error",
            "canceled": "canceled"
        };
        return stateMap[internalState] || "error";
    }

    /**
     * Convert internal job stage to parent system's AcquireJob stage
     */
    mapJobStage(internalState) {
        const stageMap = {
            "queued": "resolve",
            "resolving": "resolve",
            "downloading": "fetch",
            "postprocess": "transcode",
            "done": "finalize",
            "error": "resolve",
            "canceled": "resolve"
        };
        return stageMap[internalState] || "resolve";
    }

    /**
     * Convert internal error to parent system's error format
     */
    mapError(error) {
        // Simple heuristic for error kinds if codes aren't perfect
        const msg = (error.message || "").toLowerCase();
        let kind = "unknown";

        if (msg.includes("private") || msg.includes("unavailable") || msg.includes("login")) kind = "auth";
        if (msg.includes("network") || msg.includes("timeout") || msg.includes("econnreset")) kind = "network";
        if (msg.includes("429") || msg.includes("quota")) kind = "quota";

        const kindMap = {
            "VIDEO_UNAVAILABLE": "auth",
            "VIDEO_PRIVATE": "auth",
            "AGE_RESTRICTED": "auth",
            "RATE_LIMITED": "quota",
            "NETWORK_ERROR": "network",
            "TIMEOUT": "network"
        };

        if (error.code && kindMap[error.code]) {
            kind = kindMap[error.code];
        }

        return {
            kind: kind,
            message: error.message || "Unknown error"
        };
    }

    generateAssetId(videoId) {
        // Deterministic ID for spec compliance? 
        // Spec says: asset_yt_{videoId}_{timestamp}
        // But for caching to be effective across reloads, we might want asset_yt_{videoId}
        // sticking to spec:
        return `asset_yt_${videoId}_${Date.now()}`;
    }

    getMimeType(format) {
        const mimeMap = {
            "mp3": "audio/mpeg",
            "m4a": "audio/mp4",
            "wav": "audio/wav",
            "webm": "audio/webm"
        };
        return mimeMap[format || "mp3"] || "audio/mpeg";
    }
}
