/**
 * SignSpark — Mode 2: What Is This Sign? (Sign → Word)
 * Shows GIF, user guesses via multiple choice or free text.
 */

const QuizWord = (() => {
    let currentCard = null;
    let answerMode = 'mc'; // 'mc' or 'text'
    let answered = false;

    const elements = {};

    function init() {
        elements.gif = document.getElementById('stw-gif');
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
        loadNextCard();
    }

    function loadNextCard() {
        const prevSlug = currentCard ? currentCard.slug : null;
        currentCard = FlashcardEngine.getNextCard(prevSlug, true); // requireGif=true
        answered = false;

        if (!currentCard) {
            elements.feedbackContent.textContent = 'No cards with GIFs available for this category';
            elements.feedbackContent.className = 'feedback-content incorrect';
            elements.feedback.style.display = '';
            elements.mcSection.style.display = 'none';
            elements.textSection.style.display = 'none';
            return;
        }

        // Load GIF
        const gifPath = FlashcardEngine.getGifPath(currentCard);
        elements.gif.src = '';
        elements.gif.alt = 'ASL sign — guess the word';
        elements.textGuide.style.display = 'none';
        elements.gif.style.display = '';
        elements.gif.onerror = () => {
            elements.gif.onerror = null;
            showTextGuide(currentCard);
        };
        elements.gif.src = gifPath;

        // Reset UI
        elements.feedback.style.display = 'none';
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
    }

    function renderMcOptions() {
        elements.mcOptions.innerHTML = '';

        const distractors = FlashcardEngine.getRandomDistractors(currentCard, 3);
        const options = [currentCard, ...distractors];

        // Shuffle
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }

        for (const opt of options) {
            const btn = document.createElement('button');
            btn.className = 'mc-option';
            btn.textContent = opt.word;
            btn.addEventListener('click', () => handleMcChoice(btn, opt));
            elements.mcOptions.appendChild(btn);
        }
    }

    function handleMcChoice(btnEl, chosen) {
        if (answered) return;
        answered = true;

        const isCorrect = chosen.slug === currentCard.slug;
        FlashcardEngine.recordResult(currentCard.slug, isCorrect);

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
        if (answered) return;
        const input = elements.textAnswer.value.trim();
        if (!input) return;

        answered = true;

        const isCorrect = fuzzyMatch(input, currentCard.word);
        FlashcardEngine.recordResult(currentCard.slug, isCorrect);
        showFeedback(isCorrect);
        App.updateStats();
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
            elements.feedbackContent.textContent = '✓ Correct!';
        } else {
            elements.feedbackContent.textContent = `✗ The answer is: ${currentCard.word}`;
        }
    }

    function showTextGuide(card) {
        elements.gif.style.display = 'none';
        elements.textGuide.style.display = '';
        const guide = FlashcardEngine.getTextGuide(card);
        const desc = elements.textGuide.querySelector('.text-guide-desc');
        if (guide) {
            desc.textContent = guide;
        } else {
            desc.textContent = `Practice signing:\n${card.word}\n(Reference your class notes)`;
        }
    }

    return { init, start, loadNextCard, setAnswerMode };
})();
