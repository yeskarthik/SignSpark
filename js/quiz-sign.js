/**
 * SignSpark — Mode 1: How Do You Sign This? (Word → Sign)
 * Shows word, user attempts to sign, reveals GIF, self-rates.
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
        elements.gif = document.getElementById('wts-gif');
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
        loadNextCard();
    }

    function loadNextCard() {
        const prevSlug = currentCard ? currentCard.slug : null;
        currentCard = FlashcardEngine.getNextCard(prevSlug);

        if (!currentCard) {
            elements.word.textContent = 'No cards available';
            elements.revealBtn.style.display = 'none';
            return;
        }

        isRevealed = false;
        elements.card.classList.remove('flipped');

        // Front side
        elements.word.textContent = currentCard.word;
        elements.category.textContent = formatCategory(currentCard.category);

        // Back side (pre-load)
        elements.wordBack.textContent = currentCard.word;
        elements.categoryBack.textContent = formatCategory(currentCard.category);

        // Load GIF
        const gifPath = FlashcardEngine.getGifPath(currentCard);
        elements.gif.src = '';
        elements.gif.alt = `ASL sign for "${currentCard.word}"`;
        elements.gif.style.display = '';

        elements.gif.onerror = () => {
            elements.gif.onerror = null;
            elements.gif.style.display = 'none';
        };
        elements.gif.src = gifPath;

        // Always show text guide below image
        showTextGuide(currentCard);

        elements.revealBtn.style.display = '';

        // Update progress
        App.updateProgress();
    }

    function reveal() {
        isRevealed = true;
        elements.card.classList.add('flipped');
    }

    function showTextGuide(card) {
        const guide = FlashcardEngine.getTextGuide(card);
        const desc = elements.textGuide.querySelector('.text-guide-desc');
        if (guide) {
            desc.textContent = guide;
            elements.textGuide.style.display = '';
        } else {
            elements.textGuide.style.display = 'none';
        }
    }

    function rate(gotIt) {
        FlashcardEngine.recordResult(currentCard.slug, gotIt);
        App.updateStats();
        loadNextCard();
    }

    function formatCategory(cat) {
        return cat.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    return { init, start, loadNextCard };
})();
