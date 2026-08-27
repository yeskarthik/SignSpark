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
    let mediaUsage = new Map();

    const STORAGE_KEY = 'signspark_custom_words';
    const DISTRACTOR_GROUPS = [
        ['what', 'who', 'where', 'which'],
        ['same', 'different', 'rightcorrect', 'wrong', 'equal'],
        ['remember', 'remember-most', 'remember-some', 'remember-a-little-bit', 'forget', 'forget-all'],
        ['door', 'open-door', 'close-door'],
        ['window', 'window-open', 'window-close'],
        ['light', 'light-on', 'light-off'],
        ['book', 'book-open', 'book-close', 'book-read', 'read'],
        ['paper', 'paper-fold', 'paper-crumble', 'paper-throw', 'paper-look-at'],
        ['easy', 'sort-of-easy', 'hard', 'sort-of-hard'],
        ['movie', 'game', 'music', 'computer', 'tv']
    ];
    const EQUIVALENT_GROUPS = [
        ['mom', 'mother'],
        ['dad', 'father'],
        ['boy-friend', 'boyfriend'],
        ['girl-friend', 'girlfriend'],
        ['color', 'colors'],
        ['bike', 'bicycling'],
        ['cook', 'cooking'],
        ['candy', 'candy-sweets'],
        ['want', 'to-desire-something-want'],
        ['here', 'here-in-this-area']
    ];

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

        rebuildMediaUsage();
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
    function getNextCard(excludeSlug, requiredMediaPurpose = null) {
        let pool = filteredWords;
        if (requiredMediaPurpose === 'learning') {
            pool = pool.filter(hasLearningMedia);
        } else if (requiredMediaPurpose === 'quiz') {
            pool = pool.filter(hasQuizMedia);
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
        const filteredPool = filteredWords.filter(word =>
            word.slug !== correctWord.slug &&
            hasQuizMedia(word) &&
            !arePotentiallyEquivalent(correctWord, word)
        );
        const fallbackPool = allWords.filter(word =>
            word.slug !== correctWord.slug &&
            !filteredPool.some(candidate => candidate.slug === word.slug) &&
            hasQuizMedia(word) &&
            !arePotentiallyEquivalent(correctWord, word)
        );

        return [...filteredPool, ...fallbackPool]
            .map(word => ({
                word,
                score: getDistractorScore(correctWord, word) + Math.random() * 8
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, count)
            .map(candidate => candidate.word);
    }

    function getDistractorScore(correctWord, candidate) {
        let score = correctWord.category === candidate.category ? 100 : 0;

        if (inSameGroup(correctWord.slug, candidate.slug, DISTRACTOR_GROUPS)) {
            score += 80;
        }

        const correctNumber = getCardNumber(correctWord);
        const candidateNumber = getCardNumber(candidate);
        if (correctNumber !== null && candidateNumber !== null) {
            score += Math.max(0, 50 - Math.abs(correctNumber - candidateNumber) * 4);
        }

        const correctUnit = getTimeUnit(correctWord.word);
        const candidateUnit = getTimeUnit(candidate.word);
        if (correctUnit && correctUnit === candidateUnit) {
            score += 45;
        }

        const lengthDifference = Math.abs(correctWord.word.length - candidate.word.length);
        score += Math.max(0, 12 - lengthDifference);
        return score;
    }

    function getCardNumber(wordEntry) {
        if (!['numbers', 'time', 'age-ranges'].includes(wordEntry.category)) {
            return null;
        }
        const match = wordEntry.word.match(/\d+/);
        return match ? Number(match[0]) : null;
    }

    function getTimeUnit(word) {
        if (/\bminutes?\b/i.test(word)) return 'minute';
        if (/\bhours?\b/i.test(word)) return 'hour';
        if (/\byears?\b/i.test(word)) return 'year';
        return null;
    }

    function inSameGroup(firstSlug, secondSlug, groups) {
        return groups.some(group =>
            group.includes(firstSlug) && group.includes(secondSlug)
        );
    }

    function arePotentiallyEquivalent(first, second) {
        if (inSameGroup(first.slug, second.slug, EQUIVALENT_GROUPS)) {
            return true;
        }

        const firstTokens = new Set(toSlug(first.word).split('-').filter(Boolean));
        const secondTokens = new Set(toSlug(second.word).split('-').filter(Boolean));
        const firstContained = [...firstTokens].every(token => secondTokens.has(token));
        const secondContained = [...secondTokens].every(token => firstTokens.has(token));
        return firstContained || secondContained;
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

    function getFilteredWordsWithQuizMedia() {
        return filteredWords.filter(hasQuizMedia);
    }

    function getFilteredWordsWithLearningMedia() {
        return filteredWords.filter(hasLearningMedia);
    }

    function isPlayableMedia(media) {
        if (media?.type === 'youtube') {
            return Boolean(media.videoId);
        }
        if (media?.type === 'image') {
            return Boolean(media.src);
        }
        return false;
    }

    function getMediaIdentity(media) {
        if (media?.type === 'youtube') return `youtube:${media.videoId}`;
        if (media?.type === 'image') return `image:${media.src}`;
        return null;
    }

    function rebuildMediaUsage() {
        mediaUsage = new Map();
        for (const word of allWords) {
            if (word.media?.reviewed !== true) continue;
            const identity = getMediaIdentity(word.media);
            if (!identity) continue;
            mediaUsage.set(identity, (mediaUsage.get(identity) || 0) + 1);
        }
    }

    function hasLearningMedia(wordEntry) {
        if (isPlayableMedia(wordEntry.media)) return true;
        return wordEntry.legacyMediaDisabled !== true &&
            wordEntry.hasGif === true &&
            Boolean(wordEntry.gif);
    }

    function hasQuizMedia(wordEntry) {
        if (isPlayableMedia(wordEntry.quizMedia)) return true;
        if (wordEntry.media?.reviewed === true && isPlayableMedia(wordEntry.media)) {
            const identity = getMediaIdentity(wordEntry.media);
            return wordEntry.media.quizEligible !== false &&
                mediaUsage.get(identity) === 1;
        }
        return wordEntry.legacyMediaDisabled !== true &&
            wordEntry.hasGif === true &&
            Boolean(wordEntry.gif);
    }

    function getMedia(wordEntry, purpose = 'learning') {
        if (!wordEntry) return null;

        let curatedMedia = purpose === 'quiz' ? wordEntry.quizMedia : wordEntry.media;
        if (purpose === 'quiz' &&
            !isPlayableMedia(curatedMedia) &&
            hasQuizMedia(wordEntry)) {
            curatedMedia = wordEntry.media;
        }
        if (isPlayableMedia(curatedMedia)) {
            return curatedMedia;
        }

        if (wordEntry.legacyMediaDisabled !== true && wordEntry.hasGif && wordEntry.gif) {
            return {
                type: 'image',
                src: wordEntry.gif,
                sourceName: 'Legacy image library',
                reviewed: false
            };
        }
        return null;
    }

    function getTextGuide(wordEntry) {
        if (!wordEntry) return null;
        return wordEntry.textGuideReviewed === true ? wordEntry.textGuide || null : null;
    }

    function getTextGuideSource(wordEntry) {
        if (!wordEntry || wordEntry.textGuideReviewed !== true) return null;
        return wordEntry.textGuideSource || null;
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
        getFilteredWordsWithQuizMedia,
        getFilteredWordsWithLearningMedia,
        hasLearningMedia,
        hasQuizMedia,
        getMedia,
        getTextGuide,
        getTextGuideSource,
        toSlug
    };
})();
