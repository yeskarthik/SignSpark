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
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }

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
        renderCategories();
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
            updateStats();
            renderCategories();
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

    function updateWordCount() {
        const filtered = FlashcardEngine.getFilteredWords();
        const withLearningMedia = FlashcardEngine.getFilteredWordsWithLearningMedia();
        const withQuizMedia = FlashcardEngine.getFilteredWordsWithQuizMedia();
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

    function updateStats() {
        const stats = FlashcardEngine.getSessionStats();

        document.getElementById('stat-studied').textContent = stats.studied;
        document.getElementById('stat-correct').textContent = stats.correct;
        document.getElementById('stat-incorrect').textContent = stats.incorrect;
        document.getElementById('stat-accuracy').textContent = stats.accuracy + '%';

        const statsSection = document.getElementById('stats-section');
        statsSection.style.display = stats.studied > 0 ? '' : 'none';
    }

    function updateProgress() {
        const stats = FlashcardEngine.getSessionStats();
        const bar = document.getElementById('progress-bar');
        const text = document.getElementById('progress-text');
        const total = currentScreen === 'sign-to-word'
            ? FlashcardEngine.getFilteredWordsWithQuizMedia().length
            : FlashcardEngine.getFilteredWordsWithLearningMedia().length;
        const studied = stats.studied;
        const pct = total > 0 ? Math.min(100, (studied / total) * 100) : 0;

        bar.style.width = pct + '%';
        text.textContent = `${studied} / ${total}`;
    }

    function toggleDarkMode() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('signspark_theme', next);

        const btn = document.getElementById('btn-dark-mode');
        btn.textContent = next === 'dark' ? '☀️' : '🌙';
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
