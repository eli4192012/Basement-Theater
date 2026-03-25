import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "catalog.json"
TRASH_PATH = ROOT / "data" / "trash-review.json"


def main():
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    trash = json.loads(TRASH_PATH.read_text(encoding="utf-8"))

    trashed_urls = {item.get("url") for item in trash.get("items", []) if item.get("url")}
    before = len(catalog["items"])
    remaining = [item for item in catalog["items"] if item.get("url") not in trashed_urls]

    removed = before - len(remaining)
    catalog["items"] = remaining
    catalog["totalTitles"] = len(remaining)
    catalog["featured"] = [title for title in catalog.get("featured", []) if any(item["title"] == title for item in remaining)]

    categories = []
    for item in remaining:
      if item["category"] not in categories:
        categories.append(item["category"])
    catalog["categories"] = categories

    CATALOG_PATH.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Removed {removed} trashed titles. Catalog now has {len(remaining)} items.")


if __name__ == "__main__":
    main()
