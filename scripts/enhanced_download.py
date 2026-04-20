#!/usr/bin/env python3
"""
Enhanced GIF downloader - tries many more Lifeprint URL patterns
to maximize coverage for missing words.
"""

import json
import os
import re
import time
import urllib.request
import urllib.error
from pathlib import Path

PROJECT_DIR = Path(__file__).parent.parent
GIFS_DIR = PROJECT_DIR / "assets" / "gifs"
WORDS_JSON = PROJECT_DIR / "data" / "words.json"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SignSpark Educational ASL App'
}


def get_urls_for_word(word, category):
    """Generate multiple URL candidates for a word."""
    urls = []
    
    # Clean variations of the word
    clean = re.sub(r'[^a-z\s]', '', word.lower()).strip()
    no_spaces = clean.replace(' ', '')
    hyphenated = clean.replace(' ', '-')
    underscored = clean.replace(' ', '_')
    first_word = clean.split()[0] if clean.split() else clean
    
    # For multi-word phrases, also try just the key word
    words = clean.split()
    
    base = "https://www.lifeprint.com/asl101"
    
    # Pattern 1: /signjpegs/ (many formats)
    for variant in [no_spaces, hyphenated, underscored, first_word]:
        if variant:
            urls.append(f"{base}/signjpegs/{variant}.gif")
    
    # Pattern 2: /images-signs/ (many formats)
    for variant in [no_spaces, hyphenated, underscored, first_word]:
        if variant:
            urls.append(f"{base}/images-signs/{variant}.gif")
    
    # Pattern 3: /gifs-animated/ 
    for variant in [no_spaces, hyphenated, first_word]:
        if variant:
            urls.append(f"{base}/gifs-animated/{variant}.gif")
    
    # Pattern 4: /gifs/ directory
    for variant in [no_spaces, hyphenated, first_word]:
        if variant:
            urls.append(f"{base}/gifs/{variant}.gif")

    # Pattern 5: pages-signs with first letter subdirectory
    if first_word:
        letter = first_word[0]
        for variant in [no_spaces, hyphenated, first_word]:
            urls.append(f"{base}/pages-signs/{letter}/{variant}.gif")

    # Pattern 6: /images/ directory  
    for variant in [no_spaces, first_word]:
        if variant:
            urls.append(f"{base}/images/{variant}.gif")
            urls.append(f"{base}/images/{variant}1.gif")

    # Pattern 7: For numbers, try word forms and special patterns
    if category == "numbers":
        num = word.strip()
        number_words = {
            '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five',
            '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten',
            '11': 'eleven', '12': 'twelve', '13': 'thirteen', '14': 'fourteen',
            '15': 'fifteen', '16': 'sixteen', '17': 'seventeen', '18': 'eighteen',
            '19': 'nineteen', '20': 'twenty', '21': 'twentyone', '22': 'twentytwo',
            '23': 'twentythree', '24': 'twentyfour', '25': 'twentyfive',
            '30': 'thirty', '40': 'forty', '50': 'fifty', '60': 'sixty',
        }
        nw = number_words.get(num, '')
        urls.extend([
            f"{base}/signjpegs/{num}.gif",
            f"{base}/images-signs/{num}.gif",
            f"{base}/gifs-animated/{num}.gif",
            f"{base}/signjpegs/number{num}.gif",
            f"{base}/images-signs/number{num}.gif",
        ])
        if nw:
            urls.extend([
                f"{base}/signjpegs/{nw}.gif",
                f"{base}/images-signs/{nw}.gif",
                f"{base}/gifs-animated/{nw}.gif",
            ])
        # Number range images
        urls.extend([
            f"{base}/signjpegs/{num}a.gif",
            f"{base}/images-signs/{num}a.gif",
        ])

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            unique.append(u)
    
    return unique


def download_gif(dest, urls):
    """Try downloading from multiple URLs, return the successful one or None."""
    for url in urls:
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=10) as response:
                content_type = response.headers.get('Content-Type', '')
                content = response.read()
                # Verify it's actually an image (not an HTML error page)
                if len(content) > 200 and ('image' in content_type or content[:4] == b'GIF8'):
                    dest.write_bytes(content)
                    return url
        except (urllib.error.URLError, urllib.error.HTTPError, Exception):
            continue
    return None


def main():
    with open(WORDS_JSON, 'r', encoding='utf-8') as f:
        words = json.load(f)

    # Only process words that don't already have a GIF
    missing = []
    for w in words:
        gif_path = GIFS_DIR / f"{w['slug']}.gif"
        if not gif_path.exists():
            missing.append(w)

    print(f"Attempting enhanced download for {len(missing)} missing words...")
    
    success = 0
    failed = 0
    
    for i, entry in enumerate(missing):
        word = entry['word']
        slug = entry['slug']
        category = entry['category']
        dest = GIFS_DIR / f"{slug}.gif"
        
        # Skip fingerspelling (already handled) and very long phrases
        if category == 'fingerspelling':
            continue
            
        urls = get_urls_for_word(word, category)
        result = download_gif(dest, urls)
        
        if result:
            print(f"  ✓ {word} <- {result}")
            success += 1
        else:
            print(f"  ✗ {word}")
            failed += 1
        
        # Rate limiting
        if i % 3 == 0 and i > 0:
            time.sleep(0.3)
    
    print(f"\nEnhanced download: {success} new GIFs found, {failed} still missing")
    
    # Count total GIFs now
    total_gifs = len(list(GIFS_DIR.glob("*.gif")))
    total_words = len(words)
    print(f"Total coverage: {total_gifs}/{total_words} words have GIFs ({total_gifs*100//total_words}%)")


if __name__ == "__main__":
    main()
