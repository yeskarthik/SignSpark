#!/usr/bin/env python3
"""
Comprehensive image downloader for remaining ASL words.
Tries GIF, JPG, multi-frame JPG, and alternate word forms from Lifeprint.
Also tries HandSpeak as a secondary source.
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
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

# Manual mapping for words with non-obvious URLs
KNOWN_MAPPINGS = {
    'hello': ['hello1', 'hi', 'hello'],
    'nice': ['nice', 'nice1'],
    'same': ['same', 'same1', 'alike'],
    'again': ['again', 'repeat'],
    'man': ['man', 'male', 'boy'],
    'yes': ['yes', 'yes1'],
    'no': ['no', 'not', 'no1'],
    'jacket': ['jacket', 'coat'],
    'dress': ['dress', 'dress1'],
    'skirt': ['skirt', 'skirt1'],
    'hat': ['hat', 'cap'],
    'clothes': ['clothes', 'clothing'],
    'hair': ['hair', 'hair1'],
    'mustache': ['mustache', 'moustache'],
    'beard': ['beard', 'beard1'],
    'grey': ['grey', 'gray'],
    'white': ['white', 'white1'],
    'pink': ['pink', 'pink1'],
    'orange': ['orange', 'orange-color', 'orange1'],
    'purple': ['purple', 'purple1'],
    'colors': ['color', 'colors'],
    'dance': ['dance', 'dance1'],
    'window': ['window', 'window1'],
    'light': ['light', 'light1'],
    'paper': ['paper', 'paper1'],
    'draw': ['draw', 'art', 'draw1'],
    'write': ['write', 'write1'],
    'wrong': ['wrong', 'wrong1', 'mistake'],
    'asl': ['asl', 'sign-language'],
    'english': ['english', 'english1'],
    'french': ['french', 'france'],
    'language': ['language', 'language1'],
    'spanish': ['spanish', 'spain'],
    'teach': ['teach', 'instruct'],
    'here': ['here', 'here1'],
    'hearing': ['hearing', 'hear', 'hearing1'],
    'gallaudet': ['gallaudet', 'gallaudet1'],
    'head': ['head', 'head1'],
    'tail': ['tail'],
    'win': ['win', 'champion', 'victory'],
    'sign': ['sign', 'signing'],
    'tired': ['tired', 'exhaust', 'tired1'],
    'sick': ['sick', 'ill', 'sick1'],
    'both': ['both', 'both1'],
    'hard': ['hard', 'difficult', 'hard1'],
    'now': ['now', 'today', 'now1'],
    'watch': ['watch', 'look', 'watch1'],
    'fishing': ['fishing', 'fish1'],
    'travel': ['travel', 'trip', 'travel1'],
    'paint': ['paint', 'art1', 'painting'],
    'camping': ['camping', 'camp', 'tent'],
    'exercise': ['exercise', 'workout', 'exercise1'],
    'shop': ['shop', 'shopping', 'store1'],
    'bowling': ['bowling', 'bowl'],
    'bicycling': ['bicycle', 'bike', 'bicycling'],
    'game': ['game', 'game1', 'compete'],
    'detest': ['detest', 'hate', 'dont-like'],
    'favorite': ['favorite', 'favourite', 'prefer'],
    'chat': ['chat', 'talk', 'conversation'],
    'read': ['read', 'reading', 'read1'],
    'eat': ['eat', 'food', 'eat1'],
    'type': ['type', 'typing', 'keyboard'],
    'soda': ['soda', 'pop', 'soda-pop'],
    'milk': ['milk', 'milk1'],
    'north': ['north', 'north1'],
    'south': ['south', 'south1'],
    'west': ['west', 'west1'],
    'east': ['east', 'east1'],
    'floor': ['floor', 'floor1'],
    'table': ['table', 'table1', 'desk'],
    'tv': ['tv', 'television'],
    'box': ['box', 'box1'],
    'backpack': ['backpack', 'bag'],
    'photo': ['photo', 'picture', 'photograph'],
    'dorm': ['dorm', 'dormitory'],
    'front': ['front', 'front1'],
    'place': ['place', 'area'],
    'hallway': ['hallway', 'hall'],
    'upstairs': ['upstairs', 'up'],
    'downstairs': ['downstairs', 'down'],
    'elevator': ['elevator', 'elevator1'],
    'cooking': ['cook1', 'cooking'],
    'your': ['your', 'yours', 'you'],
    'bye': ['bye', 'goodbye', 'bye-bye'],
    'male': ['male', 'boy', 'man'],
    'female': ['female', 'girl', 'woman1'],
    'middle': ['middle', 'center'],
    'medium': ['medium', 'middle1'],
    'cabinet': ['cabinet', 'cupboard'],
    'boots': ['boots', 'boot'],
    'left': ['left', 'left1'],
    'lunch': ['lunch', 'noon', 'lunch1'],
    'later': ['later', 'after', 'later1'],
    'mother': ['mother', 'mom1', 'mama'],
    'father': ['father', 'dad1', 'papa'],
    'husband': ['husband', 'husband1'],
    'wife': ['wife', 'wife1'],
    'parents': ['parents', 'parent'],
    'family': ['family', 'family1'],
    'roommate': ['roommate', 'room-mate'],
    'turtle': ['turtle', 'turtle1', 'tortoise'],
    'rat': ['rat', 'mouse', 'rat1'],
    'rabbit': ['rabbit', 'bunny', 'rabbit1'],
    'pet': ['pet', 'pet1'],
    'none': ['none', 'nothing', 'zero'],
    'need': ['need', 'need1', 'must'],
    'buy': ['buy', 'purchase', 'buy1'],
    'patience': ['patience', 'patient', 'wait'],
    'shape': ['shape', 'form'],
    'number': ['number', 'number1'],
    'fingerspell': ['fingerspell', 'spell'],
    'shelves': ['shelves', 'shelf'],
    'children': ['child', 'children1', 'kids'],
    'sewing': ['sewing', 'sew'],
    'people': ['people1', 'person'],
    'license': ['license', 'licence'],
    'expired': ['expired', 'expire'],
    'retired': ['retired', 'retire'],
}

# Number word mappings
NUMBER_WORDS = {
    1: ['one', '1'], 2: ['two', '2'], 3: ['three', '3'], 4: ['four', '4'],
    5: ['five', '5'], 6: ['six', '6'], 7: ['seven', '7'], 8: ['eight', '8'],
    9: ['nine', '9'], 10: ['ten', '10'], 11: ['eleven', '11'], 12: ['twelve', '12'],
    13: ['thirteen', '13'], 14: ['fourteen', '14'], 15: ['fifteen', '15'],
    16: ['sixteen', '16'], 17: ['seventeen', '17'], 18: ['eighteen', '18'],
    19: ['nineteen', '19'], 20: ['twenty', '20'], 21: ['twenty-one', 'twentyone', '21'],
    22: ['twenty-two', 'twentytwo', '22'], 23: ['twenty-three', '23'],
    24: ['twenty-four', 'twentyfour', '24'], 25: ['twenty-five', '25'],
    26: ['twenty-six', 'twentysix', '26'], 27: ['twenty-seven', '27'],
    28: ['twenty-eight', '28'], 29: ['twenty-nine', '29'],
    30: ['thirty', '30'], 31: ['thirty-one', '31'], 32: ['thirty-two', '32'],
    33: ['thirty-three', '33'], 34: ['thirty-four', '34'], 35: ['thirty-five', '35'],
    36: ['thirty-six', '36'], 37: ['thirty-seven', '37'], 38: ['thirty-eight', '38'],
    39: ['thirty-nine', '39'], 40: ['forty', '40'], 41: ['forty-one', '41'],
    42: ['forty-two', '42'], 43: ['forty-three', '43'], 44: ['forty-four', '44'],
    45: ['forty-five', '45'], 46: ['forty-six', '46'], 47: ['forty-seven', '47'],
    48: ['forty-eight', '48'], 49: ['forty-nine', '49'], 50: ['fifty', '50'],
    51: ['fifty-one', '51'], 52: ['fifty-two', '52'], 53: ['fifty-three', '53'],
    54: ['fifty-four', '54'], 55: ['fifty-five', '55'], 56: ['fifty-six', '56'],
    57: ['fifty-seven', '57'], 58: ['fifty-eight', '58'], 59: ['fifty-nine', '59'],
    60: ['sixty', '60'], 61: ['sixty-one', '61'], 62: ['sixty-two', '62'],
    63: ['sixty-three', '63'], 64: ['sixty-four', '64'], 65: ['sixty-five', '65'],
    66: ['sixty-six', '66'],
}


def get_all_urls(word, category):
    """Generate comprehensive URL list for a word."""
    urls = []
    base = "https://www.lifeprint.com/asl101"
    
    clean = re.sub(r'[^a-z\s]', '', word.lower()).strip()
    first_word = clean.split()[0] if clean.split() else clean
    no_spaces = clean.replace(' ', '')
    
    # Check known mappings
    lookup_key = clean.replace(' ', '')
    if lookup_key in KNOWN_MAPPINGS:
        variants = KNOWN_MAPPINGS[lookup_key]
    elif first_word in KNOWN_MAPPINGS:
        variants = KNOWN_MAPPINGS[first_word]
    else:
        variants = [no_spaces, first_word]
    
    # Add original forms too
    all_variants = list(dict.fromkeys(variants + [no_spaces, first_word]))
    
    # For numbers, add number-specific variants
    if category == "numbers" and word.strip().isdigit():
        num = int(word.strip())
        if num in NUMBER_WORDS:
            all_variants = list(dict.fromkeys(NUMBER_WORDS[num] + all_variants))
    
    # Directories to search in
    dirs = ['signjpegs', 'images-signs', 'gifs-animated', 'gifs', 'images']
    
    for variant in all_variants:
        if not variant:
            continue
        for d in dirs:
            # GIF
            urls.append(f"{base}/{d}/{variant}.gif")
            # JPG
            urls.append(f"{base}/{d}/{variant}.jpg")
            # PNG
            urls.append(f"{base}/{d}/{variant}.png")
            # Multi-frame first image
            urls.append(f"{base}/{d}/{variant}-aa.jpg")
            # Numbered variants
            urls.append(f"{base}/{d}/{variant}1.gif")
            urls.append(f"{base}/{d}/{variant}1.jpg")
    
    # Deduplicate
    seen = set()
    unique = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            unique.append(u)
    return unique


def try_download(dest, urls):
    """Try downloading from URLs, return successful URL or None."""
    for url in urls:
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=8) as response:
                content_type = response.headers.get('Content-Type', '')
                content = response.read()
                # Must be a real image
                is_gif = content[:4] == b'GIF8'
                is_jpg = content[:2] == b'\xff\xd8'
                is_png = content[:4] == b'\x89PNG'
                if len(content) > 200 and (is_gif or is_jpg or is_png or 'image' in content_type):
                    dest.write_bytes(content)
                    return url
        except Exception:
            continue
    return None


def main():
    with open(WORDS_JSON, 'r', encoding='utf-8') as f:
        words = json.load(f)
    
    missing = [w for w in words if not w.get('hasGif', False)]
    print(f"Attempting comprehensive download for {len(missing)} missing words...\n")
    
    found = 0
    still_missing = 0
    
    for i, entry in enumerate(missing):
        word = entry['word']
        slug = entry['slug']
        category = entry['category']
        
        # Determine destination - use .gif extension for consistency but may contain jpg/png data
        # The browser doesn't care about extension, it reads the file header
        dest = GIFS_DIR / f"{slug}.gif"
        if dest.exists():
            found += 1
            continue
        
        urls = get_all_urls(word, category)
        result = try_download(dest, urls)
        
        if result:
            ext = result.split('.')[-1]
            print(f"  ✓ {word} <- {result}")
            found += 1
        else:
            print(f"  ✗ {word} ({len(urls)} URLs tried)")
            still_missing += 1
        
        # Rate limiting
        if i % 5 == 0 and i > 0:
            time.sleep(0.5)
    
    # Update words.json with new hasGif flags
    for w in words:
        gif_path = GIFS_DIR / f"{w['slug']}.gif"
        w['hasGif'] = gif_path.exists()
    
    with open(WORDS_JSON, 'w', encoding='utf-8') as f:
        json.dump(words, f, indent=2, ensure_ascii=False)
    
    total_with = sum(1 for w in words if w['hasGif'])
    print(f"\nResults: {found} new images found, {still_missing} still missing")
    print(f"Total coverage: {total_with}/{len(words)} ({total_with*100//len(words)}%)")


if __name__ == "__main__":
    main()
