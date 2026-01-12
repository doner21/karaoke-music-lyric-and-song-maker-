
const { exec } = await import('child_process');
const util = await import('util');
const execAsync = util.promisify(exec);

const run = async () => {
    const q = "Billie Eilish";
    console.log(`[VERIFY] Testing yt-dlp search logic for: '${q}'`);

    try {
        const cmd = `python -m yt_dlp "ytsearch10:${q}" --dump-json --flat-playlist --no-warnings`;
        const { stdout } = await execAsync(cmd);

        const lines = stdout.trim().split('\n');
        const items = lines.map(line => {
            try { return JSON.parse(line); } catch (e) { return null; }
        }).filter(i => i !== null);

        const normalized = items.map(item => ({
            videoId: item.id,
            title: item.title,
            thumbnailUrl: item.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
            channelTitle: item.uploader || 'Unknown',
            publishedAt: item.upload_date || ''
        }));

        console.log(`[VERIFY] Found ${normalized.length} results.`);
        if (normalized.length > 0) {
            console.log('[VERIFY] First result:', JSON.stringify(normalized[0], null, 2));
        } else {
            console.error('[VERIFY] No results found!');
        }

    } catch (e) {
        console.error('[VERIFY] Search failed:', e);
    }
};

run();
