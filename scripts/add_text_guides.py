#!/usr/bin/env python3
"""
Add textGuide descriptions for ALL words in words.json.
This ensures every card shows a hand position / signing guide.
"""

import json
from pathlib import Path

PROJECT_DIR = Path(__file__).parent.parent
WORDS_JSON = PROJECT_DIR / "data" / "words.json"

# Fingerspelling descriptions
FINGERSPELL_GUIDES = {
    "A": "Fist with thumb\nresting on the side\nPalm facing out",
    "B": "Four fingers straight up\ntogether, thumb tucked\nacross palm",
    "C": "Curved hand like\nholding a cup\nThumb and fingers apart",
    "D": "Index up, other fingers\ncurved to touch thumb\nMaking a circle below",
    "E": "All fingertips curled\ndown to touch thumb\nPalm facing out",
    "F": "Index + thumb form circle\nother 3 fingers straight up\nPalm facing out",
    "G": "Index + thumb point\nsideways, parallel\nOther fingers closed",
    "H": "Index + middle finger\npoint sideways together\nOther fingers closed",
    "I": "Pinky finger up\nother fingers in fist\nPalm facing out",
    "J": "Pinky up, trace\na J-shape in air\nPalm facing out",
    "K": "Index + middle up,\nthumb between them\nPalm facing out",
    "L": "L-shape: thumb out,\nindex up at 90°\nOther fingers closed",
    "M": "Three fingers drape\nover thumb, tucked\nPalm facing down",
    "N": "Two fingers drape\nover thumb, tucked\nPalm facing down",
    "O": "All fingers curved\nto meet thumb tip\nForming an O shape",
    "P": "Like K but tilted\ndown, middle finger\npoints to floor",
    "Q": "Like G but tilted\ndown, index + thumb\npoint to floor",
    "R": "Index + middle crossed\nother fingers closed\nPalm facing out",
    "S": "Fist with thumb\ncrossed over fingers\nPalm facing out",
    "T": "Thumb tucked between\nindex + middle finger\nFist shape",
    "U": "Index + middle together\npointing up, apart from\nother closed fingers",
    "V": "Index + middle spread\napart (peace/victory)\nOther fingers closed",
    "W": "Index + middle + ring\nspread apart, pointing up\nThumb holds pinky",
    "X": "Index finger hooked/\nbent at knuckle\nOther fingers closed",
    "Y": "Thumb + pinky out\nother fingers closed\n(Hang loose shape)",
    "Z": "Index finger draws\na Z-shape in air\nPalm facing out",
}

# Numbers 67-100 descriptions (building on the pattern)
NUMBER_GUIDES_HIGH = {}
for n in range(67, 100):
    tens = n // 10
    ones = n % 10
    tens_word = {6: "6", 7: "7", 8: "8", 9: "9"}[tens]
    if ones == 0:
        NUMBER_GUIDES_HIGH[n] = f"{tens_word}-hand + closed hand\nPinch fingers together\nTwo-part sign (x0)"
    else:
        ones_word = str(ones)
        NUMBER_GUIDES_HIGH[n] = f"{tens_word}-hand → {ones_word}-hand\nSmooth transition\nPalm facing out"

NUMBER_GUIDES_HIGH[100] = "1-hand + C-hands\nform hundred\n(1 + Roman numeral C)"

# Common word ASL descriptions
COMMON_GUIDES = {
    "fingerspelling a - z": "Full alphabet chart\nPractice each letter\nA through Z hand shapes",
    "numbers 1 - 100": "Number chart reference\nSee individual numbers\nfor hand positions",
    "what": "Both hands palms up\nshake side to side\n(WH-face: eyebrows down)",
    "who": "Thumb on chin,\nindex finger wiggles\n(WH-face: eyebrows down)",
    "where": "Index finger wags\nside to side\n(WH-face: eyebrows down)",
    "name": "H-fingers tap on\nother H-fingers\n(crossing twice)",
    "letter": "Thumb taps on\npalm of other hand\n(stamping motion)",
    "shape": "Both A-hands draw\nan outline in air\nmoving downward",
    "fingerspell": "Wiggle all 5 fingers\nwhile moving hand\nright to left",
    "homework": "Flat hand on cheek\n(home) + fist on\nother palm (work)",
    "woman": "Thumb traces chin\nthen opens to flat\nhand at chest",
    "shirt": "Pinch shirt fabric\nat chest with thumb\nand index finger",
    "pants": "Both hands pat\nupper thighs\n(showing pant legs)",
    "jacket": "Both A-hands trace\nlapels downward\nfrom shoulders to waist",
    "dress": "Both 5-hands brush\ndown chest/torso\n(showing dress shape)",
    "skirt": "Both 5-hands brush\ndown from waist\n(showing skirt hem)",
    "shoes": "Both S-hands tap\ntogether twice\n(clicking heels)",
    "glasses": "Thumb + index pinch\nnear each eye\n(tracing glasses frame)",
    "clothes": "Both 5-hands brush\ndown chest twice\n(showing clothing)",
    "black": "Index finger draws\nacross forehead\n(eyebrow line)",
    "grey": "Both 5-hands mesh\nfingers back and forth\n(mixing black + white)",
    "white": "5-hand on chest\npulls out closing\nto flat-O (pure)",
    "pink": "Middle finger strokes\ndown chin (P + red\ncombination)",
    "orange": "S-hand squeezes\nat chin repeatedly\n(squeezing orange)",
    "yellow": "Y-hand shakes\ntwisted at wrist\n(Y for yellow)",
    "green": "G-hand shakes\ntwisted at wrist\n(G for green)",
    "blue": "B-hand shakes\ntwisted at wrist\n(B for blue)",
    "purple": "P-hand shakes\ntwisted at wrist\n(P for purple)",
    "brown": "B-hand slides down\ncheek (index side)\nPalm facing out",
    "colors": "5-hand wiggles\nfingers at chin\n(showing variety)",
    "stand": "V-hand (legs) stands\non flat palm\n(person standing)",
    "jump": "V-hand (legs) springs\nup from flat palm\n(person jumping)",
    "dance": "V-hand swings side\nto side over palm\n(legs dancing)",
    "draw": "Pinky traces wavy\nline down flat palm\n(drawing/sketching)",
    "write": "Pinch (pen grip)\nscribbles on flat palm\n(writing motion)",
    "asl": "Fingerspell A-S-L\nquickly\n(American Sign Language)",
    "class": "C-hands face each\nother, circle forward\nthen apart (group)",
    "college": "Like clapping but\nfirst clap then circle\nupward (higher ed)",
    "deaf": "Index touches ear\nthen corner of mouth\n(ear + mouth closed)",
    "english": "Both curved hands\nlock together and pull\n(England/linked)",
    "french": "F-hand flicks outward\nwith wrist twist\nPalm facing out",
    "gallaudet": "G-hand touches near\neye then moves out\n(vision/glasses ref)",
    "hearing": "Index circles outward\nfrom mouth area\n(sound coming out)",
    "language": "Both L-hands wiggle\napart from center\n(tongues wagging)",
    "learn": "Grab knowledge from\nflat palm, pull to\nforehead (absorbing)",
    "spanish": "Both bent hands at\nshoulders, interlock\nfingers (traditional)",
    "student": "Learn sign + person\nmarker (flat hands\nslide down sides)",
    "teach": "Both flat-O hands\nat temples push out\ntwice (giving knowledge)",
    "teacher": "Teach sign + person\nmarker (flat hands\nslide down sides)",
    "yes": "S-hand nods up\nand down like a\nnodding head",
    "sign": "Both index fingers\ncircle alternately\n(hands moving/signing)",
    "fine": "5-hand, thumb on\nchest, moves out\n(feeling good)",
    "sick": "Middle finger on\nforehead + middle on\nstomach (feeling ill)",
    "how are you?": "Both bent hands\npoint out, move up\n+ point at person",
    "walk": "Both flat hands\nalternate forward\n(feet walking)",
    "take a picture": "C-hand at eye closes\nto S-hand (clicking\ncamera shutter)",
    "watch": "V-hand (eyes) points\nforward from face\n(watching/looking)",
    "play with a dog": "Both flat hands pat\nthigh (calling dog)\nthen play gesture",
    "chat on the phone": "Y-hand at ear\n(phone) + chat sign\n(back-and-forth)",
    "fishing": "Both hands grip\nimaginary rod, reel\nin with winding motion",
    "run": "L-hands, index hooks\nother thumb, wiggle\n(fast leg movement)",
    "travel": "Bent V-hand moves\nin winding path\n(journey/traveling)",
    "paint": "Flat hand (brush)\nstrokes up and down\non other flat palm",
    "camping": "Both V-hands form\ntent peak, then move\napart (pitching tent)",
    "exercise": "Both S-hands at\nshoulders push up\nrepeatedly (lifting)",
    "play": "Both Y-hands shake\nside to side\n(playful motion)",
    "shop": "Flat hand swipes\nout from other palm\ntwice (spending money)",
    "bicycling": "Both S-hands pedal\nin circles forward\n(riding bicycle)",
    "bowling": "Curved hand swings\nforward and releases\n(bowling ball roll)",
    "movie": "5-hand shakes behind\nother flat palm\n(flickering projector)",
    "game": "Both A-hands, thumbs\nup, tap together\ntwice (competition)",
    "favorite": "Middle finger taps\nchin twice\n(preference/favorite)",
    "pay attention": "Both flat hands at\ntemples move forward\n(directing focus)",
    "chat": "Both 5-hands alternate\nmoving near mouth\n(conversation)",
    "sleep": "5-hand pulls down\nface closing to flat-O\n(eyes closing)",
    "apple": "X-hand knuckle twists\non cheek\n(apple on cheek)",
    "eat": "Flat-O taps mouth\nrepeatedly\n(putting food in mouth)",
    "music": "Flat hand sweeps\nback and forth over\nother forearm (rhythm)",
    "listen": "Cup hand to ear\n(amplifying sound)\nLeaning slightly",
    "computer": "C-hand taps up\nforearm twice\n(tech/computing)",
    "type": "All fingers wiggle\ndownward (typing on\nimaginary keyboard)",
    "look at the time": "Index taps wrist\n(where watch goes)\nEyebrows raised",
    "tie shoes": "Both hands mime\ntying laces in a\nbow at waist level",
    "drink": "C-hand tilts to\nmouth (cup drinking)\nThumb side up",
    "coffee": "S-hand circles on\ntop of other S-hand\n(grinding coffee)",
    "tea": "F-hand dips into\nO-hand (tea bag in\ncup motion)",
    "milk": "S-hand squeezes\nopen and shut\n(milking motion)",
    "orange juice": "C-hand squeezes at\nchin (orange) + pour\ndrink motion",
    "hot chocolate": "C-hand circles on\nback of other hand\n(warming) + H-O-T",
    "san francisco": "Fingerspell S-F\nor sign with\ninitials quickly",
    "oakland": "Fingerspell O-A-K\nor O-hand at\nchin area",
    "berkeley": "Fingerspell B-E-R-K\nor B-hand twist\nnear shoulder",
    "fremont": "Fingerspell F-R-E\nor F-hand tap\non other hand",
    "city": "Both bent hands tap\nfingertips together\nrotating (rooftops)",
    "house": "Both flat hands form\ntriangle roof then\ndrop to walls shape",
    "mountain": "Both S-hands tap\nthen open hands rise\nshowing peak shape",
    "shopping mall": "Both flat hands swipe\nout from palm + roof\nshape (shop + place)",
    "south": "S-hand moves down\n(directional south)\nPalm facing in",
    "west": "W-hand moves left\n(directional west)\nPalm facing out",
    "east": "E-hand moves right\n(directional east)\nPalm facing out",
    "floor": "Both B-hands slide\napart horizontally\n(flat surface)",
    "table": "Both flat forearms\nstack, top arm pats\nbottom (table top)",
    "tv": "Fingerspell T-V\nquickly\n(television)",
    "box": "Both flat hands form\nbox shape, showing\nsides and front",
    "cup": "C-hand sits on flat\npalm (cup on table)\nThen lifts to drink",
    "backpack": "Both A-hands at\nshoulders pull straps\ndown (wearing pack)",
    "photo": "C-hand from face\nlands on flat palm\n(capturing image)",
    "phone": "Y-hand at ear\n(thumb to ear,\npinky to mouth)",
    "candy / sweets": "Index finger twists\non cheek below eye\n(sweet taste)",
    "apartment": "A-hand + box shape\n(A + flat hands\nform room)",
    "dorm": "D-hand + room shape\n(D + flat hands\nform room walls)",
    "large": "Both L-hands spread\nwide apart\n(indicating big size)",
    "medium large": "L-hands spread\nmoderately wide\n(between medium-large)",
    "small medium": "Flat hands close\ntogether moderately\n(between small-medium)",
    "small": "Both flat hands\nclose together\n(indicating small)",
    "new": "Curved hand scoops\nacross other palm\n(something new/fresh)",
    "color": "5-hand wiggles at\nchin (like colors\nbut singular)",
    "classroom": "C-hands circle + room\nshape (class + room\ncombination)",
    "front": "Flat hand drops\ndown in front of\nface (in front of)",
    "library": "L-hand circles in\nair (L for library)\nPalm facing out",
    "store": "Both flat-O hands\nflick outward from\nchest twice (selling)",
    "enter": "Flat hand slides\nunder other hand\n(going in/entering)",
    "upstairs": "Index points up +\nstep motion upward\n(going up stairs)",
    "downstairs": "Index points down +\nstep motion downward\n(going down stairs)",
    "elevator": "E-hand rides up on\nother palm (going\nup/down vertically)",
    "thank you": "Flat hand from chin\nmoves forward and\ndown (gratitude)",
    "please": "Flat hand circles\non chest\n(please/enjoy)",
    "your": "Flat palm pushes\ntoward person\n(directing to you)",
    "grandma": "Open 5-hand at chin\nhops forward twice\n(mom + generations)",
    "middle": "Bent hand circles\nthen drops into\ncenter of palm",
    "medium": "Flat hand at mid\nheight, wavers\n(showing middle size)",
    "cabinet": "Both B-hands open\nand close like doors\n(cabinet doors)",
    "boots": "Both S-hands show\ntall shape up from\nfeet (tall shoes)",
    "lunch": "L-hand at elbow\n(noon) + eat sign\n(midday meal)",
    "later": "L-hand (index up,\nthumb out) tilts\nforward (future/later)",
    "mother": "5-hand, thumb taps\nchin twice\n(female + parent)",
    "father": "5-hand, thumb taps\nforehead twice\n(male + parent)",
    "daughter": "Girl sign (chin) +\nbaby rocking motion\n(female child)",
    "husband": "Male sign (forehead)\n+ hands clasp\n(man + marriage)",
    "wife": "Female sign (chin)\n+ hands clasp\n(woman + marriage)",
    "children": "Both flat hands pat\ndownward in air\n(showing short height)",
    "family": "Both F-hands circle\nforward and meet\n(F + group together)",
    "boy friend": "Boy sign + friend\nsign (forehead tap\n+ clasped hands)",
    "girl friend": "Girl sign + friend\nsign (chin stroke\n+ clasped hands)",
    "roommate": "Room sign + same/\ntogether sign\n(sharing space)",
    "cat": "F-hand at cheek\npulls outward (cat\nwhiskers motion)",
    "dog": "Pat thigh + snap\nfingers (calling\na dog)",
    "bird": "G-hand at mouth\nopens and closes\n(beak motion)",
    "fish": "Flat hand wiggles\nforward (fish\nswimming through water)",
    "turtle": "A-hand under other\ncurved hand, thumb\nwiggles (head peeking)",
    "rat": "R-hand brushes across\nnose twice\n(whiskers/sniffing)",
    "rabbit": "Both H-hands at head\nflap up and down\n(bunny ears)",
    "people": "Both P-hands circle\nalternately forward\n(many persons)",
    "pet": "One hand strokes\nback of other hand\n(petting animal)",
    "buy": "Hand takes from flat\npalm and moves out\n(giving money away)",
    "home": "Flat-O touches cheek\nnear mouth then\nnear ear (eat+sleep)",
    "work": "Both S-hands, dominant\ntaps on other wrist\ntwice (working)",
    "6th": "6-hand + ordinal twist\n(pinky+thumb touch,\nflick downward)",
    "7th": "7-hand + ordinal twist\n(ring+thumb touch,\nflick downward)",
    "8th": "8-hand + ordinal twist\n(middle+thumb touch,\nflick downward)",
}


def main():
    words = json.loads(WORDS_JSON.read_text(encoding='utf-8'))

    updated = 0
    for w in words:
        word = w['word']
        slug = w['slug']
        category = w.get('category', '')

        # Skip if already has guide
        if w.get('textGuide'):
            continue

        guide = None

        # Fingerspelling
        if word.startswith("Fingerspell ") and len(word.split()) == 2:
            letter = word.split()[-1].upper()
            guide = FINGERSPELL_GUIDES.get(letter)

        # High numbers 67-100
        elif category == 'numbers' and word.strip().isdigit():
            num = int(word.strip())
            guide = NUMBER_GUIDES_HIGH.get(num)

        # Lookup in common guides
        if not guide:
            lookup = word.lower().strip()
            if lookup in COMMON_GUIDES:
                guide = COMMON_GUIDES[lookup]

        if guide:
            w['textGuide'] = guide
            updated += 1

    WORDS_JSON.write_text(json.dumps(words, indent=2, ensure_ascii=False), encoding='utf-8')
    
    still_missing = sum(1 for w in words if not w.get('textGuide'))
    print(f"Added textGuide to {updated} more words")
    print(f"Still missing: {still_missing} out of {len(words)}")
    if still_missing > 0:
        missing = [w['word'] for w in words if not w.get('textGuide')]
        print("Remaining without guide:")
        for m in missing:
            print(f"  {m}")


if __name__ == "__main__":
    main()
