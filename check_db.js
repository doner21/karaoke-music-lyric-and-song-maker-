
import { initDB } from './server/db/index.js';

try {
    const db = initDB();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables:', tables.map(t => t.name));

    // Check if we can insert a song
    const stmt = db.prepare(`
        INSERT INTO songs (id, author_name, track_title) VALUES (?, ?, ?)
    `);
    // wait, schema uses canonical_display_name, artist_name, track_title
    // Let's check schema compliance
    const songId = 'test-uuid-123';
    db.prepare(`
        INSERT INTO songs (id, video_id, artist_name, track_title, canonical_display_name, source_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(songId, 'vid-123', 'Test Artist', 'Test Track', 'Test Artist - Test Track', 'test', Date.now());

    const row = db.prepare('SELECT * FROM songs WHERE id = ?').get(songId);
    console.log('Inserted Song:', row);

    // cleanup
    db.prepare('DELETE FROM songs WHERE id = ?').run(songId);
    console.log('Cleanup successful');

} catch (e) {
    console.error('DB Check Failed:', e);
}
