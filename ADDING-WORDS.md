# Adding New Words to SignSpark

There are **two ways** to add words — through the app UI (quick, no images) or through the data pipeline (full support with ASL images).

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

## Option 2: Data Pipeline (Permanent, With Images)

This adds words to `words.json` and downloads ASL images so they work in both quiz modes.

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

This will:
- Clean and deduplicate `words.txt`
- Add numbers 1-66 and fingerspelling A-Z (if not already present)
- Categorize each word
- Output `data/words.json`
- Attempt to download GIFs from Lifeprint for new words

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

This creates images with hand position descriptions using Pillow. Requires the `Pillow` package.

### Step 5: Update hasGif flags in words.json

After downloading images, update `words.json` to mark which words have real GIFs:

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

> The `hasGif` flag determines whether a word appears in Mode 2 (Sign → Word). Cards without real images are excluded from that mode.

### Step 6: Deploy

Follow the steps in [PUBLISHING.md](PUBLISHING.md) to push changes to Azure.

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
