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
    # Time - minutes
    "1 minute": "1-hand + minute sign\nIndex moves forward\non flat palm",
    "2 minutes": "2-hand + minute sign\nFingers move forward\non flat palm",
    "3 minutes": "3-hand + minute sign\nFingers move forward\non flat palm",
    "4 minutes": "4-hand + minute sign\nFingers move forward\non flat palm",
    "5 minutes": "5-hand + minute sign\nFingers move forward\non flat palm",
    "6 minutes": "6-hand + minute sign\nFingers move forward\non flat palm",
    "7 minutes": "7-hand + minute sign\nFingers move forward\non flat palm",
    "8 minutes": "8-hand + minute sign\nFingers move forward\non flat palm",
    "9 minutes": "9-hand + minute sign\nFingers move forward\non flat palm",
    "10 minutes": "10-hand + minute sign\nFingers move forward\non flat palm",
    "11 minutes": "11-hand + minute sign\nFlick index finger\non flat palm",
    "15 minutes": "15-hand + minute sign\n(Quarter hour)\non flat palm",
    "20 minutes": "20-hand (G-pinch)\n+ minute sign\non flat palm",
    # Time - hours
    "1 hour": "1-hand circles once\naround flat palm\n(clock motion)",
    "2 hours": "2-hand circles once\naround flat palm\n(clock motion)",
    "3 hours": "3-hand circles once\naround flat palm\n(clock motion)",
    "4 hours": "4-hand circles once\naround flat palm\n(clock motion)",
    "5 hours": "5-hand circles once\naround flat palm\n(clock motion)",
    "6 hours": "6-hand circles once\naround flat palm\n(clock motion)",
    "7 hours": "7-hand circles once\naround flat palm\n(clock motion)",
    "8 hours": "8-hand circles once\naround flat palm\n(clock motion)",
    "9 hours": "9-hand circles once\naround flat palm\n(clock motion)",
    "10 hours": "10-hand circles once\naround flat palm\n(clock motion)",
    "12 hours": "1-2 hand circles\naround flat palm\n(clock motion)",
    "24 hours": "Flat hand circles\nfully around fist\n(full day rotation)",
    "how many minutes": "WH-face + how-many\n+ minute sign\n(Eyebrows down)",
    "how many hours": "WH-face + how-many\n+ hour sign\n(Eyebrows down)",
    # Time - frequency
    "always / constantly": "Index finger circles\ncontinuously forward\n(ongoing motion)",
    "never": "Flat hand traces\nquestion mark in air\nthen drops away",
    "sometimes": "Index finger taps\nflat palm slowly\n2-3 times (occasional)",
    "in the future": "Flat hand moves\nforward from cheek\n(ahead in time)",
    # Transport
    "drive": "Both hands grip\nimaginary steering\nwheel and turn",
    "bike": "S-hands pedal\nin circles\n(like feet on pedals)",
    "motorcycle": "Both hands grip\nhandlebars, twist\nthrottle motion",
    "bus": "Both hands pull\nimaginary cord\n(like bus bell pull)",
    "train": "H-fingers slide\nalong back of\nother H-hand",
    "to ride in": "Bent fingers hook\ninto C-hand\n(seated in vehicle)",
    "to go someplace": "Index finger points\nforward and moves\naway from body",
    "to come here": "Index fingers curl\ntoward body\n(beckoning motion)",
    # Relationships
    "to become pregnant / conceive a child": "Fingers interlock\nat belly level\n(conception)",
    "to be pregnant": "5-hand moves\noutward from belly\n(showing belly growth)",
    "to give birth to a child": "Both hands move\ndown and outward\nfrom belly area",
    "to fall in love": "Both hands on chest\nthen point forward\n(heart to person)",
    "to go out on a date": "D-hands come\ntogether and move\nforward (going out)",
    "to exclusively date one person": "1-hands face each\nother, move together\n(exclusive pair)",
    "boyfriend": "Boy sign (forehead)\n+ friend sign\n(clasp hands)",
    "girlfriend": "Girl sign (chin)\n+ friend sign\n(clasp hands)",
    "propose marriage": "Open hand kneels\nonto flat palm\n(kneeling gesture)",
    "engaged": "E-hand circles then\nlands on ring finger\n(ring placement)",
    "to wed or marry": "Clasp both hands\ntogether firmly\n(joining hands)",
    # Family extended
    "twins": "T-hand touches\nchin then moves\nto other side",
    "sister": "A-hand from chin\ndown to other hand\n(girl + same)",
    "brother": "A-hand from forehead\ndown to other hand\n(boy + same)",
    "siblings / brother & sister": "Brother sign +\nsister sign\n(compound)",
    "parents / mom & dad": "Mom sign + dad sign\n(chin then forehead)\n(compound)",
    "male / boy": "Flat hand at\nforehead grasps\nimaginary cap brim",
    "female / girl": "Thumb traces\ndown jawline\n(bonnet string)",
    "older / first born among siblings": "Index rises from\nfist upward\n(first/oldest)",
    "youngest / last / the last born among siblings": "Pinky drops down\nfrom fist\n(last/youngest)",
    "the two of you": "Point forward +\n2-hand between\ntwo people",
    "the two of us": "Point to self +\n2-hand between\nself and other",
    "to be close / to have a strong bond": "Both bent hands\nheld tight together\nclose to chest",
    "interesting / fascinating": "Both 5-hands pull\nout from chest\n(drawing you in)",
    # Age ranges
    "less than one year old": "Baby sign (rock arms)\n+ under + 1 + year\n(compound phrase)",
    "1-5 years old": "Show number (1-5)\n+ years-old sign\n(number + fist drops)",
    "6-9 years old": "Show number (6-9)\n+ years-old sign\n(number + fist drops)",
    "10 years old": "A-hand wiggles\n+ years-old sign\n(10 + fist drops)",
    "11-15 years old": "Show number (11-15)\n+ years-old sign\n(number + fist drops)",
    "16-19 years old": "Show number (16-19)\n+ years-old sign\n(number + fist drops)",
    "20 years old and older": "20-sign + years-old\n+ more/older sign\n(G-pinch + fist + up)",
    # Misc new words
    "copy me": "5-hand pulls toward\ncurled hand\n(copying/mimicking)",
    "same": "Y-hand moves\nback and forth\nbetween two points",
    "different": "Crossed index fingers\npull apart\n(separating)",
    "again": "Bent hand arcs\ninto flat palm\n(repeat motion)",
    "remember": "Thumb from forehead\ntouches other thumb\n(know + continue)",
    "forget": "Flat hand wipes\nacross forehead\nand drops away",
    "nice to meet you": "Nice sign + meet\n(flat hands come\ntogether pointing up)",
    "person / individual": "P-hands slide\ndown sides of body\n(outlining person)",
    "hair": "Pinch strand of\nhair with thumb\nand index finger",
    "mustache": "Pinch fingers trace\nline above upper lip\n(drawing mustache)",
    "beard": "5-hand grasps chin\nand pulls down\n(showing beard)",
    "turn around": "Index finger draws\ncircle in air\n(rotation gesture)",
    "open door": "B-hands pivot open\nlike a door swinging\n(hinge motion)",
    "close door": "B-hands pivot shut\nlike door closing\n(hinge motion)",
    "window open": "B-hand slides up\nfrom other B-hand\n(opening window)",
    "window close": "B-hand slides down\nonto other B-hand\n(closing window)",
    "light on": "Flat-O opens to\n5-hand under chin\n(light appears)",
    "light off": "5-hand closes to\nflat-O under chin\n(light disappears)",
    "book open": "Flat hands open\nlike a book\n(palms up, apart)",
    "book close": "Flat hands close\nlike shutting book\n(palms together)",
    "book read": "V-hand scans across\nflat palm (eyes\nreading a page)",
    "paper fold": "Flat hands fold\nover each other\n(folding paper)",
    "paper crumble": "Both hands crush\nimaginary paper\ninto a ball",
    "paper throw": "S-hand opens and\nmoves forward\n(tossing away)",
    "paper look at": "V-hand (eyes) looks\ndown at flat palm\n(examining paper)",
    "chair there you sit": "C-hand sits on\nflat hand + point\n(sit there)",
    "jot-down": "Modified write sign\nquick small motion\n(quick note)",
    "right/correct": "Both 1-hands stack\nhorizontally\n(right/correct)",
    "wrong": "Y-hand hits chin\nfingers toward you\n(wrong/mistake)",
    "oh i see": "Index taps near\neye then nods\n(understanding)",
    "start": "1-hand twists in\nother V-hand\n(turning key)",
    "head": "Bent hand touches\ntemple then chin\n(top of head)",
    "tail": "1-hand behind back\nwags like a tail\n(animal tail)",
    "win": "S-hand grabs from\nother fist upward\n(seizing victory)",
    "lose": "V-hand drops onto\nflat palm\n(dropping/loss)",
    "equal": "Bent hands tap\ntogether twice\n(parallel/equal)",
    "which": "A-hands alternate\nup and down\n(weighing options)",
    "remember most": "Remember sign with\nstrong emphasis\n(firm hold)",
    "remember some": "Remember sign\nnormal motion\n(moderate hold)",
    "remember a little bit": "Remember sign\nsmall/weak motion\n(slight hold)",
    "forget all": "Wipe forehead sign\nwith emphasis\n(complete wipe)",
    "still speak": "Keep-sign + speak\n(ongoing motion\n+ index from chin)",
    "grow up": "Flat hand rises\nfrom waist up\n(growing taller)",
    "both": "V-hand draws down\ninto flat hand\n(two together)",
    "high school": "H-S fingerspell\nor school sign +\nhigh (elevated)",
    "easy": "Curved hand brushes\nup other fingers\nrepeatedly (smooth)",
    "sort of easy": "Easy sign with\nso-so face/motion\n(somewhat easy)",
    "sort of hard": "Hard sign with\nso-so face/motion\n(somewhat hard)",
    "hard": "Bent-V hands clash\nknuckles together\n(difficulty)",
    "live / to reside": "L-hands move up\nchest (living in\na place)",
    "close by/in proximity": "Both flat hands\nnear each other\n(closeness)",
    "over there / in that direction": "Point index finger\nin direction\n(indicating place)",
    "here / in this area": "Both flat hands\ncircle in front\n(this area/here)",
    "food room / food court": "Flat-O at mouth\n+ room sign\n(eat + room)",
    "soda machine": "Middle finger flicks\noff palm + machine\n(soda + box motion)",
    "food machine": "Flat-O at mouth\n+ machine sign\n(food + box motion)",
    "candy machine": "Index twists on\ncheek + machine\n(candy + box motion)",
    "on the right side": "R-hand moves right\n(indicating right)\nPalm facing out",
    "on the left side": "L-hand moves left\n(indicating left)\nPalm facing out",
    "over there near": "Point + near sign\n(over there + flat\nhands close)",
    "exit / go out": "5-hand pulls out\nof C-hand\n(leaving/exiting)",
    "live alone": "L-hands up chest\n+ alone sign\n(1-hand circles)",
    "live with": "L-hands up chest\n+ with sign\n(A-hands together)",
    "have": "Bent hands touch\nchest (possessing)\nPalm faces in",
    "none": "O-hands move\noutward (nothing)\nHead shakes",
    "need": "X-hand bends down\nrepeatedly\n(nodding X motion)",
    "money": "Flat hand taps\nother palm twice\n(bills in hand)",
    "practice": "A-hand rubs back\nand forth on\nindex finger",
    "wash hands": "Rub hands together\nas if washing\n(scrubbing motion)",
    "patience": "A-hand thumb drags\ndown chin slowly\n(patient/wait)",
    "hurry": "H-hands shake up\nand down rapidly\n(urgency)",
    "i second": "I-hand (pinky up)\n+ 2nd sign\n(I agree)",
    "to desire something / want": "Both 5-hands pull\ntoward body\n(claw/desire)",
    "to not desire something / don't want": "5-hands push away\nwith head shake\n(rejection)",
    "perhaps / a possibility of": "Both flat hands\nalternate up/down\n(weighing maybe)",
    "no": "Index + middle finger\nsnap to thumb\n(quick close)",
    "not": "A-hand thumb under\nchin moves forward\n(negation)",
    "like": "Middle finger + thumb\npull from chest\n(drawing out liking)",
    "want": "Both 5-hands claw\npull toward body\n(desire/want)",
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
