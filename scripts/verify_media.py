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
NUMBER_COMPILATION_VIDEO_ID = "M4AFC4eEjlQ"
EXPECTED_SYLLABUS_UNITS = {1, 2, 3, 4, 5, 6}


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
    catalog_failures = []
    syllabus_units = set()
    for word in words:
        media = word.get("media", {})
        word_units = word.get("syllabusUnits", [])
        if word_units != sorted(set(word_units)):
            catalog_failures.append(
                f"{word['slug']}: syllabus units must be sorted and unique"
            )
        if any(unit not in EXPECTED_SYLLABUS_UNITS for unit in word_units):
            catalog_failures.append(
                f"{word['slug']}: invalid syllabus unit"
            )
        syllabus_units.update(word_units)

        if (
            word.get("category") == "numbers"
            and word.get("slug") != "numbers-1-100"
            and media.get("videoId") == NUMBER_COMPILATION_VIDEO_ID
        ):
            catalog_failures.append(
                f"{word['slug']}: individual number uses the 1-100 compilation"
            )

        for media_field in ("media", "syllabusMedia"):
            reviewed_media = word.get(media_field, {})
            if reviewed_media.get("reviewed") is not True:
                continue
            if reviewed_media.get("type") == "youtube":
                video_id = reviewed_media.get("videoId", "")
                cards_by_video.setdefault(video_id, []).append(word["slug"])
                start = reviewed_media.get("startSeconds")
                end = reviewed_media.get("endSeconds")
                if (start is None) != (end is None):
                    catalog_failures.append(
                        f"{word['slug']}: incomplete video segment"
                    )
                elif start is not None and (
                    not isinstance(start, (int, float))
                    or not isinstance(end, (int, float))
                    or start < 0
                    or end <= start
                    or end - start > 15
                ):
                    catalog_failures.append(
                        f"{word['slug']}: invalid video segment {start}-{end}"
                    )
                if video_id not in reviewed_media.get("sourceUrl", ""):
                    catalog_failures.append(
                        f"{word['slug']}: source URL does not match video"
                    )
            elif reviewed_media.get("type") == "image":
                image_sources[word["slug"]] = (
                    reviewed_media["sourceUrl"],
                    reviewed_media["src"],
                )

    if syllabus_units != EXPECTED_SYLLABUS_UNITS:
        catalog_failures.append(
            "syllabus unit coverage is incomplete: "
            + ", ".join(map(str, sorted(syllabus_units)))
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

    for failure in catalog_failures:
        print(f"FAILED {failure}")

    raise SystemExit(
        1 if failures or image_failures or catalog_failures else 0
    )


if __name__ == "__main__":
    main()
