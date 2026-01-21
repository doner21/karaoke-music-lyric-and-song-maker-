import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';

/**
 * ElectronYouTubePlayer - A YouTube player component
 * 
 * Uses the standard YouTube IFrame API which works in both browser and Electron
 * when Electron is properly configured (webSecurity: false, etc.)
 * 
 * Note: We previously tried a webview-based approach for Electron but it caused
 * YouTube Error 153 (player configuration error). The IFrame API works better.
 */
const ElectronYouTubePlayer = forwardRef(({
    videoId,
    onReady,
    onStateChange,
    onTimeUpdate,
    onError,
    autoplay = true,
    controls = false,
    muted = false,
    className = '',
    style = {}
}, ref) => {
    const containerRef = useRef(null);
    const playerRef = useRef(null);
    const intervalRef = useRef(null);
    // Always use IFrame API - webview causes Error 153
    const [isElectron] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [playerState, setPlayerState] = useState(-1);

    // Expose player-like API via ref
    useImperativeHandle(ref, () => ({
        playVideo: () => {
            if (isElectron && webviewRef.current) {
                webviewRef.current.executeJavaScript('document.querySelector("video")?.play()');
            } else if (playerRef.current?.playVideo) {
                playerRef.current.playVideo();
            }
        },
        pauseVideo: () => {
            if (isElectron && webviewRef.current) {
                webviewRef.current.executeJavaScript('document.querySelector("video")?.pause()');
            } else if (playerRef.current?.pauseVideo) {
                playerRef.current.pauseVideo();
            }
        },
        stopVideo: () => {
            if (isElectron && webviewRef.current) {
                webviewRef.current.executeJavaScript(`
                    const video = document.querySelector("video");
                    if (video) { video.pause(); video.currentTime = 0; }
                `);
            } else if (playerRef.current?.stopVideo) {
                playerRef.current.stopVideo();
            }
        },
        seekTo: (seconds, allowSeekAhead = true) => {
            if (isElectron && webviewRef.current) {
                webviewRef.current.executeJavaScript(`
                    const video = document.querySelector("video");
                    if (video) { video.currentTime = ${seconds}; }
                `);
            } else if (playerRef.current?.seekTo) {
                playerRef.current.seekTo(seconds, allowSeekAhead);
            }
        },
        getCurrentTime: () => currentTime,
        getDuration: () => duration,
        setVolume: (volume) => {
            if (isElectron && webviewRef.current) {
                webviewRef.current.executeJavaScript(`
                    const video = document.querySelector("video");
                    if (video) { video.volume = ${volume / 100}; }
                `);
            } else if (playerRef.current?.setVolume) {
                playerRef.current.setVolume(volume);
            }
        },
        mute: () => {
            if (isElectron && webviewRef.current) {
                webviewRef.current.executeJavaScript('document.querySelector("video").muted = true');
            } else if (playerRef.current?.mute) {
                playerRef.current.mute();
            }
        },
        unMute: () => {
            if (isElectron && webviewRef.current) {
                webviewRef.current.executeJavaScript('document.querySelector("video").muted = false');
            } else if (playerRef.current?.unMute) {
                playerRef.current.unMute();
            }
        },
        isMuted: () => muted,
        loadVideoById: (newVideoId) => {
            if (isElectron && webviewRef.current) {
                const embedUrl = `https://www.youtube.com/embed/${newVideoId}?autoplay=1&controls=0&enablejsapi=1&modestbranding=1&rel=0`;
                webviewRef.current.src = embedUrl;
            } else if (playerRef.current?.loadVideoById) {
                playerRef.current.loadVideoById(newVideoId);
            }
        },
        getPlayerState: () => playerState,
    }), [currentTime, duration, isElectron, muted, playerState]);

    // Initialize YouTube IFrame API
    useEffect(() => {
        if (isElectron) return; // Skip for Electron (though isElectron is always false now)

        // Load YouTube IFrame API if not already loaded
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            tag.onerror = () => {
                console.error('[ElectronYouTubePlayer] Failed to load YouTube IFrame API');
                onError?.({ error: 'Failed to load YouTube IFrame API' });
            };
            document.body.appendChild(tag);
        }

        const initPlayer = () => {
            if (!containerRef.current || !window.YT?.Player || !videoId) return;

            try {
                console.log('[ElectronYouTubePlayer] Initializing YouTube player for video:', videoId);

                playerRef.current = new window.YT.Player(containerRef.current, {
                    height: '100%',
                    width: '100%',
                    videoId: videoId,
                    playerVars: {
                        autoplay: autoplay ? 1 : 0,
                        controls: controls ? 1 : 0,
                        modestbranding: 1,
                        rel: 0,
                        origin: window.location.origin, // Required for cross-origin in Electron
                        enablejsapi: 1,
                    },
                    events: {
                        onReady: (e) => {
                            console.log('[ElectronYouTubePlayer] Player ready');
                            setIsReady(true);
                            setDuration(e.target.getDuration());
                            onReady?.(e);
                        },
                        onStateChange: (e) => {
                            setPlayerState(e.data);
                            onStateChange?.(e);
                        },
                        onError: (e) => {
                            console.error('[ElectronYouTubePlayer] YouTube Error:', e.data);
                            // YouTube error codes: https://developers.google.com/youtube/iframe_api_reference#onError
                            const errorMessages = {
                                2: 'Invalid video ID',
                                5: 'HTML5 player error',
                                100: 'Video not found or private',
                                101: 'Video cannot be played in embedded players',
                                150: 'Video cannot be played in embedded players',
                            };
                            onError?.({
                                code: e.data,
                                message: errorMessages[e.data] || `Unknown error: ${e.data}`
                            });
                        },
                    },
                });
            } catch (err) {
                console.error('[ElectronYouTubePlayer] Failed to create player:', err);
                onError?.({ error: err.message });
            }
        };

        // Wait for YT API to load
        if (window.YT?.Player) {
            initPlayer();
        } else {
            window.onYouTubeIframeAPIReady = initPlayer;
        }

        return () => {
            if (playerRef.current?.destroy) {
                try {
                    playerRef.current.destroy();
                } catch (e) {
                    // Ignore destroy errors
                }
            }
        };
    }, [isElectron, videoId, autoplay, controls, onError]);

    // Set up time tracking for browser mode
    useEffect(() => {
        if (isElectron || !isReady) return;

        intervalRef.current = setInterval(() => {
            if (playerRef.current?.getCurrentTime) {
                const time = playerRef.current.getCurrentTime();
                setCurrentTime(time);
                onTimeUpdate?.(time);
            }
        }, 100);

        return () => clearInterval(intervalRef.current);
    }, [isElectron, isReady, onTimeUpdate]);

    // Electron webview setup
    useEffect(() => {
        if (!isElectron || !videoId) return;

        const webview = webviewRef.current;
        if (!webview) return;

        const handleDomReady = () => {
            console.log('[ElectronYouTubePlayer] Webview DOM ready');

            // Start polling for video state
            intervalRef.current = setInterval(async () => {
                try {
                    const result = await webview.executeJavaScript(`
                        (function() {
                            const video = document.querySelector('video');
                            if (video) {
                                return {
                                    currentTime: video.currentTime,
                                    duration: video.duration || 0,
                                    paused: video.paused,
                                    ready: video.readyState >= 2
                                };
                            }
                            return null;
                        })()
                    `);

                    if (result) {
                        if (result.duration && result.duration !== duration) {
                            setDuration(result.duration);
                        }
                        if (result.currentTime !== currentTime) {
                            setCurrentTime(result.currentTime);
                            onTimeUpdate?.(result.currentTime);
                        }
                        if (result.ready && !isReady) {
                            setIsReady(true);
                            onReady?.({ target: ref.current });
                        }
                        const newState = result.paused ? 2 : 1; // 2 = paused, 1 = playing
                        if (newState !== playerState) {
                            setPlayerState(newState);
                            onStateChange?.({ data: newState });
                        }
                    }
                } catch (e) {
                    // Webview might not be ready yet
                }
            }, 100);
        };

        const handleCrash = () => {
            console.error('[ElectronYouTubePlayer] Webview crashed, attempting reload');
            setTimeout(() => webview.reload(), 1000);
        };

        webview.addEventListener('dom-ready', handleDomReady);
        webview.addEventListener('crashed', handleCrash);

        return () => {
            clearInterval(intervalRef.current);
            webview.removeEventListener('dom-ready', handleDomReady);
            webview.removeEventListener('crashed', handleCrash);
        };
    }, [isElectron, videoId, isReady, duration, currentTime, playerState, onReady, onStateChange, onTimeUpdate, ref]);

    // Render
    if (isElectron) {
        const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=${autoplay ? 1 : 0}&controls=${controls ? 1 : 0}&enablejsapi=1&modestbranding=1&rel=0&mute=${muted ? 1 : 0}`;

        return (
            <webview
                ref={webviewRef}
                src={embedUrl}
                className={className}
                style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    ...style
                }}
                allowpopups="true"
                partition="persist:youtube"
            />
        );
    }

    // Browser mode: standard div for YT.Player
    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                width: '100%',
                height: '100%',
                ...style
            }}
        />
    );
});

ElectronYouTubePlayer.displayName = 'ElectronYouTubePlayer';

export default ElectronYouTubePlayer;
