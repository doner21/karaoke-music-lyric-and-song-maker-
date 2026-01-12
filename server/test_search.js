
import play from 'play-dl';

const run = async () => {
    const q = "Billie Eilish";
    console.log(`Testing play-dl search for: '${q}'`);

    try {
        const searchResults = await play.search(q, { source: { youtube: "video" }, limit: 10 });
        console.log(`Found ${searchResults.length} results.`);

        if (searchResults.length > 0) {
            console.log('First result:', searchResults[0]);
        }
    } catch (e) {
        console.error('play-dl search failed:', e);
    }
};

run();
