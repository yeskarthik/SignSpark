/**
 * SignSpark — Media Renderer
 * Displays reviewed local media or privacy-enhanced YouTube embeds.
 */

const MediaRenderer = (() => {
    const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
    const youtubePlayers = new WeakMap();
    let youtubeApiPromise = null;
    let preloadEntry = null;

    function clear(container, attribution) {
        const image = container.querySelector('[data-media-image]');
        let video = container.querySelector('[data-media-video]');
        const message = container.querySelector('[data-media-message]');

        const player = youtubePlayers.get(video);
        if (player) {
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
        container.classList.remove('is-quiz-video');
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

        renderAttribution(media, attribution);
    }

    function renderYouTube(media, card, container, purpose) {
        if (!YOUTUBE_ID_PATTERN.test(media.videoId || '')) {
            showMessage(container, 'This sign video is unavailable.');
            return;
        }

        let video = container.querySelector('[data-media-video]');
        const preloadedVideo = takePreloadedVideo(media, purpose);
        if (preloadedVideo) {
            video.replaceWith(preloadedVideo);
            video = preloadedVideo;
            video.removeAttribute('aria-hidden');
            video.removeAttribute('style');
        }

        container.classList.add('is-video');

        if (purpose === 'quiz') {
            container.classList.add('is-quiz-video');
            video.title = 'ASL sign quiz video';
        } else {
            video.title = `ASL sign for "${card.word}"`;
        }

        if (!preloadedVideo) {
            video.src = getYouTubeUrl(media, purpose);
        }
        video.style.display = '';

        enableYouTubePlayer(video, purpose, container);
    }

    function getYouTubeUrl(media, purpose) {
        const params = new URLSearchParams({
            playsinline: '1',
            rel: '0',
            enablejsapi: '1'
        });

        if (purpose === 'quiz') {
            params.set('autoplay', '1');
            params.set('mute', '1');
            params.set('controls', '0');
            params.set('disablekb', '1');
            params.set('fs', '0');
            params.set('iv_load_policy', '3');
        }
        if (/^https?:$/.test(window.location.protocol)) {
            params.set('origin', window.location.origin);
        }

        const host = purpose === 'quiz'
            ? 'https://www.youtube-nocookie.com'
            : 'https://www.youtube.com';
        return `${host}/embed/${media.videoId}?${params}`;
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
        const identity = media.type === 'youtube' ? media.videoId : media.src;
        return `${purpose}:${media.type}:${identity}`;
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

    function enableYouTubePlayer(video, purpose, container) {
        const expectedSrc = video.src;
        loadYouTubeApi().then((YT) => {
            if (!video.isConnected || video.src !== expectedSrc) return;

            const player = new YT.Player(video, {
                events: {
                    onReady: (event) => {
                        if (purpose !== 'quiz') return;
                        event.target.mute();
                        if (video.dataset.preloaded === 'true') {
                            event.target.seekTo(0, true);
                            delete video.dataset.preloaded;
                        }
                        event.target.playVideo();
                    },
                    onStateChange: (event) => {
                        if (purpose !== 'quiz') return;
                        // Avoid playlist looping, which adds previous/next controls.
                        if (event.data !== YT.PlayerState.ENDED) return;
                        event.target.seekTo(0, true);
                        event.target.playVideo();
                    },
                    onError: (event) => {
                        video.style.display = 'none';
                        showMessage(
                            container,
                            `This sign video could not be played (YouTube error ${event.data}). ` +
                            'Use the reviewed source link below.'
                        );
                    }
                }
            });
            youtubePlayers.set(video, player);
        }).catch((error) => {
            console.error(error);
        });
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

    function renderAttribution(media, attribution) {
        const label = document.createElement('span');
        label.textContent = media.reviewed ? 'Reviewed source: ' : 'Legacy media — not yet reviewed';
        attribution.appendChild(label);

        if (media.sourceUrl && media.sourceName) {
            const link = document.createElement('a');
            link.href = media.sourceUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = media.sourceName;
            attribution.appendChild(link);
        }

        attribution.style.display = '';
    }

    return { cancelPreload, clear, preload, render };
})();
