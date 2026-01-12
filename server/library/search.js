
import { SongRepo } from '../db/repo.js';

// Cache for remote results (in-memory)
const searchCache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 mins

export class UnifiedSearchService {

    /**
     * Search both Local DB and Remote (YouTube)
     * @param {string} query 
     * @param {string} apiKey 
     * @param {string} pageToken 
     */
    async search(query, apiKey, pageToken = null) {
        if (!query) return { items: [] };

        // 1. Local Search (Fast)
        const localResults = SongRepo.search(query);
        const normalizedLocal = localResults.map(song => ({
            videoId: song.video_id,
            title: song.source_title_raw, // or song.canonical_display_name
            thumbnailUrl: song.thumbnail_url,
            channelTitle: song.artist_name, // Map artist to channel for UI compat
            isLocal: true,
            id: song.id, // Internal ID
            canonicalDisplayName: song.canonical_display_name,
            state: {
                hasStems: false, // TODO: Check artifacts?
                hasTimings: false
            }
        }));

        // 2. Remote Search (YouTube)
        // Only if not pagination or explicitly requested?
        // Spec says: "Query YouTube (with fallback) only if query length >= threshold"
        // Let's assume always for now unless pageToken implies we are deep in YT.

        let remoteResults = [];
        const cacheKey = `search:${query}:${pageToken || ''}`;

        if (searchCache.has(cacheKey)) {
            const { timestamp, data } = searchCache.get(cacheKey);
            if (Date.now() - timestamp < CACHE_TTL_MS) remoteResults = data;
        }

        if (!remoteResults.length) {
            try {
                remoteResults = await this.searchYouTube(query, apiKey, pageToken);
                searchCache.set(cacheKey, { timestamp: Date.now(), data: remoteResults });
            } catch (e) {
                console.error('[UnifiedSearch] Remote search failed:', e);
                // Return local only if remote fails
            }
        }

        // 3. Merge
        // De-duplicate by videoId
        const seen = new Set(normalizedLocal.map(i => i.videoId));
        const filteredRemote = remoteResults.filter(i => !seen.has(i.videoId));

        return {
            items: [...normalizedLocal, ...filteredRemote],
            nextPageToken: null // TODO: Pass through from YT if needed
        };
    }

    async searchYouTube(q, apiKey, pageToken) {
        // Reuse logic from server-proxy.js (simplified)
        // If no key, use Mock or Fallback?
        // Let's assume we use the same fallback logic.

        if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
            // Fallback: yt-dlp or Mock
            return await this.searchYtDlp(q);
        }

        try {
            const url = new URL('https://www.googleapis.com/youtube/v3/search');
            url.searchParams.append('part', 'snippet');
            url.searchParams.append('maxResults', '10');
            url.searchParams.append('q', q);
            url.searchParams.append('type', 'video');
            url.searchParams.append('key', apiKey);
            if (pageToken) url.searchParams.append('pageToken', pageToken);

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error(`API ${res.status}`);
            const data = await res.json();

            return (data.items || []).map(item => ({
                videoId: item.id?.videoId || item.id,
                title: item.snippet?.title || 'Unknown',
                thumbnailUrl: item.snippet?.thumbnails?.high?.url || '',
                channelTitle: item.snippet?.channelTitle || '',
                publishedAt: item.snippet?.publishedAt || '',
                isLocal: false
            }));

        } catch (e) {
            console.warn('[UnifiedSearch] YT API error, falling back to yt-dlp:', e.message);
            return await this.searchYtDlp(q);
        }
    }

    async searchYtDlp(q) {
        // Dynamic import logic like in server-proxy
        const { exec } = await import('child_process');
        const util = await import('util');
        const execAsync = util.promisify(exec);

        const cmd = `python -m yt_dlp "ytsearch10:${q}" --dump-json --flat-playlist --no-warnings`;
        const { stdout } = await execAsync(cmd);

        const lines = stdout.trim().split('\n');
        return lines.map(line => {
            try { return JSON.parse(line); } catch (e) { return null; }
        }).filter(i => i).map(item => ({
            videoId: item.id,
            title: item.title,
            thumbnailUrl: item.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
            channelTitle: item.uploader || 'Unknown',
            isLocal: false
        }));
    }
}

export const UnifiedSearch = new UnifiedSearchService();
