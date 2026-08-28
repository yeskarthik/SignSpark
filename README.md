# 🤟 SignSpark — Learn ASL with Flashcards

A mobile-friendly web app for learning American Sign Language through interactive flashcards.

**Live site**: Deploy to Azure Static Web Apps — see [PUBLISHING.md](PUBLISHING.md)

## Features

- **500 flashcards** across 20 categories (greetings, colors, family, numbers, fingerspelling, and more)
- **Two quiz modes**:
  - 📝 **Word → Sign**: See a word, try to sign it, reveal reviewed sign media, self-rate
  - 🎬 **Sign → Word**: Watch sign media, then guess the word (multiple choice or free text)
- **Hybrid sign media** — reviewed local images or muted, control-free looping YouTube embeds with automatic startup retries, source attribution, and player-error handling
- **Video issue reporting** — learners can report a broken or incorrect video directly from its source line
- **Fast quiz flow** — correct answers advance automatically while the next sign media preloads
- **Learner profiles** — Kar, Shy, Lav, Swa, and Rah keep independent server-side progress and retry missed signs until correct; Guest stays temporary
- **Weighted repetition** — cards you get wrong appear more often
- **Category filtering** — focus on specific topics
- **Dark mode by default**, with a sun button to switch to light mode
- **Add custom words** via the UI or bulk import
- **Mobile-first** responsive design

## Quick Start

```bash
# Serve locally
python -m http.server 8080
# Open http://localhost:8080
```

No build step, no dependencies — it's a static site.

## Documentation

| Document | Description |
|----------|-------------|
| [ADDING-WORDS.md](ADDING-WORDS.md) | How to add new vocabulary (UI or data pipeline) |
| [PUBLISHING.md](PUBLISHING.md) | How to deploy to Azure Static Web Apps |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | Copilot context for this project |

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (no frameworks)
- **API**: Azure Functions managed by Azure Static Web Apps
- **Profile storage**: Azure Table Storage
- **Data prep**: Python 3.10+ scripts (offline only)
- **Hosting**: Azure Static Web Apps (Free tier)
- **ASL media**: Curated per card with visible source attribution; legacy images are marked unreviewed

## Media Review Status

- **476 cards** have reviewed learning media: 450 curated ASL University videos and 26 byte-verified Lifeprint fingerspelling images.
- **24 cards** have no sufficiently precise source and are excluded instead of showing incorrect legacy media.
- **Sign → Word** mixes 363 focused YouTube clips with 26 reviewed local images. YouTube clips autoplay muted and restart automatically in a clipped player with YouTube title and control chrome masked.
- Shared and collection videos are excluded from Sign → Word because they could correspond to more than one answer.
- Run `python scripts/verify_media.py` to confirm that reviewed videos remain embeddable and local images still match their source.
