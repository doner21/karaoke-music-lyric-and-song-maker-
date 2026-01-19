import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook to provide precise playback time for lyrics rendering.
 * Supports both HTMLAudioElement and YouTube Player object.
 * 
 * @param {Object} audioRef - HTMLAudioElement ref OR YouTube Player instance
 * @param {boolean} externalIsPlaying - Optional external playing state (required for YT Player)
 * @returns {Object} { playbackTime, isPlaying, seek, play, pause }
 */
export function usePlaybackTime(audioRef, externalIsPlaying = null) {
    const [playbackTime, setPlaybackTime] = useState(0);
    const [internalIsPlaying, setInternalIsPlaying] = useState(false);

    // Use external isPlaying if provided, otherwise internal
    const isPlaying = externalIsPlaying !== null ? externalIsPlaying : internalIsPlaying;

    const requestRef = useRef();

    const updateTime = useCallback(() => {
        let time = 0;
        // Handle HTMLAudioElement (ref.current)
        if (audioRef?.current && typeof audioRef.current.currentTime === 'number') {
            time = audioRef.current.currentTime;
        }
        // Handle YouTube Player (object)
        else if (audioRef && typeof audioRef.getCurrentTime === 'function') {
            time = audioRef.getCurrentTime();
        }

        setPlaybackTime(time);

        if (isPlaying) {
            requestRef.current = requestAnimationFrame(updateTime);
        }
    }, [audioRef, isPlaying]);

    useEffect(() => {
        if (isPlaying) {
            requestRef.current = requestAnimationFrame(updateTime);
        } else {
            cancelAnimationFrame(requestRef.current);
            // Final sync when stopping
            if (audioRef) {
                if (audioRef.current?.currentTime) setPlaybackTime(audioRef.current.currentTime);
                else if (audioRef.getCurrentTime) setPlaybackTime(audioRef.getCurrentTime());
            }
        }

        // Event listeners only for HTMLAudioElement
        const audioElement = audioRef?.current;
        if (audioElement && typeof audioElement.addEventListener === 'function') {
            const onPlay = () => setInternalIsPlaying(true);
            const onPause = () => setInternalIsPlaying(false);
            const onSeeked = () => setPlaybackTime(audioElement.currentTime);
            const onTimeUpdate = () => { if (!internalIsPlaying) setPlaybackTime(audioElement.currentTime); };

            audioElement.addEventListener('play', onPlay);
            audioElement.addEventListener('pause', onPause);
            audioElement.addEventListener('seeked', onSeeked);
            audioElement.addEventListener('timeupdate', onTimeUpdate);

            return () => {
                audioElement.removeEventListener('play', onPlay);
                audioElement.removeEventListener('pause', onPause);
                audioElement.removeEventListener('seeked', onSeeked);
                audioElement.removeEventListener('timeupdate', onTimeUpdate);
                cancelAnimationFrame(requestRef.current);
            };
        } else {
            return () => cancelAnimationFrame(requestRef.current);
        }
    }, [audioRef, updateTime, isPlaying, internalIsPlaying]);

    const seek = useCallback((time) => {
        if (audioRef?.current) {
            audioRef.current.currentTime = time;
            setPlaybackTime(time);
        } else if (audioRef?.seekTo) {
            audioRef.seekTo(time, true);
            setPlaybackTime(time);
        }
    }, [audioRef]);

    const play = useCallback(() => {
        audioRef?.current?.play();
        audioRef?.playVideo?.();
    }, [audioRef]);

    const pause = useCallback(() => {
        audioRef?.current?.pause();
        audioRef?.pauseVideo?.();
    }, [audioRef]);

    return {
        playbackTime,
        isPlaying,
        seek,
        play,
        pause
    };
}
