#!/usr/bin/env python3
"""Verify that every reviewed YouTube source still permits embedding."""

import json
import hashlib
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


PROJECT_DIR = Path(__file__).parent.parent
WORDS_JSON = PROJECT_DIR / "data" / "words.json"


def verify(video_id):
    watch_url = f"https://www.youtube.com/watch?v={video_id}"
    oembed_url = (
        "https://www.youtube.com/oembed?format=json&url="
        + urllib.parse.quote(watch_url, safe="")
    )
    request = urllib.request.Request(
        oembed_url,
        headers={"User-Agent": "SignSpark media verifier"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            metadata = json.load(response)
        valid = (
            response.status == 200
            and metadata.get("provider_name") == "YouTube"
            and "<iframe" in metadata.get("html", "")
        )
        return valid, metadata.get("title", ""), ""
    except Exception as error:
        return False, "", str(error)

def verify_image(source_url, local_path):
    request = urllib.request.Request(
        source_url,
        headers={"User-Agent": "SignSpark media verifier"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            source_bytes = response.read()
        local_bytes = (PROJECT_DIR / local_path).read_bytes()
        return (
            response.status == 200
            and hashlib.sha256(source_bytes).digest()
            == hashlib.sha256(local_bytes).digest()
        ), ""
    except Exception as error:
        return False, str(error)


def main():
    words = json.loads(WORDS_JSON.read_text(encoding="utf-8"))
    cards_by_video = {}
    image_sources = {}
    for word in words:
        media = word.get("media", {})
        if media.get("type") == "youtube" and media.get("reviewed") is True:
            cards_by_video.setdefault(media["videoId"], []).append(word["slug"])
        elif media.get("type") == "image" and media.get("reviewed") is True:
            image_sources[word["slug"]] = (
                media["sourceUrl"],
                media["src"],
            )

    failures = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        pending = {
            executor.submit(verify, video_id): video_id
            for video_id in cards_by_video
        }
        for future in as_completed(pending):
            video_id = pending[future]
            valid, title, error = future.result()
            if not valid:
                failures.append((video_id, cards_by_video[video_id], error))
            elif not title:
                failures.append(
                    (video_id, cards_by_video[video_id], "Missing video title")
                )

    print(
        f"Verified {len(cards_by_video) - len(failures)} of "
        f"{len(cards_by_video)} unique YouTube videos"
    )
    for video_id, slugs, error in failures:
        print(f"FAILED {video_id} ({', '.join(slugs)}): {error}")

    image_failures = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        pending = {
            executor.submit(verify_image, source_url, local_path): slug
            for slug, (source_url, local_path) in image_sources.items()
        }
        for future in as_completed(pending):
            slug = pending[future]
            valid, error = future.result()
            if not valid:
                image_failures.append((slug, error))

    print(
        f"Verified {len(image_sources) - len(image_failures)} of "
        f"{len(image_sources)} reviewed local images"
    )
    for slug, error in image_failures:
        print(f"FAILED {slug}: {error}")

    raise SystemExit(1 if failures or image_failures else 0)


if __name__ == "__main__":
    main()
