/**
 * SignSpark — Flashcard Engine
 * Loads words, manages card state, weighted random selection.
 */

const FlashcardEngine = (() => {
    let allWords = [];
    let filteredWords = [];
    let sessionStats = { studied: 0, correct: 0, incorrect: 0, streak: 0, bestStreak: 0 };
    let cardStats = {}; // { slug: { seen: 0, correct: 0, incorrect: 0 } }
    let activeCategories = new Set(); // empty = all
    let customWords = [];

    const STORAGE_KEY = 'signspark_custom_words';

    function toSlug(word) {
        return word.toLowerCase().trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    async function loadWords() {
        try {
            const resp = await fetch('data/words.json');
            allWords = await resp.json();
        } catch (e) {
            console.warn('Could not load words.json, using empty list', e);
            allWords = [];
        }

        // Load custom words from localStorage
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                customWords = JSON.parse(stored);
            }
        } catch (e) {
            customWords = [];
        }

        // Merge custom words (avoid duplicates)
        const existingSlugs = new Set(allWords.map(w => w.slug));
        for (const cw of customWords) {
            if (!existingSlugs.has(cw.slug)) {
                allWords.push(cw);
                existingSlugs.add(cw.slug);
            }
        }

        applyFilter();
        return allWords;
    }

    function applyFilter() {
        if (activeCategories.size === 0) {
            filteredWords = [...allWords];
        } else {
            filteredWords = allWords.filter(w => activeCategories.has(w.category));
        }
    }

    function getCategories() {
        const cats = new Set();
        for (const w of allWords) {
            cats.add(w.category);
        }
        return [...cats].sort();
    }

    function setCategories(categories) {
        activeCategories = new Set(categories);
        applyFilter();
    }

    function toggleCategory(cat) {
        if (activeCategories.has(cat)) {
            activeCategories.delete(cat);
        } else {
            activeCategories.add(cat);
        }
        applyFilter();
    }

    function isCategoryActive(cat) {
        return activeCategories.has(cat);
    }

    /**
     * Weighted random: cards the user gets wrong more often appear more frequently.
     */
    function getNextCard(excludeSlug, requireGif = false) {
        let pool = filteredWords;
        if (requireGif) {
            pool = pool.filter(w => w.hasGif);
        }
        if (pool.length === 0) return null;

        const weights = pool.map(w => {
            const stats = cardStats[w.slug];
            if (!stats || stats.seen === 0) return 3; // unseen cards get higher weight
            const errorRate = stats.incorrect / stats.seen;
            return 1 + errorRate * 4; // more mistakes = higher weight
        });

        // Exclude current card if possible
        if (excludeSlug && pool.length > 1) {
            const idx = pool.findIndex(w => w.slug === excludeSlug);
            if (idx >= 0) weights[idx] = 0;
        }

        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let rand = Math.random() * totalWeight;

        for (let i = 0; i < pool.length; i++) {
            rand -= weights[i];
            if (rand <= 0) return pool[i];
        }

        return pool[pool.length - 1];
    }

    function getRandomDistractors(correctWord, count = 3) {
        const pool = allWords.filter(w => w.slug !== correctWord.slug);
        const distractors = [];
        const used = new Set();

        while (distractors.length < count && distractors.length < pool.length) {
            const idx = Math.floor(Math.random() * pool.length);
            if (!used.has(idx)) {
                used.add(idx);
                distractors.push(pool[idx]);
            }
        }

        return distractors;
    }

    function recordResult(slug, correct) {
        if (!cardStats[slug]) {
            cardStats[slug] = { seen: 0, correct: 0, incorrect: 0 };
        }
        cardStats[slug].seen++;
        sessionStats.studied++;

        if (correct) {
            cardStats[slug].correct++;
            sessionStats.correct++;
            sessionStats.streak++;
            if (sessionStats.streak > sessionStats.bestStreak) {
                sessionStats.bestStreak = sessionStats.streak;
            }
        } else {
            cardStats[slug].incorrect++;
            sessionStats.incorrect++;
            sessionStats.streak = 0;
        }
    }

    function getSessionStats() {
        const total = sessionStats.correct + sessionStats.incorrect;
        return {
            ...sessionStats,
            accuracy: total > 0 ? Math.round((sessionStats.correct / total) * 100) : 0,
            totalCards: filteredWords.length
        };
    }

    function addCustomWord(word, category = 'general') {
        const slug = toSlug(word);
        if (!slug) return null;

        const existingSlugs = new Set(allWords.map(w => w.slug));
        if (existingSlugs.has(slug)) return null; // already exists

        const newWord = {
            word: word,
            slug: slug,
            category: category,
            gif: `assets/gifs/${slug}.gif`,
            custom: true
        };

        allWords.push(newWord);
        customWords.push(newWord);
        saveCustomWords();
        applyFilter();
        return newWord;
    }

    function importWords(textBlock, category = 'general') {
        const lines = textBlock.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let added = 0;
        for (const line of lines) {
            if (addCustomWord(line, category)) added++;
        }
        return added;
    }

    function exportWords() {
        return allWords.map(w => `${w.word}\t${w.category}`).join('\n');
    }

    function saveCustomWords() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(customWords));
        } catch (e) {
            console.warn('Could not save custom words', e);
        }
    }

    function getFilteredWords() {
        return filteredWords;
    }

    function getFilteredWordsWithGifs() {
        return filteredWords.filter(w => w.hasGif);
    }

    function getGifPath(wordEntry) {
        return wordEntry.gif;
    }

    function getSvgFallback(wordEntry) {
        return wordEntry.gif.replace('.gif', '.svg');
    }

    function hasRealGif(wordEntry) {
        return wordEntry.hasGif === true;
    }

    function getTextGuide(wordEntry) {
        if (!wordEntry) return null;
        return wordEntry.textGuide || null;
    }

    return {
        loadWords,
        getCategories,
        setCategories,
        toggleCategory,
        isCategoryActive,
        getNextCard,
        getRandomDistractors,
        recordResult,
        getSessionStats,
        addCustomWord,
        importWords,
        exportWords,
        getFilteredWords,
        getFilteredWordsWithGifs,
        getGifPath,
        getSvgFallback,
        hasRealGif,
        getTextGuide,
        toSlug
    };
})();
