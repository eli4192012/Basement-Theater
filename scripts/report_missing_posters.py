import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "catalog.json"
REPORT_PATH = ROOT / "data" / "missing-posters.json"


def main():
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    missing = [
        {
            "title": item["title"],
            "category": item["category"],
            "year": item.get("year"),
            "type": item.get("type"),
            "rawTitle": item.get("rawTitle"),
        }
        for item in catalog["items"]
        if not item.get("posterUrl")
    ]
    REPORT_PATH.write_text(json.dumps(missing, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(missing)} missing entries to {REPORT_PATH}")


if __name__ == "__main__":
    main()
