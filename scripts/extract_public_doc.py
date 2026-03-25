import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path.home() / "Downloads"
OUTPUT_PATH = ROOT / "api" / "_lib" / "private" / "public-pages.json"

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

TOP_LEVEL_TITLES = {
    "home",
    "announcements",
    "credits/staff+application",
    "updates",
    "banned",
    "theater",
    "gaming room",
    "file unblock method",
    "additional games folders",
    "game stash",
    "important links",
    "music room",
    "proxy corner",
    "suggestions",
    "staff",
    "staff chat",
    "staff logs",
    "staff link testing",
}

SEPARATOR_RE = re.compile(r"^[\W_~=\-\s]{6,}$")
MOJIBAKE_RE = re.compile(r"[ðŸâÃïœž€¢™”“]+")


def find_source_doc():
    matches = sorted(DOWNLOADS.glob("*Basement Public*.docx"), key=lambda path: path.stat().st_mtime, reverse=True)
    if not matches:
        raise FileNotFoundError("Could not find a Basement Public .docx file in Downloads.")
    return matches[0]


def slugify(text):
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "page"


def normalize_text(text):
    return re.sub(r"\s+", " ", text or "").strip()


def maybe_fix_mojibake(text):
    if "ð" not in text and "â" not in text and "Ã" not in text:
        return text
    try:
        return text.encode("cp1252").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text


def display_text(raw):
    text = normalize_text(maybe_fix_mojibake(raw))
    text = MOJIBAKE_RE.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip(" -")
    return text


def heading_key(text):
    stripped = normalize_text(re.sub(r"^[^A-Za-z0-9]+", "", text))
    return stripped.lower()


def load_paragraphs(docx_path):
    with zipfile.ZipFile(docx_path) as archive:
        document = ET.fromstring(archive.read("word/document.xml"))
        relationships = ET.fromstring(archive.read("word/_rels/document.xml.rels"))

    rel_map = {}
    for rel in relationships:
        rel_id = rel.attrib.get("Id")
        target = rel.attrib.get("Target")
        if rel_id and target:
            rel_map[rel_id] = target

    paragraphs = []
    for paragraph in document.findall(".//w:body/w:p", NS):
        style_node = paragraph.find("./w:pPr/w:pStyle", NS)
        style = style_node.attrib.get(f"{{{NS['w']}}}val", "") if style_node is not None else ""

        parts = []
        links = []
        for child in paragraph:
            tag_name = child.tag.split("}")[-1]
            if tag_name == "hyperlink":
                rel_id = child.attrib.get(f"{{{NS['r']}}}id")
                link_text = normalize_text("".join(node.text or "" for node in child.findall(".//w:t", NS)))
                if link_text:
                    parts.append(link_text)
                if rel_id and rel_id in rel_map:
                    links.append({"text": link_text or rel_map[rel_id], "url": rel_map[rel_id]})
            else:
                plain = normalize_text("".join(node.text or "" for node in child.findall(".//w:t", NS)))
                if plain:
                    parts.append(plain)

        text = display_text(" ".join(parts))
        if text or links or style:
            paragraphs.append({"style": style, "text": text, "links": links})

    return paragraphs


def is_separator(text):
    return bool(text) and bool(SEPARATOR_RE.match(text))


def is_top_level_title(paragraph):
    return paragraph["style"] == "Title" and heading_key(paragraph["text"]) in TOP_LEVEL_TITLES


def build_pages(docx_path):
    paragraphs = load_paragraphs(docx_path)
    pages = []
    current_page = None
    current_section = None

    for paragraph in paragraphs:
        text = paragraph["text"]
        if is_top_level_title(paragraph):
            current_page = {
                "title": text,
                "slug": slugify(text),
                "sections": [],
            }
            pages.append(current_page)
            current_section = None
            continue

        if current_page is None:
            continue

        if paragraph["style"] == "Title":
            current_section = {
                "heading": text,
                "entries": [],
            }
            current_page["sections"].append(current_section)
            continue

        if not text and not paragraph["links"]:
            continue
        if is_separator(text):
            continue

        if current_section is None:
            current_section = {"heading": "", "entries": []}
            current_page["sections"].append(current_section)

        current_section["entries"].append(
            {
                "text": display_text(text),
                "links": paragraph["links"],
            }
        )

    for page in pages:
        sections = []
        for section in page["sections"]:
            if section["heading"] or section["entries"]:
                sections.append(section)
        page["sections"] = sections

    return {
        "sourceDocument": docx_path.name,
        "totalPages": len(pages),
        "pages": pages,
    }


def main():
    source_doc = find_source_doc()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = build_pages(source_doc)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {payload['totalPages']} public pages.")


if __name__ == "__main__":
    main()
