# 🤟 SignSpark — Learn ASL with Flashcards

A mobile-friendly web app for learning American Sign Language through interactive flashcards.

**Live site**: Deploy to Azure Static Web Apps — see [PUBLISHING.md](PUBLISHING.md)

## Features

- **384 flashcards** across 16 categories (greetings, colors, family, numbers, fingerspelling, and more)
- **Two quiz modes**:
  - 📝 **Word → Sign**: See a word, try to sign it, reveal the answer, self-rate
  - 🎬 **Sign → Word**: See an ASL sign GIF, guess the word (multiple choice or free text)
- **Weighted repetition** — cards you get wrong appear more often
- **Category filtering** — focus on specific topics
- **Dark/light mode**
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
- **Data prep**: Python 3.10+ scripts (offline only)
- **Hosting**: Azure Static Web Apps (Free tier)
- **ASL images**: Sourced from [Lifeprint.com](https://www.lifeprint.com)
