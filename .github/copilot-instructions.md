# Copilot Instructions for SignSpark

## Project Overview

SignSpark is a mobile-friendly ASL (American Sign Language) flashcard learning web app. The frontend is pure HTML, CSS, and JavaScript; a managed Azure Functions API stores learner progress in Azure Table Storage. Python scripts in `scripts/` are used offline for data preparation only.

## Architecture

```
asl/
├── index.html              # Single-page app (all screens in one HTML file)
├── staticwebapp.config.json # Azure managed API runtime declaration
├── css/style.css           # Mobile-first responsive styles, dark/light themes
├── js/
│   ├── flashcards.js       # Core engine — word loading, weighted random, stats, custom words
│   ├── media.js            # Local image and privacy-enhanced YouTube rendering
│   ├── quiz-sign.js        # Mode 1: Word → Sign (show word, reveal media, self-rate)
│   ├── quiz-word.js        # Mode 2: Sign → Word (show media, multiple choice or free text)
│   └── app.js              # App shell — routing, dark mode, category chips, word management
├── data/words.json         # 939 cards with media, syllabus units, and descriptions
├── assets/gifs/            # Legacy local image library being replaced through review
├── api/
│   ├── profiles/           # GET/POST profile progress Azure Function
│   ├── video-reports/      # POST video playback/content bug reports
│   ├── host.json
│   └── package.json
├── scripts/                # Python data-prep scripts (offline only, not deployed)
│   ├── prepare_data.py     # Main: clean words.txt → words.json + download GIFs
│   ├── scrape_lifeprint.py # Scrapes Lifeprint dictionary pages for real image URLs
│   ├── enhanced_download.py
│   ├── comprehensive_download.py
│   └── generate_cards.py   # Generates reference card images with Pillow for missing words
└── words.txt               # Raw vocabulary source file
```

## Key Technical Details

- **Frontend has no build step** — `index.html`, `staticwebapp.config.json`, `css/`, `js/`, `data/`, and `assets/` are staged as the app artifact. `api/` is staged separately with production dependencies installed in the isolated deployment artifact.
- **words.json** is the source of truth for vocabulary at runtime. Curated cards add a `media` object (`type`, `videoId` or `src`, source metadata, and `reviewed`) plus `textGuideReviewed` and `textGuideSource`. Unsupported cards use `mediaReviewStatus: "no-verified-source"`.
- **Custom words** are stored in `localStorage` under key `signspark_custom_words` and merged with `words.json` at load time.
- **Weighted random selection** — cards the user gets wrong appear more frequently. Unseen cards get weight 3; seen cards get `1 + errorRate * 4`.
- **YouTube endpoints** — desktop cards use `youtube.com` with `enablejsapi` and `origin`; touch devices use plain iframe embeds with native `loop` and `playlist` parameters. Both autoplay muted and hide controls.
- **Timed syllabus clips** — YouTube media can define `startSeconds` and `endSeconds`. The player seeks to the exact start and loops at the exact end; media identity includes the segment range.
- **Unit curriculum coverage** — 772 deduplicated concepts cover Units 1–6. Cards use `syllabusUnits`; existing reviewed media is retained and the subtitle-timed source is stored as `syllabusMedia`.
- **Playback recovery** — media.js retries YouTube startup errors/timeouts twice with a fresh iframe before showing the reviewed-source fallback.
- **Mobile playback** — touch devices skip autoplay, offscreen preloading, iframe transforms, overlays, and the YouTube JavaScript player API. They use the standard interactive player with pointer events and visible controls; one user tap starts playback reliably in WebKit.
- **YouTube client identity** — the page, iframe, and Azure response use `strict-origin-when-cross-origin`. Do not restore Azure's `same-origin` default: YouTube requires the app origin in the HTTP Referer and iOS may not honor an iframe-only override.
- **Video reports** — YouTube attribution includes a one-tap report button. `/api/video-reports` stores reports in the `SignSparkVideoReports` Azure table.
- **Mode 2 (Sign → Word)** uses reviewed media identities mapped to exactly one card. A YouTube identity includes video ID plus segment boundaries, allowing distinct clips from one source lesson.
- **Quiz flow** — Sign → Word preselects and preloads the next card. Correct answers advance automatically after brief feedback; incorrect answers wait for the user to select Next.
- **Spaced retries** — each missed sign is scheduled for two later retries, separated by ten answered cards. Multiple-choice answers are shuffled while preventing the correct slot from repeating consecutively.
- **Profiles** — Kar, Shy, Lav, Swa, and Rah persist independent stats and retry queues through `/api/profiles/{profile}`. Guest data remains in memory and must never be sent to the API.
- **Profile database** — the API uses Azure Table Storage through the `PROFILE_STORAGE_CONNECTION_STRING` application setting; never commit this secret.
- **Distractors** favor the same category, nearby numeric/time values, and explicit semantic groups while excluding equivalent labels.
- **Text guides** are shown only when `textGuideReviewed === true`; generated or unsourced descriptions must remain hidden.
- **Fuzzy matching** in free-text mode uses Levenshtein distance with a threshold of 25% of the target word length.
- **Image files** — browsers read file headers, not extensions. JPGs and PNGs saved as `.gif` work fine.
- **Legacy GIF sources** — old images came from Lifeprint.com. New media must be manually reviewed, attributed, and represented by explicit metadata; do not select videos through runtime search.
- **Media verification** — run `python scripts/verify_media.py` after changing reviewed media. It checks YouTube oEmbed availability and byte-compares reviewed local files with their recorded sources.

## Coding Conventions

- All JavaScript uses the **revealing module pattern** (IIFE returning public API). No frameworks, no bundler.
- CSS uses **custom properties** (`--bg-primary`, `--text-primary`, etc.) for theming. Dark mode is toggled via `[data-theme="dark"]` on `<html>`.
- Mobile-first: base styles are for small screens, `@media (min-width: 768px)` for larger.
- Python scripts use **stdlib only** (except Pillow for `generate_cards.py`). No pip dependencies for the core scripts.

## When Modifying

- **Adding new words**: Edit `words.txt`, then run `python scripts/prepare_data.py`. Follow up with `scrape_lifeprint.py` and `generate_cards.py` for images. See `ADDING-WORDS.md` for full steps.
- **Changing styles**: Edit `css/style.css`. The `.media-container` uses a white (`#ffffff`) background to ensure transparent images are visible.
- **Adding new quiz modes**: Create a new `js/quiz-*.js` file, add a screen in `index.html`, and wire it up in `app.js`.
- **Deploying**: This is hosted on Azure Static Web Apps. See `PUBLISHING.md` for deployment steps.

## Testing

There are no automated tests. To verify changes:
1. Run `python -m http.server 8080` from the repo root
2. Open `http://localhost:8080` in a browser
3. Test both quiz modes, category filtering, dark mode toggle, and word management (add/import/export)

## Azure Deployment

- **Hosting**: Azure Static Web Apps (Free tier)
- See `PUBLISHING.md` for deployment details — update the resource names and hostname for your own setup
