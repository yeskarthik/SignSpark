/**
 * SignSpark — Media Renderer
 * Displays reviewed local media or privacy-enhanced YouTube embeds.
 */

const MediaRenderer = (() => {
    const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

    function clear(container, attribution) {
        const image = container.querySelector('[data-media-image]');
        const video = container.querySelector('[data-media-video]');
        const message = container.querySelector('[data-media-message]');

        image.onerror = null;
        image.removeAttribute('src');
        image.style.display = 'none';
        video.removeAttribute('src');
        video.style.display = 'none';
        message.textContent = '';
        message.style.display = 'none';
        container.classList.remove('is-video');
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

        const video = container.querySelector('[data-media-video]');
        container.classList.add('is-video');
        const params = new URLSearchParams({
            playsinline: '1',
            rel: '0'
        });

        if (purpose === 'quiz') {
            params.set('autoplay', '1');
            params.set('mute', '1');
            params.set('controls', '0');
            params.set('disablekb', '1');
            params.set('fs', '0');
            params.set('iv_load_policy', '3');
            params.set('loop', '1');
            params.set('playlist', media.videoId);
            video.title = 'ASL sign quiz video';
        } else {
            video.title = `ASL sign for "${card.word}"`;
        }

        video.src = `https://www.youtube-nocookie.com/embed/${media.videoId}?${params}`;
        video.style.display = '';
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

    return { clear, render };
})();
