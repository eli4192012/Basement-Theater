import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "catalog.json"
DOCX_PATH = Path(r"C:\Users\elith\Downloads\The Basement Theater Sorter (1).docx")

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

SEPARATOR_RE = re.compile(r"^[~\-_=\s]{8,}$")
YEAR_RE = re.compile(r"\b(19\d{2}|20\d{2})\b")
NOISE_RE = re.compile(
    r"\b(1080p|720p|480p|360p|HDRip|BluRay|WEBRip|DVDRIPPED|HD|CAM|x264|x265|AAC|HEVC|Netflix Ripped|full movie)\b",
    re.IGNORECASE,
)


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


def canonical_text(text):
    text = normalize_title(text).lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def is_heading(text):
    stripped = text.strip()
    if not stripped or SEPARATOR_RE.match(stripped):
        return False
    if len(stripped) > 40:
        return False
    if YEAR_RE.search(stripped):
        return False
    if any(char.isdigit() for char in stripped[:2]):
        return False
    return True


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


def should_skip(raw_title, normalized_title):
    raw = raw_title.strip()
    norm = normalized_title.strip()

    if not norm:
        return True
    if len(norm) <= 3:
        return True
    if norm.lower() in {"ts", "mp4", "mkv", "avi", "mov"}:
        return True
    if re.fullmatch(r"\d+p", raw.lower()):
        return True
    if re.fullmatch(r"\d+p\s*\.(ts|mp4|mkv|avi|mov)", raw.lower()):
        return True
    if re.fullmatch(r"(ts|mp4|mkv|avi|mov)", raw.lower()):
        return True
    if re.fullmatch(r"box\s*\d+", raw.lower()):
        return True
    if norm.lower().endswith("comic") or re.search(r"\b(manga|comic|volume)\b", norm, re.IGNORECASE):
        return True
    return False


def parse_doc():
    with zipfile.ZipFile(DOCX_PATH) as archive:
        document = ET.fromstring(archive.read("word/document.xml"))
        relationships = ET.fromstring(archive.read("word/_rels/document.xml.rels"))

    rel_map = {}
    for rel in relationships.findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
        rel_id = rel.attrib.get("Id")
        target = rel.attrib.get("Target")
        if rel_id and target:
            rel_map[rel_id] = target

    current_category = "Imported Additions"
    items = []

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

        full_text = maybe_fix_mojibake(re.sub(r"\s+", " ", " ".join(text_parts)).strip())
        if not full_text and not links:
            continue
        if SEPARATOR_RE.match(full_text):
            continue
        if not links and is_heading(full_text):
            current_category = full_text
            continue

        for link in links:
            raw_title = maybe_fix_mojibake((link["text"] or full_text).strip())
            title = normalize_title(raw_title)
            if should_skip(raw_title, title):
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
    return items


def choose_preferred(existing, candidate):
    def score(item):
        value = 0
        if item.get("posterUrl"):
            value += 10
        if item.get("backdropUrl"):
            value += 5
        if item.get("year"):
            value += 3
        if item.get("driveId"):
            value += 2
        value += len(item.get("rawTitle", ""))
        return value

    return candidate if score(candidate) > score(existing) else existing


def main():
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    new_items = parse_doc()

    merged = []
    index = {}
    for item in catalog["items"]:
        key = (item.get("type"), canonical_text(item["title"]))
        index[key] = item
        merged.append(item)

    added = 0
    replaced = 0
    for item in new_items:
        key = (item.get("type"), canonical_text(item["title"]))
        if key not in index:
            index[key] = item
            merged.append(item)
            added += 1
            continue

        preferred = choose_preferred(index[key], item)
        if preferred is item:
            position = merged.index(index[key])
            merged[position] = item
            index[key] = item
            replaced += 1

    categories = []
    for item in merged:
        if item["category"] not in categories:
            categories.append(item["category"])

    featured = sorted(
        merged,
        key=lambda item: ((item["category"] in {"Action", "Comedy", "Horror", "Animation"}) is False, item["title"]),
    )[:8]

    catalog["totalTitles"] = len(merged)
    catalog["categories"] = categories
    catalog["featured"] = [item["title"] for item in featured]
    catalog["items"] = merged
    CATALOG_PATH.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Added {added} new titles and replaced {replaced} existing entries. Total is now {len(merged)}.")


if __name__ == "__main__":
    main()
