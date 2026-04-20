#!/usr/bin/env python3
"""
Generate instructional images for ASL numbers and remaining words
that don't have GIFs/images from external sources.
Creates clean, informative reference cards using Pillow.
"""

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

PROJECT_DIR = Path(__file__).parent.parent
GIFS_DIR = PROJECT_DIR / "assets" / "gifs"
WORDS_JSON = PROJECT_DIR / "data" / "words.json"

# ASL number hand descriptions
NUMBER_DESCRIPTIONS = {
    1: "Index finger up\nOther fingers closed\nPalm facing you",
    2: "Index + middle finger up\n(Peace sign)\nPalm facing you",
    3: "Thumb + index +\nmiddle finger up\nPalm facing you",
    4: "Four fingers up\nThumb tucked in\nPalm facing out",
    5: "All five fingers\nspread open\nPalm facing out",
    6: "Pinky + thumb touch\nOther 3 fingers up\nPalm facing out",
    7: "Ring finger + thumb\ntouch, others up\nPalm facing out",
    8: "Middle + thumb touch\nOther fingers up\nPalm facing out",
    9: "Index + thumb touch\nOther fingers up\nPalm facing out",
    10: "Thumbs up, shake\nside to side\n(A-hand wiggle)",
    11: "Flick index finger\nup from S-hand\nPalm facing you",
    12: "Flick index + middle\nfinger up from S\nPalm facing you",
    13: "3-hand wobbles\nfingers together\nPalm facing you",
    14: "4-hand wobbles\nfingers together\nPalm facing you",
    15: "5-hand wobbles\nfingers together\nPalm facing you",
    16: "A-hand → 6-hand\nTwist wrist\nPalm ends facing out",
    17: "A-hand → 7-hand\nTwist wrist\nPalm ends facing out",
    18: "A-hand → 8-hand\nTwist wrist\nPalm ends facing out",
    19: "A-hand → 9-hand\nTwist wrist\nPalm ends facing out",
    20: "Pinch index + thumb\ntogether repeatedly\n(G-hand pinch)",
    21: "L-hand, thumb wiggles\ndown\nPalm facing out",
    22: "V-hand bounces\nto the right\nPalm facing out",
    23: "Middle finger bends\ndown repeatedly\nFrom 5-hand",
    24: "L-hand → 4-hand\nSmooth transition\nPalm facing out",
    25: "Middle finger wiggles\n5-hand shape\nPalm facing out",
    26: "L-hand → 6-hand\nSmooth transition\nPalm facing out",
    27: "L-hand → 7-hand\nSmooth transition\nPalm facing out",
    28: "L-hand → 8-hand\nSmooth transition\nPalm facing out",
    29: "L-hand → 9-hand\nSmooth transition\nPalm facing out",
    30: "3-hand + closed hand\nPinch fingers together\nTwo-part sign",
    31: "3-hand → 1-hand\nSmooth transition\nPalm facing out",
    32: "3-hand → 2-hand\nSmooth transition\nPalm facing out",
    33: "3-hand wiggles\nmiddle finger down\nPalm facing out",
    34: "3-hand → 4-hand\nSmooth transition\nPalm facing out",
    35: "3-hand → 5-hand\nSmooth transition\nPalm facing out",
    36: "3-hand → 6-hand\nSmooth transition\nPalm facing out",
    37: "3-hand → 7-hand\nSmooth transition\nPalm facing out",
    38: "3-hand → 8-hand\nSmooth transition\nPalm facing out",
    39: "3-hand → 9-hand\nSmooth transition\nPalm facing out",
    40: "4-hand + closed hand\nPinch fingers together\nTwo-part sign",
    41: "4-hand → 1-hand\nSmooth transition\nPalm facing out",
    42: "4-hand → 2-hand\nSmooth transition\nPalm facing out",
    43: "4-hand → 3-hand\nSmooth transition\nPalm facing out",
    44: "4-hand wiggles\nall fingers bend\nPalm facing out",
    45: "4-hand → 5-hand\nSmooth transition\nPalm facing out",
    46: "4-hand → 6-hand\nSmooth transition\nPalm facing out",
    47: "4-hand → 7-hand\nSmooth transition\nPalm facing out",
    48: "4-hand → 8-hand\nSmooth transition\nPalm facing out",
    49: "4-hand → 9-hand\nSmooth transition\nPalm facing out",
    50: "5-hand + closed hand\nPinch fingers together\nTwo-part sign",
    51: "5-hand → 1-hand\nSmooth transition\nPalm facing out",
    52: "5-hand → 2-hand\nSmooth transition\nPalm facing out",
    53: "5-hand → 3-hand\nSmooth transition\nPalm facing out",
    54: "5-hand → 4-hand\nSmooth transition\nPalm facing out",
    55: "5-hand wiggles\nall fingers bend\nPalm facing out",
    56: "5-hand → 6-hand\nSmooth transition\nPalm facing out",
    57: "5-hand → 7-hand\nSmooth transition\nPalm facing out",
    58: "5-hand → 8-hand\nSmooth transition\nPalm facing out",
    59: "5-hand → 9-hand\nSmooth transition\nPalm facing out",
    60: "6-hand + closed hand\nPinch fingers together\nTwo-part sign",
    61: "6-hand → 1-hand\nSmooth transition\nPalm facing out",
    62: "6-hand → 2-hand\nSmooth transition\nPalm facing out",
    63: "6-hand → 3-hand\nSmooth transition\nPalm facing out",
    64: "6-hand → 4-hand\nSmooth transition\nPalm facing out",
    65: "6-hand → 5-hand\nSmooth transition\nPalm facing out",
    66: "6-hand wiggles\npinky + thumb touch\nPalm facing out",
}

# Hand sign emoji approximations for visual appeal
NUMBER_EMOJI = {
    1: "☝️", 2: "✌️", 3: "🤟", 4: "🖖", 5: "🖐️",
    6: "🤙", 7: "🤞", 8: "🤘", 9: "👌", 10: "👍",
}

# Remaining word descriptions
WORD_DESCRIPTIONS = {
    "hello": "Wave open hand\nside to side\nnear forehead",
    "number": "Both hands touch\nfingertips, then twist\napart and together",
    "so-so": "Open hand tilts\nside to side\n(palm down, wobble)",
    "sort of easy": "Easy sign +\nso-so modifier\nBrush fingers upward",
    "sort of hard": "Hard sign +\nso-so modifier\nBent-V hands clash",
    "detest": "Flick middle finger\noff thumb, away\nfrom body (strong)",
    "bye": "Wave hand open\nand close fingers\nrepeatedly",
    "area/region": "Flat hand circles\nin front of body\npalm down",
    "h-i-l-l-s": "Fingerspell\nH-I-L-L-S\n(Proper noun)",
    "near water": "W-hand taps chin\n+ point nearby\n(water + near)",
    "near park": "Bent-V hand on\nback of other hand\n+ point nearby",
    "shelves": "Both flat hands\nheld parallel,\nstack vertically",
    "trash can": "T-hand tosses\nforward (throw away)\ninto container",
    "fs office": "Fingerspell\nO-F-F-I-C-E\n(Office)",
    "fs atm": "Fingerspell\nA-T-M\n(ATM machine)",
    "fs lab": "Fingerspell\nL-A-B\n(Laboratory)",
    "fs lobby": "Fingerspell\nL-O-B-B-Y\n(Lobby)",
    "sweets machine": "Candy sign +\nmachine sign\n(Two-part compound)",
    "hallway": "Both flat hands\nparallel, move\nforward (corridor)",
    "cooking": "Flat hand flips\non other palm\n(like flipping food)",
    "prep": "P-hands move\nforward together\n(prepare/ready)",
    "relieve": "Both flat hands\nbrush down chest\n(relief gesture)",
    "license": "L-hands stamp\nonto palm\n(like stamping card)",
    "expired": "Flat hand flips\nover (time passed)\nPalm up → down",
    "retired": "R-hands pull\nback to chest\n(step back gesture)",
    "lincoln": "L-hand on\nforehead/temple\n(Proper noun)",
    "to put something on something": "Flat hand places\ndown on surface\n(placement gesture)",
    "to be caught in an embarrassing situation; to feel like an idiot": "Index finger\ncircles near ear\n(embarrassment)",
    "\"gotta go!\" (to the bathroom)": "Shake T-hand\nside to side\n(toilet/urgent)",
    "male": "Flat hand at\nforehead (boy area)\nGrasp brim of cap",
}


def create_card(word, description, emoji="🤟", bg_color="#1a1a2e"):
    """Create a reference card image."""
    width, height = 400, 400
    img = Image.new('RGB', (width, height), bg_color)
    draw = ImageDraw.Draw(img)

    # Try to use a nice font, fall back to default
    try:
        title_font = ImageFont.truetype("arial.ttf", 28)
        desc_font = ImageFont.truetype("arial.ttf", 18)
        emoji_font = ImageFont.truetype("seguiemj.ttf", 60)
        small_font = ImageFont.truetype("arial.ttf", 14)
    except:
        title_font = ImageFont.load_default()
        desc_font = ImageFont.load_default()
        emoji_font = ImageFont.load_default()
        small_font = ImageFont.load_default()

    # Draw rounded rectangle background
    draw.rounded_rectangle([20, 20, width-20, height-20], radius=20, fill="#16213e", outline="#6c5ce7", width=2)

    # Emoji
    try:
        draw.text((width//2, 70), emoji, font=emoji_font, fill="white", anchor="mm")
    except:
        draw.text((width//2 - 20, 40), emoji, font=title_font, fill="white")

    # Word title
    draw.text((width//2, 130), word, font=title_font, fill="#a29bfe", anchor="mm")

    # Divider line
    draw.line([(60, 160), (width-60, 160)], fill="#6c5ce7", width=1)

    # Description - ASL hand description
    y = 180
    for line in description.split('\n'):
        draw.text((width//2, y), line.strip(), font=desc_font, fill="#e0e0e0", anchor="mm")
        y += 26

    # Footer
    draw.text((width//2, height-45), "ASL Hand Position Reference", font=small_font, fill="#666", anchor="mm")

    return img


def main():
    with open(WORDS_JSON, 'r', encoding='utf-8') as f:
        words = json.load(f)

    missing = [w for w in words if not w.get('hasGif', False)]
    print(f"Generating reference cards for {len(missing)} remaining words...\n")

    generated = 0

    for entry in missing:
        word = entry['word']
        slug = entry['slug']
        category = entry['category']
        dest = GIFS_DIR / f"{slug}.gif"

        if dest.exists():
            continue

        description = None
        emoji = "🤟"

        if category == 'numbers' and word.strip().isdigit():
            num = int(word.strip())
            description = NUMBER_DESCRIPTIONS.get(num)
            emoji = NUMBER_EMOJI.get(num, "🔢")
            if not emoji or num > 10:
                emoji = "🔢"
        else:
            lookup = word.lower()
            for key, desc in WORD_DESCRIPTIONS.items():
                if key in lookup or lookup in key:
                    description = desc
                    break

        if not description:
            description = f"Practice signing:\n{word}\n(Reference your class notes)"

        img = create_card(word, description, emoji)

        # Save as PNG (browser handles it fine even with .gif extension)
        # Actually, save as proper PNG with correct extension, and update the gif path
        png_dest = GIFS_DIR / f"{slug}.png"
        img.save(str(png_dest), 'PNG')

        # Also save as gif extension for compatibility
        img.save(str(dest), 'GIF')

        print(f"  ✓ Generated: {word}")
        generated += 1

    # Update words.json
    for w in words:
        gif_path = GIFS_DIR / f"{w['slug']}.gif"
        png_path = GIFS_DIR / f"{w['slug']}.png"
        w['hasGif'] = gif_path.exists() or png_path.exists()

    with open(WORDS_JSON, 'w', encoding='utf-8') as f:
        json.dump(words, f, indent=2, ensure_ascii=False)

    total_with = sum(1 for w in words if w['hasGif'])
    print(f"\nGenerated {generated} reference cards")
    print(f"Total coverage: {total_with}/{len(words)} ({total_with*100//len(words)}%)")


if __name__ == "__main__":
    main()
