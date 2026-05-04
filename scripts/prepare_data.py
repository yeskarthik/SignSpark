#!/usr/bin/env python3
"""
SignSpark Data Preparation Script
Cleans words.txt, adds numbers 1-66 and fingerspelling A-Z,
deduplicates, categorizes, and outputs data/words.json.
Also downloads ASL GIFs from the web.
"""

import json
import re
import os
import sys
import urllib.request
import urllib.error
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
WORDS_FILE = PROJECT_DIR / "words.txt"
OUTPUT_JSON = PROJECT_DIR / "data" / "words.json"
GIFS_DIR = PROJECT_DIR / "assets" / "gifs"

# Chat message patterns to filter out
CHAT_PATTERNS = [
    r'to\s+Everyone\s+\d+:\d+\s*(AM|PM)',
    r'You deleted a message',
    r'^\s*$',
    r'^(Claudia|Nicholas Bolger|You)\s+to\s+',
    r'Im going to need',
    r'I know from ur face',
    r'I mean I can read',
    r'FORGET #FS ALL',
    r'go right$',
    r'Teachers LOVE to',
    r'ALL YOU WORK NOW',
    r'students forget all',
    r'Not SK',
    r'^OK$',
    r'^Thank you!$',
]

# Category detection keywords
CATEGORY_RULES = {
    "colors": ["black", "grey", "white", "pink", "red", "orange", "yellow",
               "green", "blue", "purple", "brown", "colors", "color"],
    "clothing": ["shirt", "pants", "jacket", "dress", "skirt", "shoes", "hat",
                 "glasses", "clothes", "boots"],
    "family": ["mom", "dad", "mother", "father", "grandma", "daughter", "son",
               "husband", "wife", "parents", "children", "family", "boy friend",
               "girl friend", "roommate", "male", "female", "man", "woman",
               "brother", "sister", "siblings / brother & sister", "twins",
               "parents / mom & dad", "male / boy", "female / girl",
               "older / first born among siblings",
               "youngest / last / the last born among siblings",
               "the two of you", "the two of us",
               "to be close / to have a strong bond"],
    "animals": ["cat", "dog", "bird", "fish", "turtle", "rat", "rabbit", "pet"],
    "food-drink": ["apple", "candy", "eat", "drink", "coffee", "soda", "water",
                   "tea", "milk", "orange juice", "hot chocolate", "cook",
                   "cooking", "lunch", "sweets", "food room / food court"],
    "places": ["san francisco", "oakland", "berkeley", "fremont", "city",
               "house", "apartment", "dorm", "library", "store", "classroom",
               "room", "bathroom", "hallway", "elevator", "place",
               "shopping mall", "mountain", "area/region"],
    "actions": ["stand", "jump", "dance", "run", "walk", "draw", "write",
                "read", "sleep", "play", "shop", "exercise", "travel",
                "paint", "camping", "fishing", "sewing", "bicycling",
                "bowling", "cook", "type", "sign", "speak", "enter",
                "exit / go out", "wash hands", "buy", "practice",
                "take a picture", "watch", "play with a dog",
                "chat on the phone", "look at the time", "tie shoes",
                "chat", "see", "have", "need", "pay attention",
                "not pay attention"],
    "furniture-objects": ["door", "window", "light", "book", "paper", "chair",
                          "table", "shelves", "tv", "trash can", "box", "cup",
                          "backpack", "photo", "phone", "floor", "cabinet",
                          "soda machine", "food machine", "candy machine",
                          "sweets machine"],
    "directions": ["north", "south", "west", "east", "left", "front",
                   "on the right side", "on the left side", "upstairs",
                   "downstairs", "over there", "over there near",
                   "close by/in proximity", "over there / in that direction",
                   "here / in this area"],
    "greetings-basics": ["hello", "bye", "yes", "no", "please", "thank you",
                         "fine", "ok", "nice to meet you", "how are you?",
                         "your", "people"],
    "education": ["asl", "class", "college", "student", "teach", "teacher",
                  "learn", "homework", "language", "english", "french",
                  "spanish", "fingerspell", "high school", "gallaudet",
                  "deaf", "hearing"],
    "sizes": ["large", "medium large", "small medium", "small", "medium",
              "new", "old", "new so-so", "old so-so"],
    "feelings": ["tired", "sick", "so-so", "like", "detest", "favorite",
                 "patience", "hurry", "interesting / fascinating",
                 "to desire something / want",
                 "to not desire something / don't want"],
    "time": ["1 minute", "2 minutes", "3 minutes", "4 minutes", "5 minutes",
             "6 minutes", "7 minutes", "8 minutes", "9 minutes", "10 minutes",
             "11 minutes", "15 minutes", "20 minutes",
             "1 hour", "2 hours", "3 hours", "4 hours", "5 hours",
             "6 hours", "7 hours", "8 hours", "9 hours", "10 hours",
             "12 hours", "24 hours",
             "how many minutes?", "how many hours?",
             "always / constantly", "never", "sometimes", "in the future",
             "now", "later", "year"],
    "transport": ["drive", "bike", "motorcycle", "bus", "train",
                  "to ride in", "to go someplace", "to come here"],
    "relationships": ["to become pregnant / conceive a child",
                      "to be pregnant", "to give birth to a child",
                      "to fall in love", "to go out on a date",
                      "to exclusively date one person",
                      "boyfriend", "girlfriend", "propose marriage",
                      "engaged", "to wed or marry"],
    "age-ranges": ["less than one year old", "1-5 years old",
                   "6-9 years old", "10 years old", "11-15 years old",
                   "16-19 years old", "20 years old and older"],
    "numbers": [],  # filled dynamically
    "fingerspelling": [],  # filled dynamically
}


def is_chat_message(line: str) -> bool:
    for pattern in CHAT_PATTERNS:
        if re.search(pattern, line, re.IGNORECASE):
            return True
    return False


def clean_line(line: str) -> str:
    # Remove leading number and period/dot
    line = re.sub(r'^\d+\.\s*', '', line)
    return line.strip()


def categorize(word: str) -> str:
    lower = word.lower()
    for category, keywords in CATEGORY_RULES.items():
        if lower in keywords:
            return category
    return "general"


def to_slug(word: str) -> str:
    slug = word.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'\s+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def parse_words_file() -> list[str]:
    words = []
    with open(WORDS_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            cleaned = clean_line(line)
            if not cleaned:
                continue
            if is_chat_message(cleaned):
                continue
            # Skip pure metadata lines
            if len(cleaned) < 2:
                continue
            words.append(cleaned)
    return words


def deduplicate(words: list[str]) -> list[str]:
    seen = set()
    result = []
    for w in words:
        key = w.lower().strip()
        if key not in seen:
            seen.add(key)
            result.append(w)
    return result


def build_word_list() -> list[dict]:
    print("Parsing words.txt...")
    raw_words = parse_words_file()
    print(f"  Found {len(raw_words)} raw entries")

    # Add numbers 1-100
    for i in range(1, 101):
        raw_words.append(str(i))

    # Add fingerspelling A-Z
    for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        raw_words.append(f"Fingerspell {c}")

    # Deduplicate
    unique_words = deduplicate(raw_words)
    print(f"  After dedup: {len(unique_words)} unique entries")

    # Build structured list
    word_list = []
    for word in unique_words:
        slug = to_slug(word)
        if not slug:
            continue

        # Determine category
        if word.isdigit():
            cat = "numbers"
        elif word.startswith("Fingerspell "):
            cat = "fingerspelling"
        else:
            cat = categorize(word)

        word_list.append({
            "word": word,
            "slug": slug,
            "category": cat,
            "gif": f"assets/gifs/{slug}.gif"
        })

    print(f"  Final word list: {len(word_list)} entries")
    return word_list


def download_gif(word_entry: dict) -> bool:
    """Attempt to download an ASL GIF for the given word."""
    slug = word_entry["slug"]
    word = word_entry["word"]
    category = word_entry["category"]
    dest = GIFS_DIR / f"{slug}.gif"

    if dest.exists():
        return True

    # Build search terms for different sources
    search_word = word.lower().replace(" ", "")

    # For fingerspelling, we want just the letter
    if category == "fingerspelling":
        letter = word.split()[-1].lower()
        urls_to_try = [
            f"https://www.lifeprint.com/asl101/fingerspelling/abc-gifs/{letter}.gif",
            f"https://www.lifeprint.com/asl101/fingerspelling/{letter}.gif",
        ]
    elif category == "numbers":
        num = word
        urls_to_try = [
            f"https://www.lifeprint.com/asl101/signjpegs/{num}.gif",
            f"https://www.lifeprint.com/asl101/images-signs/{num}.gif",
        ]
    else:
        # General words
        clean_word = re.sub(r'[^a-z]', '', word.lower())
        urls_to_try = [
            f"https://www.lifeprint.com/asl101/signjpegs/{clean_word}.gif",
            f"https://www.lifeprint.com/asl101/images-signs/{clean_word}.gif",
        ]

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SignSpark Educational ASL App'
    }

    for url in urls_to_try:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as response:
                content = response.read()
                if len(content) > 100:  # Avoid saving error pages
                    dest.write_bytes(content)
                    print(f"  ✓ {word} <- {url}")
                    return True
        except (urllib.error.URLError, urllib.error.HTTPError, Exception):
            continue

    print(f"  ✗ {word} (no GIF found)")
    return False


def create_placeholder_svg(word_entry: dict):
    """Create a placeholder SVG for words without GIFs."""
    slug = word_entry["slug"]
    word = word_entry["word"]
    dest = GIFS_DIR / f"{slug}.gif"

    if dest.exists():
        return

    # Create a simple SVG placeholder saved as .svg (referenced as fallback)
    svg_dest = GIFS_DIR / f"{slug}.svg"
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
  <rect width="300" height="300" fill="#1a1a2e" rx="20"/>
  <text x="150" y="130" text-anchor="middle" fill="#e0e0e0" font-family="Arial" font-size="20">🤟</text>
  <text x="150" y="170" text-anchor="middle" fill="#e0e0e0" font-family="Arial" font-size="16">{word}</text>
  <text x="150" y="200" text-anchor="middle" fill="#888" font-family="Arial" font-size="12">GIF not available</text>
</svg>'''
    svg_dest.write_text(svg, encoding='utf-8')


def main():
    os.makedirs(GIFS_DIR, exist_ok=True)
    os.makedirs(OUTPUT_JSON.parent, exist_ok=True)

    # Step 1: Build clean word list
    word_list = build_word_list()

    # Step 2: Save words.json
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(word_list, f, indent=2, ensure_ascii=False)
    print(f"\nSaved {len(word_list)} words to {OUTPUT_JSON}")

    # Step 3: Download GIFs
    if "--skip-download" not in sys.argv:
        print("\nDownloading ASL GIFs...")
        success = 0
        failed = 0
        for i, entry in enumerate(word_list):
            if download_gif(entry):
                success += 1
            else:
                create_placeholder_svg(entry)
                failed += 1
            # Be polite to servers
            if i % 5 == 0 and i > 0:
                time.sleep(0.5)

        print(f"\nDownload complete: {success} found, {failed} placeholders created")
    else:
        print("\nSkipping GIF download (--skip-download flag)")


if __name__ == "__main__":
    main()
