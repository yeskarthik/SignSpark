# Copilot Instructions for SignSpark

## Project Overview

SignSpark is a mobile-friendly ASL (American Sign Language) flashcard learning web app. It is a **static site** — pure HTML, CSS, and JavaScript with no server-side runtime. Python scripts in `scripts/` are used offline for data preparation only.

## Architecture

```
asl/
├── index.html              # Single-page app (all screens in one HTML file)
├── css/style.css           # Mobile-first responsive styles, dark/light themes
├── js/
│   ├── flashcards.js       # Core engine — word loading, weighted random, stats, custom words
│   ├── media.js            # Local image and privacy-enhanced YouTube rendering
│   ├── quiz-sign.js        # Mode 1: Word → Sign (show word, reveal media, self-rate)
│   ├── quiz-word.js        # Mode 2: Sign → Word (show media, multiple choice or free text)
│   └── app.js              # App shell — routing, dark mode, category chips, word management
├── data/words.json         # 500 word entries and their media/description metadata
├── assets/gifs/            # Legacy local image library being replaced through review
├── scripts/                # Python data-prep scripts (offline only, not deployed)
│   ├── prepare_data.py     # Main: clean words.txt → words.json + download GIFs
│   ├── scrape_lifeprint.py # Scrapes Lifeprint dictionary pages for real image URLs
│   ├── enhanced_download.py
│   ├── comprehensive_download.py
│   └── generate_cards.py   # Generates reference card images with Pillow for missing words
└── words.txt               # Raw vocabulary source file
```

## Key Technical Details

- **No build step** — the app is served directly from the repo root. `index.html`, `css/`, `js/`, `data/`, and `assets/` are the deployed files.
- **words.json** is the source of truth for vocabulary at runtime. Curated cards add a `media` object (`type`, `videoId` or `src`, source metadata, and `reviewed`) plus `textGuideReviewed` and `textGuideSource`. Unsupported cards use `mediaReviewStatus: "no-verified-source"`.
- **Custom words** are stored in `localStorage` under key `signspark_custom_words` and merged with `words.json` at load time.
- **Weighted random selection** — cards the user gets wrong appear more frequently. Unseen cards get weight 3; seen cards get `1 + errorRate * 4`.
- **Mode 2 (Sign → Word)** uses reviewed media mapped to exactly one card. Shared/collection media is excluded; YouTube clips autoplay muted with controls hidden.
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
