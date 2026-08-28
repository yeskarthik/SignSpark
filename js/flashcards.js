/**
 * SignSpark — Flashcard Engine
 * Loads words, manages card state, weighted random selection.
 */

const FlashcardEngine = (() => {
    let allWords = [];
    let filteredWords = [];
    let activeCategories = new Set(); // empty = all
    let activeSyllabusUnits = new Set(); // empty = all
    let customWords = [];
    let mediaUsage = new Map();
    let activeProfile = 'Guest';
    let profileStates = null;
    const profileSaveQueues = new Map();

    const STORAGE_KEY = 'signspark_custom_words';
    const ACTIVE_PROFILE_KEY = 'signspark_active_profile';
    const PERSISTED_PROFILE_NAMES = ['Kar', 'Shy', 'Lav', 'Swa', 'Rah'];
    const PROFILE_NAMES = [...PERSISTED_PROFILE_NAMES, 'Guest'];
    profileStates = createProfileStates();
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

    function createStats() {
        return { studied: 0, correct: 0, incorrect: 0, streak: 0, bestStreak: 0 };
    }

    function createProfileState() {
        return {
            stats: createStats(),
            cardStats: {},
            pendingRetries: new Set()
        };
    }

    function createProfileStates() {
        return Object.fromEntries(
            PROFILE_NAMES.map(profileName => [profileName, createProfileState()])
        );
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

        await loadProfileProgress();

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
        filteredWords = allWords.filter(word => {
            const categoryMatches = activeCategories.size === 0 ||
                activeCategories.has(word.category);
            const unitMatches = activeSyllabusUnits.size === 0 ||
                word.syllabusUnits?.some(unit => activeSyllabusUnits.has(unit));
            return categoryMatches && unitMatches;
        });
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

    function getSyllabusUnits() {
        const units = new Set();
        for (const word of allWords) {
            for (const unit of word.syllabusUnits || []) {
                units.add(unit);
            }
        }
        return [...units].sort((left, right) => left - right);
    }

    function toggleSyllabusUnit(unit) {
        if (activeSyllabusUnits.has(unit)) {
            activeSyllabusUnits.delete(unit);
        } else {
            activeSyllabusUnits.add(unit);
        }
        applyFilter();
    }

    function isSyllabusUnitActive(unit) {
        return activeSyllabusUnits.has(unit);
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

        const profileState = getActiveProfileState();
        const retryPool = pool.filter(word => profileState.pendingRetries.has(word.slug));
        if (retryPool.length > 0) {
            pool = retryPool;
        }

        const weights = pool.map(w => {
            const stats = profileState.cardStats[w.slug];
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
        const profileState = getActiveProfileState();
        if (!profileState.cardStats[slug]) {
            profileState.cardStats[slug] = { seen: 0, correct: 0, incorrect: 0 };
        }
        profileState.cardStats[slug].seen++;
        profileState.stats.studied++;

        if (correct) {
            profileState.cardStats[slug].correct++;
            profileState.stats.correct++;
            profileState.stats.streak++;
            profileState.pendingRetries.delete(slug);
            if (profileState.stats.streak > profileState.stats.bestStreak) {
                profileState.stats.bestStreak = profileState.stats.streak;
            }
        } else {
            profileState.cardStats[slug].incorrect++;
            profileState.stats.incorrect++;
            profileState.stats.streak = 0;
            if (activeProfile !== 'Guest') {
                profileState.pendingRetries.add(slug);
            }
        }

        if (activeProfile !== 'Guest') {
            queueProfileResult(activeProfile, slug, correct);
        }
    }

    function getSessionStats() {
        const stats = getActiveProfileState().stats;
        const total = stats.correct + stats.incorrect;
        return {
            ...stats,
            accuracy: total > 0 ? Math.round((stats.correct / total) * 100) : 0,
            totalCards: filteredWords.length
        };
    }

    function getActiveProfileState() {
        return profileStates[activeProfile];
    }

    function getActiveProfile() {
        return activeProfile;
    }

    function getPendingRetryCount() {
        return getActiveProfileState().pendingRetries.size;
    }

    function setActiveProfile(profileName) {
        if (!PROFILE_NAMES.includes(profileName)) return false;
        activeProfile = profileName;
        try {
            localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfile);
        } catch (error) {
            console.warn('Could not save the active profile', error);
        }
        return true;
    }

    async function loadProfileProgress() {
        profileStates = createProfileStates();

        try {
            const storedProfile = localStorage.getItem(ACTIVE_PROFILE_KEY);
            if (PROFILE_NAMES.includes(storedProfile)) {
                activeProfile = storedProfile;
            }
        } catch (error) {
            console.warn('Could not load the active profile', error);
        }

        await Promise.all(PERSISTED_PROFILE_NAMES.map(async profileName => {
            try {
                const response = await fetch(`/api/profiles/${encodeURIComponent(profileName)}`, {
                    headers: { Accept: 'application/json' },
                    cache: 'no-store'
                });
                if (!response.ok) {
                    throw new Error(`Profile API returned ${response.status}.`);
                }
                profileStates[profileName] = parseProfileState(await response.json());
            } catch (error) {
                console.error(`Could not load ${profileName}'s progress from the server.`, error);
            }
        }));
    }

    function parseProfileState(value) {
        if (!value ||
            typeof value.stats !== 'object' ||
            typeof value.cardStats !== 'object' ||
            !Array.isArray(value.pendingRetries)) {
            throw new Error('Profile API returned invalid progress data.');
        }

        return {
            stats: { ...createStats(), ...value.stats },
            cardStats: value.cardStats,
            pendingRetries: new Set(value.pendingRetries)
        };
    }

    function queueProfileResult(profileName, slug, correct) {
        const previousSave = profileSaveQueues.get(profileName) || Promise.resolve();
        const nextSave = previousSave
            .catch(() => undefined)
            .then(async () => {
                const response = await fetch(
                    `/api/profiles/${encodeURIComponent(profileName)}`,
                    {
                        method: 'POST',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ slug, correct }),
                        keepalive: true
                    }
                );
                if (!response.ok) {
                    throw new Error(`Profile API returned ${response.status}.`);
                }
            });
        nextSave.catch(error => {
            console.error(`Could not save ${profileName}'s progress to the server.`, error);
        });
        profileSaveQueues.set(profileName, nextSave);
    }

    function waitForProfileSaves() {
        return Promise.allSettled(profileSaveQueues.values());
    }

    function isPersistentProfile(profileName = activeProfile) {
        return PERSISTED_PROFILE_NAMES.includes(profileName);
    }

    function getProfileNames() {
        return [...PROFILE_NAMES];
    }

    function getProfileProgress(profileName = activeProfile) {
        if (!PROFILE_NAMES.includes(profileName)) return null;
        const state = profileStates[profileName];
        return {
            stats: { ...state.stats },
            cardStats: structuredClone(state.cardStats),
            pendingRetries: [...state.pendingRetries]
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
            const hasStart = media.startSeconds !== undefined;
            const hasEnd = media.endSeconds !== undefined;
            return Boolean(media.videoId) &&
                hasStart === hasEnd &&
                (!hasStart || (
                    Number.isFinite(media.startSeconds) &&
                    Number.isFinite(media.endSeconds) &&
                    media.startSeconds >= 0 &&
                    media.endSeconds > media.startSeconds
                ));
        }
        if (media?.type === 'image') {
            return Boolean(media.src);
        }
        return false;
    }

    function getMediaIdentity(media) {
        if (media?.type === 'youtube') {
            const segment = media.startSeconds === undefined
                ? ''
                : `:${media.startSeconds}-${media.endSeconds}`;
            return `youtube:${media.videoId}${segment}`;
        }
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
        getSyllabusUnits,
        toggleSyllabusUnit,
        isSyllabusUnitActive,
        getNextCard,
        getRandomDistractors,
        recordResult,
        getSessionStats,
        getActiveProfile,
        getProfileNames,
        getProfileProgress,
        getPendingRetryCount,
        isPersistentProfile,
        setActiveProfile,
        waitForProfileSaves,
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
