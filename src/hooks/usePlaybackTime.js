import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook to provide precise playback time for lyrics rendering.
 * Supports:
 * - HTMLAudioElement (via ref)
 * - YouTube Player object
 * - AudioStemManager instance
 * 
 * @param {Object} audioSource - HTMLAudioElement ref OR YouTube Player OR AudioStemManager instance
 * @param {boolean} externalIsPlaying - Optional external playing state (required for YT Player)
 * @returns {Object} { playbackTime, isPlaying, duration, error, seek, play, pause }
 */
export function usePlaybackTime(audioSource, externalIsPlaying = null) {
    const [playbackTime, setPlaybackTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [internalIsPlaying, setInternalIsPlaying] = useState(false);
    const [error, setError] = useState(null);

    // Use external isPlaying if provided, otherwise internal
    const isPlaying = externalIsPlaying !== null ? externalIsPlaying : internalIsPlaying;

    const requestRef = useRef();

    // Detect source type
    const getSourceType = useCallback(() => {
        if (!audioSource) return 'none';

        // AudioStemManager (has getCurrentTime method directly on object)
        if (typeof audioSource.getCurrentTime === 'function' &&
            typeof audioSource.loadStems === 'function') {
            return 'stemManager';
        }

        // HTMLAudioElement (ref.current)
        if (audioSource?.current && typeof audioSource.current.currentTime === 'number') {
            return 'htmlAudio';
        }

        // YouTube Player (has getCurrentTime but not loadStems)
        if (typeof audioSource.getCurrentTime === 'function' &&
            typeof audioSource.seekTo === 'function') {
            return 'youtube';
        }

        return 'unknown';
    }, [audioSource]);

    const updateTime = useCallback(() => {
        const sourceType = getSourceType();
        let time = 0;

        try {
            switch (sourceType) {
                case 'htmlAudio':
                    time = audioSource.current.currentTime;
                    break;
                case 'youtube':
                    time = audioSource.getCurrentTime();
                    break;
                case 'stemManager':
                    time = audioSource.getCurrentTime();
                    break;
                default:
                    break;
            }
        } catch (err) {
            // Silently ignore time read errors
        }

        setPlaybackTime(time);

        if (isPlaying) {
            requestRef.current = requestAnimationFrame(updateTime);
        }
    }, [audioSource, isPlaying, getSourceType]);

    // Effect for AudioStemManager integration
    useEffect(() => {
        const sourceType = getSourceType();

        if (sourceType === 'stemManager') {
            // AudioStemManager handles its own time updates via onTimeUpdate callback
            // We just need to sync duration when it changes
            const checkDuration = () => {
                const dur = audioSource.getDuration?.();
                if (dur && dur !== duration) {
                    setDuration(dur);
                }
            };

            checkDuration();

            // Return cleanup (no-op for stemManager, it manages itself)
            return () => { };
        }
    }, [audioSource, getSourceType, duration]);

    useEffect(() => {
        if (isPlaying) {
            requestRef.current = requestAnimationFrame(updateTime);
        } else {
            cancelAnimationFrame(requestRef.current);
            // Final sync when stopping
            const sourceType = getSourceType();
            try {
                if (sourceType === 'htmlAudio') {
                    setPlaybackTime(audioSource.current.currentTime);
                } else if (sourceType === 'youtube' || sourceType === 'stemManager') {
                    setPlaybackTime(audioSource.getCurrentTime());
                }
            } catch (e) {
                // Ignore
            }
        }

        // Event listeners only for HTMLAudioElement
        const sourceType = getSourceType();
        if (sourceType === 'htmlAudio') {
            const audioElement = audioSource.current;
            const onPlay = () => setInternalIsPlaying(true);
            const onPause = () => setInternalIsPlaying(false);
            const onSeeked = () => setPlaybackTime(audioElement.currentTime);
            const onTimeUpdate = () => { if (!internalIsPlaying) setPlaybackTime(audioElement.currentTime); };
            const onDurationChange = () => setDuration(audioElement.duration || 0);
            const onError = (e) => setError(e.message || 'Audio error');

            audioElement.addEventListener('play', onPlay);
            audioElement.addEventListener('pause', onPause);
            audioElement.addEventListener('seeked', onSeeked);
            audioElement.addEventListener('timeupdate', onTimeUpdate);
            audioElement.addEventListener('durationchange', onDurationChange);
            audioElement.addEventListener('error', onError);

            return () => {
                audioElement.removeEventListener('play', onPlay);
                audioElement.removeEventListener('pause', onPause);
                audioElement.removeEventListener('seeked', onSeeked);
                audioElement.removeEventListener('timeupdate', onTimeUpdate);
                audioElement.removeEventListener('durationchange', onDurationChange);
                audioElement.removeEventListener('error', onError);
                cancelAnimationFrame(requestRef.current);
            };
        } else {
            return () => cancelAnimationFrame(requestRef.current);
        }
    }, [audioSource, updateTime, isPlaying, internalIsPlaying, getSourceType]);

    const seek = useCallback((time) => {
        const sourceType = getSourceType();

        try {
            switch (sourceType) {
                case 'htmlAudio':
                    audioSource.current.currentTime = time;
                    setPlaybackTime(time);
                    break;
                case 'youtube':
                    audioSource.seekTo(time, true);
                    setPlaybackTime(time);
                    break;
                case 'stemManager':
                    audioSource.seekTo(time);
                    setPlaybackTime(time);
                    break;
                default:
                    break;
            }
        } catch (err) {
            setError(err.message);
        }
    }, [audioSource, getSourceType]);

    const play = useCallback(() => {
        const sourceType = getSourceType();

        try {
            switch (sourceType) {
                case 'htmlAudio':
                    audioSource.current?.play();
                    break;
                case 'youtube':
                    audioSource.playVideo?.();
                    break;
                case 'stemManager':
                    audioSource.play?.();
                    break;
                default:
                    break;
            }
        } catch (err) {
            setError(err.message);
        }
    }, [audioSource, getSourceType]);

    const pause = useCallback(() => {
        const sourceType = getSourceType();

        try {
            switch (sourceType) {
                case 'htmlAudio':
                    audioSource.current?.pause();
                    break;
                case 'youtube':
                    audioSource.pauseVideo?.();
                    break;
                case 'stemManager':
                    audioSource.pause?.();
                    break;
                default:
                    break;
            }
        } catch (err) {
            setError(err.message);
        }
    }, [audioSource, getSourceType]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        playbackTime,
        isPlaying,
        duration,
        error,
        seek,
        play,
        pause,
        clearError,
        // Expose for external time updates (used by AudioStemManager's onTimeUpdate)
        setPlaybackTime,
        setDuration,
        setIsPlaying: setInternalIsPlaying
    };
}
