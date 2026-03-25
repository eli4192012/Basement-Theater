import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOCX_PATH = ROOT / "The Basement Theater Sorter.docx"
OUTPUT_PATH = ROOT / "api" / "_lib" / "private" / "catalog.json"

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
}

SEPARATOR_RE = re.compile(r"^[~\-_=\s]{8,}$")
YEAR_RE = re.compile(r"\b(19\d{2}|20\d{2})\b")
NOISE_RE = re.compile(
    r"\b(1080p|720p|480p|360p|HDRip|BluRay|WEBRip|DVDRIPPED|HD|CAM|x264|x265|AAC|HEVC|Netflix Ripped|full movie)\b",
    re.IGNORECASE,
)


def load_paragraphs():
    with zipfile.ZipFile(DOCX_PATH) as archive:
        document = ET.fromstring(archive.read("word/document.xml"))
        relationships = ET.fromstring(archive.read("word/_rels/document.xml.rels"))

    rel_map = {}
    for rel in relationships.findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
        rel_id = rel.attrib.get("Id")
        target = rel.attrib.get("Target")
        if rel_id and target:
            rel_map[rel_id] = target

    paragraphs = []
    for paragraph in document.findall(".//w:p", NS):
        links = []
        text_parts = []

        for child in paragraph:
            tag_name = child.tag.split("}")[-1]
            if tag_name == "hyperlink":
                rel_id = child.attrib.get(f"{{{NS['r']}}}id")
                link_text = "".join(node.text or "" for node in child.findall(".//w:t", NS)).strip()
                if link_text:
                    text_parts.append(link_text)
                if rel_id and rel_id in rel_map:
                    links.append({"text": link_text, "url": rel_map[rel_id]})
            else:
                plain_text = "".join(node.text or "" for node in child.findall(".//w:t", NS)).strip()
                if plain_text:
                    text_parts.append(plain_text)

        full_text = re.sub(r"\s+", " ", " ".join(text_parts)).strip()
        if full_text or links:
            paragraphs.append({"text": full_text, "links": links})

    return paragraphs


def is_heading(text):
    stripped = text.strip()
    if not stripped or SEPARATOR_RE.match(stripped):
        return False
    if len(stripped) > 40:
        return False
    if re.search(r"https?://", stripped):
        return False
    if YEAR_RE.search(stripped):
        return False
    if any(char.isdigit() for char in stripped[:2]):
        return False
    return True


def maybe_fix_mojibake(text):
    if "Ã°" not in text and "Ã¢" not in text:
        return text
    try:
        return text.encode("cp1252").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text


def normalize_title(text):
    text = maybe_fix_mojibake(text)
    title = Path(text).stem
    title = title.replace("_", " ").replace(".", " ")
    title = re.sub(r"\[[^\]]+\]", " ", title)
    title = NOISE_RE.sub(" ", title)
    title = re.sub(r"\s+", " ", title).strip(" ,-")
    return title or text.strip()


def should_skip_title(raw_title, normalized_title):
    raw = raw_title.strip().lower()
    norm = normalized_title.strip().lower()

    if not norm:
        return True
    if len(norm) <= 3:
        return True
    if norm in {"ts", "mp4", "mkv", "avi", "mov"}:
        return True
    if re.fullmatch(r"\d+p", raw):
        return True
    if re.fullmatch(r"\d+p\s*\.(ts|mp4|mkv|avi|mov)", raw):
        return True
    if re.fullmatch(r"(ts|mp4|mkv|avi|mov)", raw):
        return True
    return False


def canonical_text(text):
    text = normalize_title(text).lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def is_generic_title(title):
    return bool(re.match(r"^(season|episode)\b", title.strip(), re.IGNORECASE))


def dedupe_key(item):
    canonical_title = canonical_text(item["title"])
    year = item["year"] or ""

    if item["driveId"]:
        primary = ("drive", item["driveId"])
    else:
        primary = ("title", item["type"], canonical_title, year)

    if is_generic_title(item["title"]):
        primary = ("generic", item["category"].lower(), item["type"], canonical_title, year, item["driveId"] or item["url"])

    return primary


def choose_preferred(existing, candidate):
    existing_score = preference_score(existing)
    candidate_score = preference_score(candidate)
    return candidate if candidate_score > existing_score else existing


def preference_score(item):
    score = 0
    if item["year"]:
        score += 4
    if item["driveId"]:
        score += 3
    if item["type"] == "movie":
        score += 1
    score += len(item["rawTitle"])
    return score


def infer_type(url, title):
    if "/folders/" in url:
        return "series"
    if re.search(r"\b(season|series|episodes|complete)\b", title, re.IGNORECASE):
        return "series"
    return "movie"


def extract_drive_id(url):
    file_match = re.search(r"/file/d/([^/]+)", url)
    if file_match:
        return file_match.group(1), "file"

    folder_match = re.search(r"/folders/([^?&/]+)", url)
    if folder_match:
        return folder_match.group(1), "folder"

    open_match = re.search(r"[?&]id=([^&]+)", url)
    if open_match:
        return open_match.group(1), "file"

    return None, None


def preview_url(url):
    drive_id, kind = extract_drive_id(url)
    if not drive_id:
        return None
    if kind == "file":
        return f"https://drive.google.com/file/d/{drive_id}/preview"
    return f"https://drive.google.com/drive/folders/{drive_id}"


def build_catalog():
    paragraphs = load_paragraphs()
    current_category = "Featured"
    items = []

    for paragraph in paragraphs:
        text = maybe_fix_mojibake(paragraph["text"].strip())
        links = paragraph["links"]

        if SEPARATOR_RE.match(text):
            continue

        if not links and is_heading(text):
            current_category = text
            continue

        for link in links:
            raw_title = maybe_fix_mojibake((link["text"] or text).strip())
            title = normalize_title(raw_title)
            if should_skip_title(raw_title, title):
                continue
            year_match = YEAR_RE.search(raw_title)
            drive_id, drive_kind = extract_drive_id(link["url"])

            items.append(
                {
                    "title": title,
                    "rawTitle": raw_title,
                    "category": current_category,
                    "type": infer_type(link["url"], raw_title),
                    "year": int(year_match.group(1)) if year_match else None,
                    "url": link["url"],
                    "previewUrl": preview_url(link["url"]),
                    "driveId": drive_id,
                    "driveKind": drive_kind,
                }
            )

    deduped = []
    seen = set()
    for item in items:
        key = dedupe_key(item)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    exact_deduped = []
    title_map = {}
    for item in deduped:
        if is_generic_title(item["title"]):
            exact_deduped.append(item)
            continue

        exact_key = (item["type"], item["title"].strip().lower())
        if exact_key not in title_map:
            title_map[exact_key] = item
            exact_deduped.append(item)
            continue

        preferred = choose_preferred(title_map[exact_key], item)
        if preferred is not title_map[exact_key]:
            index = exact_deduped.index(title_map[exact_key])
            exact_deduped[index] = preferred
            title_map[exact_key] = preferred

    categories = []
    for item in exact_deduped:
        if item["category"] not in categories:
            categories.append(item["category"])

    featured = sorted(
        exact_deduped,
        key=lambda item: ((item["category"] in {"Action", "Comedy", "Horror", "Animation"}) is False, item["title"]),
    )[:8]

    return {
        "sourceDocument": DOCX_PATH.name,
        "totalTitles": len(exact_deduped),
        "categories": categories,
        "featured": [item["title"] for item in featured],
        "items": exact_deduped,
    }


def main():
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    catalog = build_catalog()
    OUTPUT_PATH.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {catalog['totalTitles']} titles to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

