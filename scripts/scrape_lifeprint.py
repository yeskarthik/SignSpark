#!/usr/bin/env python3
"""
Scrape Lifeprint dictionary pages to find actual image/GIF URLs.
Instead of guessing URLs, this fetches the dictionary page for each word
and extracts the real image sources from the HTML.
"""

import json
import os
import re
import time
import urllib.request
import urllib.error
from html.parser import HTMLParser
from pathlib import Path

PROJECT_DIR = Path(__file__).parent.parent
GIFS_DIR = PROJECT_DIR / "assets" / "gifs"
WORDS_JSON = PROJECT_DIR / "data" / "words.json"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}


class ImageExtractor(HTMLParser):
    """Extract img src URLs from HTML."""
    def __init__(self):
        super().__init__()
        self.images = []

    def handle_starttag(self, tag, attrs):
        if tag == 'img':
            attrs_dict = dict(attrs)
            src = attrs_dict.get('src', '')
            if src:
                self.images.append(src)


def fetch_page(url):
    """Fetch a web page and return its HTML content."""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=12) as response:
            return response.read().decode('utf-8', errors='ignore')
    except Exception:
        return None


def extract_sign_images(html, base_url):
    """Extract ASL sign image URLs from a Lifeprint dictionary page."""
    parser = ImageExtractor()
    parser.feed(html)

    sign_images = []
    for src in parser.images:
        # Make absolute URL
        if src.startswith('//'):
            src = 'https:' + src
        elif src.startswith('/'):
            src = 'https://www.lifeprint.com' + src
        elif not src.startswith('http'):
            # Relative URL - resolve against page URL
            base = base_url.rsplit('/', 1)[0]
            src = base + '/' + src

        # Filter for sign images (GIF/JPG in relevant directories)
        lower = src.lower()
        if any(d in lower for d in ['signjpegs', 'images-signs', 'gifs-animated', 'gifs/', 'fingerspelling']):
            if any(lower.endswith(ext) for ext in ['.gif', '.jpg', '.jpeg', '.png']):
                sign_images.append(src)

    # Deduplicate preserving order
    seen = set()
    unique = []
    for s in sign_images:
        if s not in seen:
            seen.add(s)
            unique.append(s)
    return unique


def download_image(url, dest):
    """Download an image file."""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as response:
            content = response.read()
            if len(content) > 200:
                # Verify it's an image
                is_gif = content[:4] == b'GIF8'
                is_jpg = content[:2] == b'\xff\xd8'
                is_png = content[:4] == b'\x89PNG'
                if is_gif or is_jpg or is_png:
                    dest.write_bytes(content)
                    return True
    except Exception:
        pass
    return False


def get_page_urls(word, category):
    """Generate possible Lifeprint dictionary page URLs for a word."""
    urls = []
    clean = re.sub(r'[^a-z\s]', '', word.lower()).strip()
    first_word = clean.split()[0] if clean.split() else clean
    no_spaces = clean.replace(' ', '')
    hyphenated = clean.replace(' ', '-')
    underscored = clean.replace(' ', '_')

    if not first_word:
        return []

    letter = first_word[0]

    # Known alternate page names
    alternates = {
        'hello': ['hello', 'hi'],
        'nice': ['nice', 'good'],
        'same': ['same'],
        'again': ['again', 'repeat'],
        'man': ['man', 'male'],
        'woman': ['woman', 'female'],
        'yes': ['yes'],
        'no': ['no', 'not'],
        'dress': ['dress'],
        'skirt': ['skirt'],
        'hat': ['hat'],
        'clothes': ['clothes', 'clothing'],
        'hair': ['hair'],
        'grey': ['gray', 'grey'],
        'white': ['white'],
        'pink': ['pink'],
        'orange': ['orange'],
        'purple': ['purple'],
        'dance': ['dance'],
        'window': ['window'],
        'light': ['light'],
        'paper': ['paper'],
        'draw': ['draw', 'art'],
        'write': ['write'],
        'wrong': ['wrong', 'mistake'],
        'english': ['english'],
        'french': ['french'],
        'language': ['language'],
        'teach': ['teach', 'instruct'],
        'here': ['here'],
        'hearing': ['hearing', 'hear'],
        'head': ['head'],
        'win': ['win'],
        'sign': ['sign'],
        'tired': ['tired'],
        'sick': ['sick', 'ill'],
        'both': ['both'],
        'hard': ['hard', 'difficult'],
        'now': ['now'],
        'fishing': ['fishing', 'fish'],
        'travel': ['travel', 'trip'],
        'paint': ['paint'],
        'camping': ['camp', 'camping'],
        'exercise': ['exercise'],
        'shop': ['shop', 'shopping'],
        'game': ['game'],
        'favorite': ['favorite', 'prefer'],
        'read': ['read'],
        'eat': ['eat', 'food'],
        'type': ['type', 'typing'],
        'soda': ['soda', 'pop'],
        'milk': ['milk'],
        'north': ['north'],
        'south': ['south'],
        'west': ['west'],
        'east': ['east'],
        'floor': ['floor'],
        'table': ['table', 'desk'],
        'tv': ['tv', 'television'],
        'box': ['box'],
        'backpack': ['backpack'],
        'dorm': ['dorm', 'dormitory'],
        'elevator': ['elevator'],
        'cooking': ['cook', 'cooking'],
        'your': ['your', 'you'],
        'bye': ['bye', 'goodbye'],
        'male': ['male', 'man', 'boy'],
        'mother': ['mother', 'mom'],
        'father': ['father', 'dad'],
        'husband': ['husband'],
        'wife': ['wife'],
        'parents': ['parents', 'parent'],
        'turtle': ['turtle'],
        'rabbit': ['rabbit', 'bunny'],
        'pet': ['pet'],
        'buy': ['buy'],
        'left': ['left'],
        'lunch': ['lunch', 'noon'],
        'shape': ['shape'],
        'number': ['number'],
        'different': ['different'],
        'again': ['again'],
        'gallaudet': ['gallaudet'],
        'shelves': ['shelf', 'shelves'],
        'highschool': ['high-school', 'highschool'],
        'children': ['children', 'child'],
        'boots': ['boots', 'boot'],
        'middle': ['middle', 'center'],
        'medium': ['medium'],
    }

    # Build list of word variants to try
    variants = [no_spaces, first_word]
    if no_spaces in alternates:
        variants.extend(alternates[no_spaces])
    elif first_word in alternates:
        variants.extend(alternates[first_word])
    variants.append(hyphenated)
    variants.append(underscored)

    # Deduplicate
    variants = list(dict.fromkeys(v for v in variants if v))

    for variant in variants:
        v_letter = variant[0] if variant else letter
        # Main pattern: /pages-signs/l/word.htm
        urls.append(f"https://www.lifeprint.com/asl101/pages-signs/{v_letter}/{variant}.htm")
        urls.append(f"https://www.lifeprint.com/asl101/pages-signs/{v_letter}/{variant}.html")

    # For numbers, try the number pages
    if category == 'numbers':
        num = word.strip()
        urls.insert(0, f"https://www.lifeprint.com/asl101/pages-signs/n/numbers.htm")
        urls.insert(0, f"https://www.lifeprint.com/asl101/pages-signs/n/number{num}.htm")
        urls.insert(0, f"https://www.lifeprint.com/asl101/pages-signs/n/{num}.htm")

    return urls


def main():
    with open(WORDS_JSON, 'r', encoding='utf-8') as f:
        words = json.load(f)

    missing = [w for w in words if not w.get('hasGif', False)]
    print(f"Scraping Lifeprint pages for {len(missing)} missing words...\n")

    found = 0
    still_missing = 0
    pages_checked = 0

    for i, entry in enumerate(missing):
        word = entry['word']
        slug = entry['slug']
        category = entry['category']
        dest = GIFS_DIR / f"{slug}.gif"

        if dest.exists():
            found += 1
            continue

        page_urls = get_page_urls(word, category)
        got_image = False

        for page_url in page_urls:
            html = fetch_page(page_url)
            pages_checked += 1
            if not html:
                continue

            images = extract_sign_images(html, page_url)
            if not images:
                continue

            # Try downloading the first valid sign image
            for img_url in images:
                if download_image(img_url, dest):
                    print(f"  ✓ {word} <- {img_url} (via {page_url})")
                    got_image = True
                    found += 1
                    break

            if got_image:
                break

        if not got_image:
            print(f"  ✗ {word}")
            still_missing += 1

        # Rate limiting - be respectful
        time.sleep(0.4)

        # Progress update every 20 words
        if (i + 1) % 20 == 0:
            print(f"  ... {i+1}/{len(missing)} processed, {found} found so far")

    # Update words.json
    for w in words:
        gif_path = GIFS_DIR / f"{w['slug']}.gif"
        w['hasGif'] = gif_path.exists()

    with open(WORDS_JSON, 'w', encoding='utf-8') as f:
        json.dump(words, f, indent=2, ensure_ascii=False)

    total_with = sum(1 for w in words if w['hasGif'])
    print(f"\n{'='*50}")
    print(f"Pages checked: {pages_checked}")
    print(f"New images found: {found}")
    print(f"Still missing: {still_missing}")
    print(f"Total coverage: {total_with}/{len(words)} ({total_with*100//len(words)}%)")


if __name__ == "__main__":
    main()
