import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "catalog.json"


def is_junk_title(title):
    text = title.strip().lower()
    if text in {"ts", "mp4", "mkv", "avi", "mov"}:
        return True
    if re.fullmatch(r"\d+p", text):
        return True
    if re.fullmatch(r"\d+p\s*(ts|mp4|mkv|avi|mov)?", text):
        return True
    return False


def main():
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    filtered = [item for item in catalog["items"] if not is_junk_title(item["title"])]
    removed = len(catalog["items"]) - len(filtered)
    catalog["items"] = filtered
    catalog["totalTitles"] = len(filtered)
    CATALOG_PATH.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Removed {removed} junk titles.")


if __name__ == "__main__":
    main()
