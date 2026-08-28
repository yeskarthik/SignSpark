/**
 * SignSpark — Mode 2: What Is This Sign? (Sign → Word)
 * Shows sign media, user guesses via multiple choice or free text.
 */

const QuizWord = (() => {
    const AUTO_ADVANCE_DELAY_MS = 900;
    let currentCard = null;
    let nextCard = null;
    let answerMode = 'mc'; // 'mc' or 'text'
    let answered = false;
    let advanceTimer = null;
    let lastCorrectOptionIndex = null;

    const elements = {};

    function init() {
        elements.media = document.getElementById('stw-media');
        elements.mediaAttribution = document.getElementById('stw-media-attribution');
        elements.textGuide = document.getElementById('stw-text-guide');
        elements.mcSection = document.getElementById('mc-section');
        elements.textSection = document.getElementById('text-section');
        elements.mcOptions = document.getElementById('mc-options');
        elements.textAnswer = document.getElementById('text-answer');
        elements.checkBtn = document.getElementById('btn-check-answer');
        elements.feedback = document.getElementById('stw-feedback');
        elements.feedbackContent = document.getElementById('stw-feedback-content');
        elements.nextBtn = document.getElementById('stw-next');
        elements.mcModeBtn = document.getElementById('btn-mc-mode');
        elements.textModeBtn = document.getElementById('btn-text-mode');

        elements.mcModeBtn.addEventListener('click', () => setAnswerMode('mc'));
        elements.textModeBtn.addEventListener('click', () => setAnswerMode('text'));
        elements.checkBtn.addEventListener('click', checkTextAnswer);
        elements.nextBtn.addEventListener('click', loadNextCard);

        elements.textAnswer.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') checkTextAnswer();
        });
    }

    function setAnswerMode(mode) {
        if (!currentCard) return;
        answerMode = mode;
        elements.mcModeBtn.classList.toggle('active', mode === 'mc');
        elements.textModeBtn.classList.toggle('active', mode === 'text');
        elements.mcSection.style.display = mode === 'mc' ? '' : 'none';
        elements.textSection.style.display = mode === 'text' ? '' : 'none';

        if (!answered) {
            if (mode === 'mc') renderMcOptions();
            if (mode === 'text') elements.textAnswer.focus();
        }
    }

    function start() {
        stop();
        currentCard = null;
        lastCorrectOptionIndex = null;
        loadNextCard();
    }

    function loadNextCard() {
        clearTimeout(advanceTimer);
        advanceTimer = null;
        const prevSlug = currentCard ? currentCard.slug : null;
        currentCard = nextCard || FlashcardEngine.getNextCard(prevSlug, 'quiz');
        nextCard = null;
        answered = false;

        if (!currentCard) {
            answered = true;
            MediaRenderer.cancelPreload();
            elements.mcModeBtn.disabled = true;
            elements.textModeBtn.disabled = true;
            elements.feedbackContent.textContent =
                FlashcardEngine.getPendingRetryCount() > 0
                    ? 'Your retry is scheduled after ten other answers. Widen your filters to keep practicing.'
                    : 'No reviewed quiz-safe media is available for this category yet.';
            elements.feedbackContent.className = 'feedback-content incorrect';
            elements.feedback.style.display = '';
            elements.mcSection.style.display = 'none';
            elements.textSection.style.display = 'none';
            return;
        }

        elements.mcModeBtn.disabled = false;
        elements.textModeBtn.disabled = false;
        FlashcardEngine.markCardPresented(currentCard.slug);
        MediaRenderer.render(currentCard, elements.media, elements.mediaAttribution, 'quiz');

        // A movement description would reveal the answer before the user guesses.
        elements.textGuide.style.display = 'none';

        // Reset UI
        elements.feedback.style.display = 'none';
        elements.nextBtn.style.display = '';
        elements.textAnswer.value = '';

        if (answerMode === 'mc') {
            renderMcOptions();
            elements.mcSection.style.display = '';
            elements.textSection.style.display = 'none';
        } else {
            elements.mcSection.style.display = 'none';
            elements.textSection.style.display = '';
            elements.textAnswer.focus();
        }

        App.updateProgress();
        prepareNextCard();
    }

    function prepareNextCard() {
        nextCard = FlashcardEngine.getNextCard(currentCard.slug, 'quiz');
        if (nextCard) {
            MediaRenderer.preload(nextCard, 'quiz');
        } else {
            MediaRenderer.cancelPreload();
        }
    }

    function stop() {
        clearTimeout(advanceTimer);
        advanceTimer = null;
        if (currentCard) {
            FlashcardEngine.releaseCardPresentation(currentCard.slug);
        }
        currentCard = null;
        nextCard = null;
        MediaRenderer.cancelPreload();
        if (elements.media) {
            MediaRenderer.clear(elements.media, elements.mediaAttribution);
        }
    }

    function renderMcOptions() {
        if (!currentCard) return;
        elements.mcOptions.innerHTML = '';

        const distractors = FlashcardEngine.getRandomDistractors(currentCard, 3);
        for (let i = distractors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [distractors[i], distractors[j]] = [distractors[j], distractors[i]];
        }

        const optionCount = distractors.length + 1;
        let positions = Array.from({ length: optionCount }, (_, index) => index)
            .filter(index => index !== lastCorrectOptionIndex);
        if (positions.length === 0) positions = [0];
        const correctIndex = positions[Math.floor(Math.random() * positions.length)];
        const options = [...distractors];
        options.splice(correctIndex, 0, currentCard);
        lastCorrectOptionIndex = correctIndex;

        for (const opt of options) {
            const btn = document.createElement('button');
            btn.className = 'mc-option';
            btn.textContent = opt.word;
            btn.addEventListener('click', () => handleMcChoice(btn, opt));
            elements.mcOptions.appendChild(btn);
        }
    }

    function handleMcChoice(btnEl, chosen) {
        if (answered || !currentCard) return;
        answered = true;

        const isCorrect = chosen.slug === currentCard.slug;
        FlashcardEngine.recordResult(currentCard.slug, isCorrect);
        refreshPreparedCard(isCorrect);

        // Highlight all options
        const allBtns = elements.mcOptions.querySelectorAll('.mc-option');
        allBtns.forEach(btn => {
            btn.classList.add('disabled');
            if (btn.textContent === currentCard.word) {
                btn.classList.add('correct');
            }
        });

        if (!isCorrect) {
            btnEl.classList.add('incorrect');
        }

        showFeedback(isCorrect);
        App.updateStats();
    }

    function checkTextAnswer() {
        if (answered || !currentCard) return;
        const input = elements.textAnswer.value.trim();
        if (!input) return;

        answered = true;

        const isCorrect = fuzzyMatch(input, currentCard.word);
        FlashcardEngine.recordResult(currentCard.slug, isCorrect);
        refreshPreparedCard(isCorrect);
        showFeedback(isCorrect);
        App.updateStats();
    }

    function refreshPreparedCard(isCorrect) {
        if (
            FlashcardEngine.hasDueRetry('quiz') ||
            (nextCard && FlashcardEngine.isRetryScheduled(nextCard.slug)) ||
            (isCorrect && nextCard?.slug === currentCard.slug)
        ) {
            MediaRenderer.cancelPreload();
            prepareNextCard();
        }
    }

    function fuzzyMatch(input, target) {
        const a = input.toLowerCase().replace(/[^a-z0-9]/g, '');
        const b = target.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (a === b) return true;

        // Allow minor typos using Levenshtein distance
        const dist = levenshtein(a, b);
        const threshold = Math.max(1, Math.floor(b.length * 0.25));
        return dist <= threshold;
    }

    function levenshtein(s, t) {
        const m = s.length, n = t.length;
        const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const cost = s[i - 1] === t[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + cost
                );
            }
        }

        return dp[m][n];
    }

    function showFeedback(isCorrect) {
        elements.feedback.style.display = '';
        elements.feedbackContent.className = 'feedback-content ' + (isCorrect ? 'correct' : 'incorrect');

        if (isCorrect) {
            elements.feedbackContent.textContent = '✓ Correct! Next question…';
            elements.nextBtn.style.display = 'none';
            advanceTimer = setTimeout(loadNextCard, AUTO_ADVANCE_DELAY_MS);
        } else {
            elements.feedbackContent.textContent = `✗ The answer is: ${currentCard.word}`;
            elements.nextBtn.style.display = '';
        }

        showTextGuide(currentCard);
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

    return { init, start, stop, loadNextCard, setAnswerMode };
})();
