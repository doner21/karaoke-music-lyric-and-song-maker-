import Database from 'better-sqlite3';
import path from 'path';

console.log('Testing better-sqlite3...');
try {
    const dbPath = path.resolve('karaoke.db');
    const db = new Database(dbPath);
    console.log('Database connected successfully');
    db.close();
} catch (e) {
    console.error('Database failed:', e);
}
