/**
 * Asset Registry
 * In-memory cache for mapping Video IDs to existing Audio Assets.
 * FR-006: Asset Registry & Caching
 */

export class AssetRegistry {
    constructor(ttlHours = 24) {
        this.cache = new Map(); // videoId -> { asset, expiresAt }
        this.ttlMs = ttlHours * 60 * 60 * 1000;
        this.name = "In-Memory Asset Registry";
    }

    /**
     * Register a newly acquired asset
     */
    register(videoId, assetRef) {
        this.cache.set(videoId, {
            asset: assetRef,
            expiresAt: Date.now() + this.ttlMs
        });
        console.log(`[AssetRegistry] Registered asset for ${videoId}: ${assetRef.assetId}`);
    }

    /**
     * Find a cached asset by videoId
     * Returns null if not found or expired
     */
    findByVideoId(videoId) {
        const entry = this.cache.get(videoId);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            console.log(`[AssetRegistry] Asset expired for ${videoId}`);
            this.cache.delete(videoId);
            return null;
        }

        return entry.asset;
    }

    /**
     * Manual cleanup/invalidation
     */
    invalidate(videoId) {
        this.cache.delete(videoId);
    }

    /**
     * Inspect cache state (debug)
     */
    getStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys())
        };
    }
}
