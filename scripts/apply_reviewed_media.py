#!/usr/bin/env python3
"""
Apply a reviewed YouTube mapping to words.json.

The mapping must be an object keyed by card slug. Each value requires a
videoId and title. Only mappings produced through the offline review process
should be applied.
"""

import argparse
import json
import re
from pathlib import Path


PROJECT_DIR = Path(__file__).parent.parent
WORDS_JSON = PROJECT_DIR / "data" / "words.json"
YOUTUBE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{11}$")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("mapping", type=Path)
    parser.add_argument(
        "--words",
        type=Path,
        default=WORDS_JSON,
        help="Vocabulary JSON to update (defaults to data/words.json).",
    )
    parser.add_argument(
        "--disable-all-legacy",
        action="store_true",
        help="Stop displaying every unreviewed legacy image.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    words = json.loads(args.words.read_text(encoding="utf-8"))
    mapping = json.loads(args.mapping.read_text(encoding="utf-8"))

    words_by_slug = {word["slug"]: word for word in words}
    unknown_slugs = sorted(set(mapping) - set(words_by_slug))
    if unknown_slugs:
        raise ValueError(f"Unknown card slugs: {', '.join(unknown_slugs)}")

    applied = 0
    for slug, reviewed in mapping.items():
        if reviewed is None:
            continue

        title = reviewed.get("title", "")
        if not title:
            raise ValueError(f"Missing reviewed title for {slug}")

        word = words_by_slug[slug]
        media_type = reviewed.get("type", "youtube")
        if media_type == "youtube":
            video_id = reviewed.get("videoId", "")
            if not YOUTUBE_ID_PATTERN.fullmatch(video_id):
                raise ValueError(
                    f"Invalid YouTube ID for {slug}: {video_id!r}"
                )
            word["media"] = {
                "type": "youtube",
                "videoId": video_id,
                "sourceName": reviewed.get("sourceName", "Signs (@aslu)"),
                "sourceUrl": reviewed.get(
                    "sourceUrl",
                    f"https://www.youtube.com/watch?v={video_id}",
                ),
                "sourceTitle": title,
                "reviewed": True,
            }
        elif media_type == "image":
            source_path = reviewed.get("src", "")
            source_url = reviewed.get("sourceUrl", "")
            if not source_path or not source_url:
                raise ValueError(
                    f"Missing image path or source URL for {slug}"
                )
            word["media"] = {
                "type": "image",
                "src": source_path,
                "sourceName": reviewed.get("sourceName", "Lifeprint"),
                "sourceUrl": source_url,
                "sourceTitle": title,
                "reviewed": True,
            }
        else:
            raise ValueError(f"Unsupported media type for {slug}: {media_type}")

        word["legacyMediaDisabled"] = True
        applied += 1

    for word in words:
        if args.disable_all_legacy:
            word["legacyMediaDisabled"] = True
            if word.get("media", {}).get("reviewed") is True:
                word.pop("mediaReviewStatus", None)
            else:
                word["mediaReviewStatus"] = "no-verified-source"
        if word.get("textGuideReviewed") is not True:
            word.pop("textGuide", None)

    with args.words.open("w", encoding="utf-8", newline="\n") as output:
        output.write(json.dumps(words, indent=2, ensure_ascii=False) + "\n")
    print(f"Applied {applied} reviewed media mappings")


if __name__ == "__main__":
    main()
