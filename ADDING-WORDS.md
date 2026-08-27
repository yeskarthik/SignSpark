# Adding New Words to SignSpark

Add temporary words through the app UI or permanent words through `data/words.json`. Media and text descriptions require a separate review step; file existence alone does not establish that a sign is correct.

---

## Option 1: In-App (Quick, No ASL Images)

Words added this way are stored in the browser's `localStorage` and won't have ASL sign images.

### Add a Single Word
1. Open the app → scroll to **Manage Words** → click **+ Add Word**
2. Type the word and pick a category
3. Click **Add**

### Import Multiple Words
1. Click **📥 Import**
2. Paste words, one per line
3. Click **Import**

### Export Current Words
1. Click **📤 Export** to download a `.txt` file of all words (base + custom)

> **Note**: In-app words only exist in *that browser*. They aren't synced or deployed. To make them permanent, use Option 2.

---

## Option 2: Permanent Vocabulary and Curated Media

Add the vocabulary through the data pipeline, then manually curate its learning and quiz media in `words.json`.

```json
{
  "word": "Red",
  "slug": "red",
  "category": "colors",
  "media": {
    "type": "youtube",
    "videoId": "YOUTUBE_ID",
    "sourceName": "Source name",
    "sourceUrl": "https://www.youtube.com/watch?v=YOUTUBE_ID",
    "reviewed": true
  },
  "quizMedia": {
    "type": "image",
    "src": "assets/gifs/red.gif",
    "sourceName": "Source name",
    "sourceUrl": "https://example.com/source",
    "reviewed": true
  },
  "textGuide": "Reviewed movement description",
  "textGuideReviewed": true,
  "textGuideSource": "https://example.com/authoritative-entry"
}
```

- `media` is shown after revealing a Word → Sign card. Reviewed, uniquely mapped media is also eligible for Sign → Word.
- `quizMedia` optionally overrides the media used for Sign → Word.
- Shared or collection media is automatically excluded from Sign → Word because it cannot identify one unambiguous answer.
- Quiz YouTube embeds autoplay muted in a clipped, control-free player that hides answer-revealing title chrome.
- YouTube entries store only the video ID and use `youtube-nocookie.com` at runtime.
- Text guides remain hidden unless `textGuideReviewed` is explicitly `true` and a source is recorded.
- Verify the intended meaning, regional variant, source permission, and playback before setting `reviewed`.

### Prerequisites

- **Python 3.10+**
- **Pillow** (`pip install Pillow`) — only needed for generating reference cards

### Step 1: Edit words.txt

Add your new words to `words.txt`, one per line:

```
Bicycle
Computer
Hospital
```

### Step 2: Run the data preparation script

```bash
python scripts/prepare_data.py
```

This legacy bootstrap step will:
- Clean and deduplicate `words.txt`
- Add numbers 1-66 and fingerspelling A-Z (if not already present)
- Categorize each word
- Output `data/words.json`
- Attempt to download candidate images from Lifeprint for review

### Step 3: Scrape for additional images

The initial download script uses URL guessing, which misses many words. Run the scraper for better coverage:

```bash
python scripts/scrape_lifeprint.py
```

This scrapes actual Lifeprint dictionary pages and extracts real image URLs from the HTML. It's the most effective method (~76% hit rate).

### Step 4: Generate reference cards for remaining words

For words where no image was found, generate instructional reference cards:

```bash
python scripts/generate_cards.py
```

This creates reference cards with generated descriptions using Pillow. Generated cards are not reviewed sign demonstrations and must not be marked as reviewed.

### Step 5: Update hasGif flags in words.json

After downloading candidate images, update `words.json` to mark which legacy files exist:

```python
import json
from pathlib import Path

words_path = Path("data/words.json")
gifs_dir = Path("assets/gifs")

words = json.loads(words_path.read_text())
for w in words:
    gif_file = gifs_dir / f"{w['slug']}.gif"
    w['hasGif'] = gif_file.exists() and gif_file.stat().st_size > 500

words_path.write_text(json.dumps(words, indent=2, ensure_ascii=False))
```

> `hasGif` identifies legacy local media only. New reviewed quiz media should use `quizMedia`; new learning media should use `media`.

### Step 6: Deploy

Follow the steps in [PUBLISHING.md](PUBLISHING.md) to push changes to Azure.

Before deployment, verify every reviewed source:

```bash
python scripts/verify_media.py
```

To apply an offline-reviewed mapping, use:

```bash
python scripts/apply_reviewed_media.py path/to/mapping.json --disable-all-legacy
```

---

## Full Pipeline (Copy-Paste)

```powershell
# From the repo root

# 1. Regenerate words.json and download what we can
python scripts/prepare_data.py

# 2. Scrape Lifeprint for better image coverage
python scripts/scrape_lifeprint.py

# 3. Generate reference cards for remaining words
python scripts/generate_cards.py

# 4. Update hasGif flags
python -c "
import json; from pathlib import Path
words = json.loads(Path('data/words.json').read_text())
for w in words:
    f = Path('assets/gifs') / f'{w[\"slug\"]}.gif'
    w['hasGif'] = f.exists() and f.stat().st_size > 500
Path('data/words.json').write_text(json.dumps(words, indent=2, ensure_ascii=False))
print(f'Updated {len(words)} words')
"

# 5. Deploy to Azure
cd $env:USERPROFILE
$token = az staticwebapp secrets list --name <your-app-name> --resource-group <your-resource-group> --query "properties.apiKey" -o tsv
$client = (Get-ChildItem "$env:USERPROFILE\.swa\deploy" -Recurse -Filter "StaticSitesClient.exe" | Select-Object -First 1).FullName
& $client upload --app "<path-to-your-repo>" --outputLocation "." --apiToken $token --skipAppBuild true --verbose
```

---

## Category Reference

Words are auto-categorized by `prepare_data.py`. Available categories:

| Category | Examples |
|----------|----------|
| `colors` | Red, Blue, Green, Purple |
| `clothing` | Shirt, Pants, Shoes, Hat |
| `family` | Mom, Dad, Husband, Wife |
| `animals` | Cat, Dog, Bird, Fish |
| `food-drink` | Apple, Coffee, Water, Milk |
| `places` | San Francisco, Library, Store |
| `actions` | Run, Walk, Dance, Read |
| `furniture-objects` | Door, Window, Chair, Table |
| `directions` | North, South, Left, Upstairs |
| `greetings-basics` | Hello, Bye, Please, Thank You |
| `education` | ASL, Class, College, Student |
| `feelings` | Tired, Sick, Like, Detest |
| `sizes` | Large, Medium, Small, New, Old |
| `numbers` | 1–66 (auto-added) |
| `fingerspelling` | A–Z (auto-added) |
| `general` | Anything that doesn't match above |

To add a new category, edit the `CATEGORY_RULES` dictionary in `scripts/prepare_data.py`.

---

## Tips

- **Lifeprint image paths are unpredictable** — the scraper (`scrape_lifeprint.py`) is much more effective than URL guessing
- **File extension doesn't matter** — browsers read file headers. JPGs/PNGs saved as `.gif` display correctly
- **Test locally first** — run `python -m http.server 8080` and check `http://localhost:8080`
- **Custom words in the app UI** are stored in `localStorage` under key `signspark_custom_words`
