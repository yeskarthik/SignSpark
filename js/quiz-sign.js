/**
 * SignSpark — Mode 1: How Do You Sign This? (Word → Sign)
 * Shows word, user attempts to sign, reveals reviewed media, self-rates.
 */

const QuizSign = (() => {
    let currentCard = null;
    let isRevealed = false;

    const elements = {};

    function init() {
        elements.card = document.getElementById('card-wts');
        elements.word = document.getElementById('wts-word');
        elements.wordBack = document.getElementById('wts-word-back');
        elements.category = document.getElementById('wts-category');
        elements.categoryBack = document.getElementById('wts-category-back');
        elements.media = document.getElementById('wts-media');
        elements.mediaAttribution = document.getElementById('wts-media-attribution');
        elements.textGuide = document.getElementById('wts-text-guide');
        elements.revealBtn = document.getElementById('wts-reveal');
        elements.gotItBtn = document.getElementById('wts-got-it');
        elements.needPracticeBtn = document.getElementById('wts-need-practice');

        elements.revealBtn.addEventListener('click', reveal);
        elements.gotItBtn.addEventListener('click', () => rate(true));
        elements.needPracticeBtn.addEventListener('click', () => rate(false));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (document.getElementById('screen-word-to-sign').classList.contains('active')) {
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    if (!isRevealed) reveal();
                }
                if (isRevealed && (e.key === 'ArrowRight' || e.key === '1')) rate(true);
                if (isRevealed && (e.key === 'ArrowLeft' || e.key === '2')) rate(false);
            }
        });
    }

    function start() {
        stop();
        loadNextCard();
    }

    function stop() {
        if (currentCard) {
            FlashcardEngine.releaseCardPresentation(currentCard.slug);
        }
        currentCard = null;
        MediaRenderer.clear(elements.media, elements.mediaAttribution);
    }

    function loadNextCard() {
        const prevSlug = currentCard ? currentCard.slug : null;
        currentCard = FlashcardEngine.getNextCard(prevSlug, 'learning');

        if (!currentCard) {
            App.showScreen('home');
            return;
        }

        FlashcardEngine.markCardPresented(currentCard.slug);
        isRevealed = false;
        elements.card.classList.remove('flipped');

        // Front side
        elements.word.textContent = currentCard.word;
        elements.category.textContent = formatCategory(currentCard.category);

        // Back side (pre-load)
        elements.wordBack.textContent = currentCard.word;
        elements.categoryBack.textContent = formatCategory(currentCard.category);

        // Avoid loading third-party media until the answer is revealed.
        MediaRenderer.clear(elements.media, elements.mediaAttribution);

        // Always show text guide below image
        showTextGuide(currentCard);

        elements.revealBtn.style.display = '';

        // Update progress
        App.updateProgress();
    }

    function reveal() {
        isRevealed = true;
        MediaRenderer.render(currentCard, elements.media, elements.mediaAttribution);
        elements.card.classList.add('flipped');
    }

    function showTextGuide(card) {
        const guide = FlashcardEngine.getTextGuide(card);
        const desc = elements.textGuide.querySelector('.text-guide-desc');
        const source = elements.textGuide.querySelector('.text-guide-source');
        if (guide) {
            desc.textContent = guide;
            const sourceUrl = FlashcardEngine.getTextGuideSource(card);
            source.href = sourceUrl || '';
            source.style.display = sourceUrl ? '' : 'none';
            elements.textGuide.style.display = '';
        } else {
            source.removeAttribute('href');
            elements.textGuide.style.display = 'none';
        }
    }

    function rate(gotIt) {
        if (!currentCard) return;
        FlashcardEngine.recordResult(currentCard.slug, gotIt);
        App.updateStats();
        loadNextCard();
    }

    function formatCategory(cat) {
        return cat.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    return { init, start, stop, loadNextCard };
})();
