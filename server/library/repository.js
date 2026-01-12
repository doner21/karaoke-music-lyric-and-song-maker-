
import { getDB } from '../db/index.js';
import crypto from 'crypto';

export class LibraryRepository {
    constructor() {
        this.db = getDB();
        this.stmts = {
            createSong: this.db.prepare(`
                INSERT INTO songs (id, video_id, source_title_raw, artist_name, track_title, canonical_display_name, source_type, created_at)
                VALUES (@id, @video_id, @source_title_raw, @artist_name, @track_title, @canonical_display_name, @source_type, @created_at)
            `),
            getSong: this.db.prepare('SELECT * FROM songs WHERE id = ?'),
            getSongByVideoId: this.db.prepare('SELECT * FROM songs WHERE video_id = ?'),
            listSongs: this.db.prepare('SELECT * FROM songs ORDER BY created_at DESC'),
            addArtifact: this.db.prepare(`
                INSERT INTO artifacts (id, song_id, kind, path, filename, mime_type, hash, params_hash, created_at)
                VALUES (@id, @song_id, @kind, @path, @filename, @mime_type, @hash, @params_hash, @created_at)
            `),
            getArtifacts: this.db.prepare('SELECT * FROM artifacts WHERE song_id = ?'),
            getArtifactByPath: this.db.prepare('SELECT * FROM artifacts WHERE path = ?')
        };
    }

    createSong(data) {
        const id = crypto.randomUUID();
        const song = {
            id,
            video_id: data.videoId || null,
            source_title_raw: data.title,
            artist_name: data.artist || 'Unknown Artist',
            track_title: data.track || 'Unknown Track',
            canonical_display_name: `${data.artist || 'Unknown Artist'} - ${data.track || 'Unknown Track'}`,
            source_type: data.source || 'local',
            created_at: Date.now()
        };
        this.stmts.createSong.run(song);
        return song;
    }

    findSongByVideoId(videoId) {
        return this.stmts.getSongByVideoId.get(videoId);
    }

    saveArtifact(songId, artifact) {
        const id = crypto.randomUUID();
        const data = {
            id,
            song_id: songId,
            kind: artifact.kind,
            path: artifact.path,
            filename: artifact.filename,
            mime_type: artifact.mimeType,
            hash: artifact.hash || null,
            params_hash: artifact.paramsHash || null,
            created_at: Date.now()
        };
        this.stmts.addArtifact.run(data);
        return data;
    }

    findArtifactByPath(path) {
        return this.stmts.getArtifactByPath.get(path);
    }
}


export const Library = new LibraryRepository();
