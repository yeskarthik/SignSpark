/**
 * SignSpark — Media Renderer
 * Displays reviewed local media or privacy-enhanced YouTube embeds.
 */

const MediaRenderer = (() => {
    const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
    const MAX_PLAYER_RETRIES = 2;
    const PLAYER_START_TIMEOUT_MS = 12000;
    const MOBILE_PLAYER_START_TIMEOUT_MS = 4000;
    const youtubePlayers = new WeakMap();
    const youtubeStartupTimers = new WeakMap();
    const youtubeSegmentTimers = new WeakMap();
    const nativeSegmentTimers = new WeakMap();
    const reportedMedia = new Set();
    let youtubeApiPromise = null;
    let preloadEntry = null;

    function clear(container, attribution) {
        const image = container.querySelector('[data-media-image]');
        let video = container.querySelector('[data-media-video]');
        const message = container.querySelector('[data-media-message]');

        clearNativeSegmentTimer(video);
        video.onload = null;
        const player = youtubePlayers.get(video);
        if (player) {
            clearPlayerTimer(video);
            clearSegmentTimer(video);
            const replacement = video.cloneNode(false);
            const nextSibling = video.nextSibling;
            player.destroy();
            youtubePlayers.delete(video);
            container.insertBefore(replacement, nextSibling);
            video = replacement;
        }

        image.onerror = null;
        image.removeAttribute('src');
        image.style.display = 'none';
        video.removeAttribute('src');
        video.style.display = 'none';
        message.textContent = '';
        message.style.display = 'none';
        container.classList.remove('is-video');
        container.classList.remove('is-looping-video');
        container.classList.remove('is-touch-video');
        attribution.replaceChildren();
        attribution.style.display = 'none';
    }

    function render(card, container, attribution, purpose = 'learning') {
        clear(container, attribution);

        const media = FlashcardEngine.getMedia(card, purpose);
        if (!media) {
            showMessage(container, 'No reviewed sign media is available yet.');
            return;
        }

        if (media.type === 'youtube') {
            renderYouTube(media, card, container, purpose);
        } else if (media.type === 'image') {
            renderImage(media, card, container);
        } else {
            showMessage(container, 'This sign uses an unsupported media format.');
            return;
        }

        renderAttribution(media, attribution, card, purpose);
    }

    function renderYouTube(media, card, container, purpose) {
        if (!YOUTUBE_ID_PATTERN.test(media.videoId || '')) {
            showMessage(container, 'This sign video is unavailable.');
            return;
        }

        const touchDevice = isTouchDevice();
        let video = container.querySelector('[data-media-video]');
        const preloadedVideo = takePreloadedVideo(media, purpose);
        if (preloadedVideo) {
            video.replaceWith(preloadedVideo);
            video = preloadedVideo;
            video.removeAttribute('aria-hidden');
            video.removeAttribute('style');
        }

        container.classList.add('is-video');
        container.classList.add('is-looping-video');
        container.classList.toggle('is-touch-video', touchDevice);

        if (purpose === 'quiz') {
            video.title = 'ASL sign quiz video';
        } else {
            video.title = `ASL sign for "${card.word}"`;
        }

        if (!preloadedVideo) {
            const sourceUrl = getYouTubeUrl(media, purpose, touchDevice);
            if (touchDevice && hasSegment(media)) {
                enableNativeSegmentLoop(video, sourceUrl, media);
            }
            video.src = sourceUrl;
        }
        video.loading = touchDevice ? 'eager' : 'lazy';
        video.style.display = '';

        // Let WebKit own the media lifecycle; its player API is unreliable on iPhone.
        if (touchDevice) return;

        enableYouTubePlayer(video, purpose, container, media);
    }

    function getYouTubeUrl(media, purpose, nativePlayback = false) {
        const params = new URLSearchParams({
            playsinline: '1',
            rel: '0',
            autoplay: '1',
            mute: '1',
            controls: '0',
            disablekb: '1',
            fs: '0',
            iv_load_policy: '3'
        });

        if (nativePlayback) {
            if (!hasSegment(media)) {
                params.set('loop', '1');
                params.set('playlist', media.videoId);
            }
        } else {
            params.set('enablejsapi', '1');
        }
        if (!nativePlayback && /^https?:$/.test(window.location.protocol)) {
            params.set('origin', window.location.origin);
        }
        if (hasSegment(media)) {
            params.set('start', String(Math.floor(media.startSeconds)));
            params.set('end', String(Math.ceil(media.endSeconds)));
        }

        return `https://www.youtube.com/embed/${media.videoId}?${params}`;
    }

    function enableNativeSegmentLoop(video, sourceUrl, media) {
        video.onload = () => {
            clearNativeSegmentTimer(video);
            const durationMs = (media.endSeconds - media.startSeconds) * 1000;
            const timer = setTimeout(() => {
                if (!video.isConnected || video.style.display === 'none') return;
                const replayUrl = new URL(sourceUrl);
                replayUrl.searchParams.set('replay', String(Date.now()));
                video.src = replayUrl.toString();
            }, durationMs + 1000);
            nativeSegmentTimers.set(video, timer);
        };
    }

    function clearNativeSegmentTimer(video) {
        clearTimeout(nativeSegmentTimers.get(video));
        nativeSegmentTimers.delete(video);
    }

    function preload(card, purpose = 'quiz') {
        cancelPreload();

        const media = FlashcardEngine.getMedia(card, purpose);
        if (!media) return;

        if (media.type === 'image' && media.src) {
            const image = new Image();
            image.src = media.src;
            preloadEntry = { key: getMediaKey(media, purpose), element: image };
            return;
        }

        if (media.type !== 'youtube' || !YOUTUBE_ID_PATTERN.test(media.videoId || '')) {
            return;
        }
        if (isTouchDevice()) return;

        const video = document.createElement('iframe');
        video.className = 'sign-media-video';
        video.dataset.mediaVideo = '';
        video.title = 'ASL sign quiz video';
        video.loading = 'eager';
        video.allow = 'autoplay; encrypted-media; picture-in-picture; web-share';
        video.referrerPolicy = 'strict-origin-when-cross-origin';
        video.allowFullscreen = true;
        video.setAttribute('aria-hidden', 'true');
        video.dataset.preloaded = 'true';
        Object.assign(video.style, {
            position: 'fixed',
            left: '-10000px',
            top: '0',
            width: '400px',
            height: '353px',
            opacity: '0',
            pointerEvents: 'none'
        });
        video.src = getYouTubeUrl(media, purpose);
        document.body.appendChild(video);
        preloadEntry = { key: getMediaKey(media, purpose), element: video };
    }

    function takePreloadedVideo(media, purpose) {
        if (!preloadEntry || preloadEntry.key !== getMediaKey(media, purpose)) {
            return null;
        }

        const { element } = preloadEntry;
        preloadEntry = null;
        return element instanceof HTMLIFrameElement ? element : null;
    }

    function cancelPreload() {
        if (!preloadEntry) return;
        if (preloadEntry.element instanceof HTMLIFrameElement) {
            preloadEntry.element.remove();
        }
        preloadEntry = null;
    }

    function getMediaKey(media, purpose) {
        const identity = media.type === 'youtube'
            ? getYouTubeMediaKey(media)
            : media.src;
        return `${purpose}:${media.type}:${identity}`;
    }

    function getYouTubeMediaKey(media) {
        const segment = hasSegment(media)
            ? `:${media.startSeconds}-${media.endSeconds}`
            : '';
        return `${media.videoId}${segment}`;
    }

    function hasSegment(media) {
        return Number.isFinite(media.startSeconds) &&
            Number.isFinite(media.endSeconds) &&
            media.startSeconds >= 0 &&
            media.endSeconds > media.startSeconds;
    }

    function isTouchDevice() {
        return navigator.maxTouchPoints > 0 ||
            window.matchMedia?.('(pointer: coarse)').matches === true;
    }

    function loadYouTubeApi() {
        if (window.YT && window.YT.Player) {
            return Promise.resolve(window.YT);
        }

        if (!youtubeApiPromise) {
            youtubeApiPromise = new Promise((resolve, reject) => {
                const previousReady = window.onYouTubeIframeAPIReady;
                window.onYouTubeIframeAPIReady = () => {
                    if (previousReady) previousReady();
                    resolve(window.YT);
                };

                const script = document.createElement('script');
                script.src = 'https://www.youtube.com/iframe_api';
                script.async = true;
                script.onerror = () => reject(new Error('Unable to load the YouTube player API.'));
                document.head.appendChild(script);
            });
        }

        return youtubeApiPromise;
    }

    function enableYouTubePlayer(video, purpose, container, media, attempt = 0) {
        const expectedSrc = video.src;
        loadYouTubeApi().then((YT) => {
            if (!video.isConnected || video.src !== expectedSrc) return;

            let recovering = false;
            let player = null;
            const recover = (reason) => {
                if (recovering || !video.isConnected) return;
                recovering = true;
                clearPlayerTimer(video);
                clearSegmentTimer(video);

                if (attempt < MAX_PLAYER_RETRIES) {
                    const replacement = video.cloneNode(false);
                    const nextSibling = video.nextSibling;
                    player.destroy();
                    youtubePlayers.delete(video);
                    container.insertBefore(replacement, nextSibling);

                    const retryUrl = new URL(expectedSrc);
                    retryUrl.searchParams.set('retry', `${attempt + 1}-${Date.now()}`);
                    replacement.src = retryUrl.toString();
                    replacement.style.display = '';
                    enableYouTubePlayer(replacement, purpose, container, media, attempt + 1);
                    return;
                }

                video.style.display = 'none';
                showMessage(
                    container,
                    `This sign video could not be played after ${MAX_PLAYER_RETRIES + 1} attempts ` +
                    `(${reason}). Use the reviewed source link below.`
                );
            };

            player = new YT.Player(video, {
                events: {
                    onReady: (event) => {
                        event.target.mute();
                        const loopStart = hasSegment(media) ? media.startSeconds : 0;
                        if (video.dataset.preloaded === 'true') {
                            event.target.seekTo(loopStart, true);
                            delete video.dataset.preloaded;
                        }
                        if (hasSegment(media)) {
                            event.target.seekTo(loopStart, true);
                            startSegmentTimer(video, event.target, media);
                        }
                        event.target.playVideo();
                    },
                    onStateChange: (event) => {
                        if (event.data === YT.PlayerState.PLAYING) {
                            clearPlayerTimer(video);
                        }
                        // Avoid playlist looping, which adds previous/next controls.
                        if (event.data !== YT.PlayerState.ENDED) return;
                        event.target.seekTo(
                            hasSegment(media) ? media.startSeconds : 0,
                            true
                        );
                        event.target.playVideo();
                    },
                    onError: (event) => {
                        recover(`YouTube error ${event.data}`);
                    }
                }
            });
            youtubePlayers.set(video, player);
            const startupTimer = setTimeout(() => {
                recover('startup timeout');
            }, isTouchDevice()
                ? MOBILE_PLAYER_START_TIMEOUT_MS
                : PLAYER_START_TIMEOUT_MS);
            youtubeStartupTimers.set(video, startupTimer);
        }).catch((error) => {
            console.error(error);
            video.style.display = 'none';
            showMessage(
                container,
                'The YouTube player could not be initialized. Use the reviewed source link below.'
            );
        });
    }

    function clearPlayerTimer(video) {
        clearTimeout(youtubeStartupTimers.get(video));
        youtubeStartupTimers.delete(video);
    }

    function startSegmentTimer(video, player, media) {
        clearSegmentTimer(video);
        const timer = setInterval(() => {
            if (!video.isConnected) {
                clearSegmentTimer(video);
                return;
            }
            if (player.getCurrentTime() >= media.endSeconds - 0.1) {
                player.seekTo(media.startSeconds, true);
                player.playVideo();
            }
        }, 100);
        youtubeSegmentTimers.set(video, timer);
    }

    function clearSegmentTimer(video) {
        clearInterval(youtubeSegmentTimers.get(video));
        youtubeSegmentTimers.delete(video);
    }

    function renderImage(media, card, container) {
        const image = container.querySelector('[data-media-image]');
        image.alt = `ASL sign for "${card.word}"`;
        image.onerror = () => {
            image.onerror = null;
            image.style.display = 'none';
            showMessage(container, 'This sign image could not be loaded.');
        };
        image.src = media.src;
        image.style.display = '';
    }

    function showMessage(container, text) {
        const message = container.querySelector('[data-media-message]');
        message.textContent = text;
        message.style.display = '';
    }

    function renderAttribution(media, attribution, card, purpose) {
        const sourceLine = document.createElement('div');
        sourceLine.className = 'media-source-line';
        const label = document.createElement('span');
        label.textContent = media.reviewed ? 'Reviewed source: ' : 'Legacy media — not yet reviewed';
        sourceLine.appendChild(label);

        if (media.sourceUrl && media.sourceName) {
            const link = document.createElement('a');
            link.href = media.sourceUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = media.sourceName;
            sourceLine.appendChild(link);
        }
        attribution.appendChild(sourceLine);

        if (media.type === 'youtube' && media.videoId) {
            renderReportButton(media, card, purpose, attribution);
        }

        attribution.style.display = '';
    }

    function renderReportButton(media, card, purpose, attribution) {
        const reportKey = [
            FlashcardEngine.getActiveProfile(),
            card.slug,
            purpose,
            media.videoId
        ].join(':');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'media-report-button';
        button.textContent = reportedMedia.has(reportKey)
            ? 'Reported — thank you'
            : 'Report video issue';
        button.disabled = reportedMedia.has(reportKey);
        button.addEventListener('click', async () => {
            button.disabled = true;
            button.textContent = 'Sending report…';

            try {
                const response = await fetch('/api/video-reports', {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        slug: card.slug,
                        word: card.word,
                        videoId: media.videoId,
                        startSeconds: media.startSeconds,
                        endSeconds: media.endSeconds,
                        purpose,
                        profile: FlashcardEngine.getActiveProfile(),
                        pageUrl: window.location.href
                    }),
                    keepalive: true
                });
                if (!response.ok) {
                    throw new Error(`Video report API returned ${response.status}.`);
                }

                reportedMedia.add(reportKey);
                button.textContent = 'Reported — thank you';
            } catch (error) {
                console.error('Could not report the video issue.', error);
                button.disabled = false;
                button.textContent = 'Report failed — try again';
            }
        });
        attribution.appendChild(button);
    }

    return { cancelPreload, clear, preload, render };
})();
