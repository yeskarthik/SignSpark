/**
 * SignSpark — Main App Shell
 * Routing, session stats, category filters, word management.
 */

const App = (() => {
    let currentScreen = 'home';
    let initialized = false;

    async function init() {
        // Load theme preference
        const savedTheme = localStorage.getItem('signspark_theme');
        applyTheme(savedTheme === 'light' ? 'light' : 'dark');

        // Load words
        await FlashcardEngine.loadWords();

        // Init sub-modules
        QuizSign.init();
        QuizWord.init();

        // Bind navigation
        document.getElementById('btn-home').addEventListener('click', () => showScreen('home'));
        document.getElementById('btn-mode-sign').addEventListener('click', () => {
            showScreen('word-to-sign');
            QuizSign.start();
        });
        document.getElementById('btn-mode-word').addEventListener('click', () => {
            showScreen('sign-to-word');
            QuizWord.start();
        });

        // Dark mode toggle
        document.getElementById('btn-dark-mode').addEventListener('click', toggleDarkMode);

        // Word management
        document.getElementById('btn-add-word').addEventListener('click', showAddWordModal);
        document.getElementById('btn-import').addEventListener('click', showImportModal);
        document.getElementById('btn-export').addEventListener('click', exportWords);
        document.getElementById('btn-cancel-add').addEventListener('click', () => hideModal('modal-add-word'));
        document.getElementById('btn-confirm-add').addEventListener('click', confirmAddWord);
        document.getElementById('btn-cancel-import').addEventListener('click', () => hideModal('modal-import'));
        document.getElementById('btn-confirm-import').addEventListener('click', confirmImport);

        // Close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.style.display = 'none';
            });
        });

        // Render categories
        initProfiles();
        renderCategories();
        renderSyllabusUnits();
        updateStats();

        initialized = true;
        console.log('SignSpark initialized ✨');
    }

    function showScreen(name) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(`screen-${name}`);
        if (screen) screen.classList.add('active');

        const progress = document.getElementById('progress-container');
        progress.style.display = name === 'home' ? 'none' : '';

        currentScreen = name;

        // Update stats when returning home
        if (name === 'home') {
            QuizSign.stop();
            QuizWord.stop();
            updateStats();
            renderCategories();
            renderSyllabusUnits();
        }
    }

    function renderCategories() {
        const container = document.getElementById('category-chips');
        container.innerHTML = '';

        const categories = FlashcardEngine.getCategories();
        for (const cat of categories) {
            const chip = document.createElement('button');
            chip.className = 'chip' + (FlashcardEngine.isCategoryActive(cat) ? ' active' : '');
            chip.textContent = formatCategory(cat);
            chip.addEventListener('click', () => {
                FlashcardEngine.toggleCategory(cat);
                chip.classList.toggle('active');
                updateWordCount();
            });
            container.appendChild(chip);
        }

        updateWordCount();
    }

    function renderSyllabusUnits() {
        const container = document.getElementById('syllabus-unit-chips');
        container.innerHTML = '';

        for (const unit of FlashcardEngine.getSyllabusUnits()) {
            const chip = document.createElement('button');
            chip.className = 'chip' +
                (FlashcardEngine.isSyllabusUnitActive(unit) ? ' active' : '');
            chip.textContent = `Unit ${unit}`;
            chip.addEventListener('click', () => {
                FlashcardEngine.toggleSyllabusUnit(unit);
                chip.classList.toggle('active');
                updateWordCount();
            });
            container.appendChild(chip);
        }
    }

    function updateWordCount() {
        const filtered = FlashcardEngine.getFilteredWords();
        const withLearningMedia = FlashcardEngine.getFilteredWordsWithLearningMedia();
        const withQuizMedia = FlashcardEngine.getFilteredWordsWithQuizMedia();
        updateFilteredProgress();
        const subtitle = document.querySelector('.subtitle');
        if (subtitle) {
            subtitle.textContent =
                `${filtered.length} flashcards (${withLearningMedia.length} reviewed lessons, ` +
                `${withQuizMedia.length} ready for Sign-to-Word)`;
        }

        const quizModeButton = document.getElementById('btn-mode-word');
        const quizModeStatus = document.getElementById('mode-word-status');
        const hasQuizMedia = withQuizMedia.length > 0;
        quizModeButton.disabled = !hasQuizMedia;
        quizModeStatus.textContent = hasQuizMedia
            ? 'Watch a reviewed sign, then guess the word'
            : 'No unambiguous sign media is available for this filter';

        const learningModeButton = document.getElementById('btn-mode-sign');
        const learningModeStatus = document.getElementById('mode-sign-status');
        const hasLearningMedia = withLearningMedia.length > 0;
        learningModeButton.disabled = !hasLearningMedia;
        learningModeStatus.textContent = hasLearningMedia
            ? 'See a word, try to sign it, then check'
            : 'No reviewed sign source is available for this filter';
    }

    function updateFilteredProgress() {
        const progress = FlashcardEngine.getFilteredProgress();
        document.getElementById('filter-correct').textContent = progress.correct;
        document.getElementById('filter-remaining').textContent = progress.remaining;
        document.getElementById('filter-total').textContent = progress.total;
    }

    function updateStats() {
        const stats = FlashcardEngine.getSessionStats();
        const profile = FlashcardEngine.getActiveProfile();
        const pendingRetries = FlashcardEngine.getPendingRetryCount();

        updateFilteredProgress();
        updateQuestionStatus();
        document.getElementById('stat-studied').textContent = stats.studied;
        document.getElementById('stat-correct').textContent = stats.correct;
        document.getElementById('stat-incorrect').textContent = stats.incorrect;
        document.getElementById('stat-accuracy').textContent = stats.accuracy + '%';

        const statsSection = document.getElementById('stats-section');
        statsSection.style.display = profile !== 'Guest' || stats.studied > 0 ? '' : 'none';
        document.getElementById('stats-heading').textContent =
            profile === 'Guest' ? 'Guest Session Stats' : `${profile} Progress`;

        const summary = document.getElementById('profile-summary');
        summary.textContent = profile === 'Guest'
            ? 'Guest progress is temporary.'
            : pendingRetries > 0
                ? `${pendingRetries} missed ${pendingRetries === 1 ? 'sign' : 'signs'} queued for retry.`
                : 'Progress is saved on the server. No missed signs are waiting.';
    }

    function initProfiles() {
        document.querySelectorAll('[data-profile]').forEach(button => {
            button.addEventListener('click', () => {
                QuizWord.stop();
                FlashcardEngine.setActiveProfile(button.dataset.profile);
                renderProfiles();
                updateStats();
            });
        });
        renderProfiles();
    }

    function renderProfiles() {
        const activeProfile = FlashcardEngine.getActiveProfile();
        document.querySelectorAll('[data-profile]').forEach(button => {
            const isActive = button.dataset.profile === activeProfile;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    function updateProgress() {
        const bar = document.getElementById('progress-bar');
        const text = document.getElementById('progress-text');
        const progress = getCurrentQuestionProgress();
        const pct = progress.total > 0
            ? (progress.answered / progress.total) * 100
            : 0;

        bar.style.width = pct + '%';
        text.textContent = `${progress.answered} / ${progress.total}`;
        updateQuestionStatus();
    }

    function updateQuestionStatus() {
        const progress = getCurrentQuestionProgress();
        const remainingPercent = progress.total > 0
            ? Number(((progress.remaining / progress.total) * 100).toFixed(1))
            : 0;
        const units = FlashcardEngine.getActiveSyllabusUnits();
        const categories = FlashcardEngine.getActiveCategories();
        const selectedFilters = [];
        if (units.length > 0) selectedFilters.push(`Units: ${units.join(', ')}`);
        if (categories.length > 0) {
            selectedFilters.push(`Categories: ${categories.map(formatCategory).join(', ')}`);
        }
        const filterText = selectedFilters.length > 0
            ? selectedFilters.join(' · ')
            : 'All words';

        document.querySelectorAll('[data-quiz-filter-status]').forEach(status => {
            status.textContent =
                `${remainingPercent}% remaining (${progress.remaining} of ${progress.total}) · ${filterText}`;
        });
    }

    function getCurrentQuestionProgress() {
        const purpose = currentScreen === 'sign-to-word' ? 'quiz' : 'learning';
        return FlashcardEngine.getFilteredQuestionProgress(purpose);
    }

    function toggleDarkMode() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem('signspark_theme', next);
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const btn = document.getElementById('btn-dark-mode');
        btn.textContent = theme === 'dark' ? '☀️' : '🌙';
        btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
        btn.setAttribute('aria-label', btn.title);
    }

    // --- Word Management ---

    function showAddWordModal() {
        document.getElementById('input-new-word').value = '';
        document.getElementById('select-category').value = 'general';
        showModal('modal-add-word');
        document.getElementById('input-new-word').focus();
    }

    function confirmAddWord() {
        const word = document.getElementById('input-new-word').value.trim();
        const category = document.getElementById('select-category').value;

        if (!word) return;

        const result = FlashcardEngine.addCustomWord(word, category);
        if (result) {
            hideModal('modal-add-word');
            renderCategories();
            updateWordCount();
        } else {
            alert('Word already exists or is invalid.');
        }
    }

    function showImportModal() {
        document.getElementById('import-textarea').value = '';
        showModal('modal-import');
    }

    function confirmImport() {
        const text = document.getElementById('import-textarea').value;
        if (!text.trim()) return;

        const added = FlashcardEngine.importWords(text);
        hideModal('modal-import');
        renderCategories();
        updateWordCount();
        alert(`Imported ${added} new word(s).`);
    }

    function exportWords() {
        const text = FlashcardEngine.exportWords();
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'signspark-words.txt';
        a.click();
        URL.revokeObjectURL(url);
    }

    function showModal(id) {
        document.getElementById(id).style.display = 'flex';
    }

    function hideModal(id) {
        document.getElementById(id).style.display = 'none';
    }

    function formatCategory(cat) {
        return cat.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    return { init, updateStats, updateProgress, showScreen };
})();

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
