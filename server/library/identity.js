
/**
 * Library Identity Logic
 * Handles parsing YouTube titles into generic Artist - Title pairs
 * and ensuring consistent file naming.
 */

export class IdentityResolver {

    /**
     * Parse a YouTube title into Artist and Track.
     * Heuristics: "Artist - Title", "Artist : Title", "Artist – Title"
     * @param {string} rawTitle 
     * @param {string} channelName 
     */
    static parse(rawTitle, channelName) {
        let artist = 'Unknown Artist';
        let track = rawTitle;

        // Common separators
        const separators = [' - ', ' – ', ' : ', ' | ', ' // '];
        let foundSep = null;

        for (const sep of separators) {
            if (rawTitle.includes(sep)) {
                foundSep = sep;
                break;
            }
        }

        if (foundSep) {
            const parts = rawTitle.split(foundSep);
            if (parts.length >= 2) {
                artist = parts[0].trim();
                track = parts.slice(1).join(foundSep).trim(); // Rejoin rest in case of multiple
            }
        } else {
            // Fallback: Use channel name as artist if it looks like an artist (no spaces? unlikely)
            // But often channel name IS the artist.
            if (channelName && !channelName.toLowerCase().includes('vevo') && !channelName.toLowerCase().includes('official')) {
                // Weak heuristic, but better than nothing?
                // Actually, let's just stick to "Unknown" or the User has to edit it.
                // OR we can default Artist to ChannelName if we are unsure.
                artist = channelName;
            }
        }

        // Cleanup
        artist = this.cleanString(artist);
        track = this.cleanString(track);

        // Remove common garbage
        track = track.replace(/[\(\[](Official|Video|Audio|Lyric|Lyrics|4K|HD|HQ)[\)\]]/gi, '').trim();

        return { artist, track, canonical: `${artist} - ${track}` };
    }

    static cleanString(str) {
        return str
            .replace(/[""]/g, '') // Remove quotes
            .replace(/\s+/g, ' ') // Collapse spaces
            .trim();
    }

    /**
     * Sanitize for filesystem usage (Windows friendly)
     */
    static sanitizeFilename(name) {
        return name.replace(/[<>:"/\\|?*]/g, '_').trim();
    }
}
