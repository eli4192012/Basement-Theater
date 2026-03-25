import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "catalog.json"
OUTPUT_PATH = ROOT / "data" / "trash-review.json"
USER_AGENT = "BasementTheaterLinkCheck/1.0"
MAX_WORKERS = 12

BROKEN_PATTERNS = [
    r"sorry,\s*the file you have requested does not exist",
    r"file you have requested does not exist",
    r"sorry, unable to open the file",
    r"video is unavailable",
    r"access denied",
    r"you need access",
    r"request access",
    r"cannot be played",
    r"playback on other websites has been disabled",
    r"page not found",
    r"error 404",
]


def load_catalog():
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def fetch_text(url):
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=8) as response:
        status = getattr(response, "status", 200)
        content_type = response.headers.get("Content-Type", "")
        body = response.read(25000).decode("utf-8", errors="ignore")
        return status, content_type, body


def classify_item(item):
    test_urls = [item.get("previewUrl"), item.get("url")]
    checked = []

    for url in [u for u in test_urls if u]:
        try:
            status, content_type, body = fetch_text(url)
            checked.append({"url": url, "status": status, "contentType": content_type})
            lowered = body.lower()
            for pattern in BROKEN_PATTERNS:
                if re.search(pattern, lowered):
                    return {
                        "status": "flagged",
                        "reason": re.search(pattern, lowered).group(0),
                        "checkedUrl": url,
                        "httpStatus": status,
                    }
        except HTTPError as exc:
            if exc.code in {403, 404, 410, 500}:
                return {
                    "status": "flagged",
                    "reason": f"http {exc.code}",
                    "checkedUrl": url,
                    "httpStatus": exc.code,
                }
            checked.append({"url": url, "status": exc.code, "contentType": "http-error"})
        except URLError:
            checked.append({"url": url, "status": "network-error", "contentType": "url-error"})

    return {"status": "ok", "checked": checked}


def main():
    catalog = load_catalog()
    flagged = []
    processed = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(classify_item, item): item for item in catalog["items"]}
        for future in as_completed(futures):
            item = futures[future]
            processed += 1
            try:
                result = future.result()
                if result["status"] == "flagged":
                    flagged.append(
                        {
                            "title": item["title"],
                            "category": item["category"],
                            "year": item.get("year"),
                            "type": item.get("type"),
                            "url": item.get("url"),
                            "previewUrl": item.get("previewUrl"),
                            "reason": result["reason"],
                            "checkedUrl": result["checkedUrl"],
                            "httpStatus": result.get("httpStatus"),
                        }
                    )
            except Exception as exc:
                flagged.append(
                    {
                        "title": item["title"],
                        "category": item["category"],
                        "year": item.get("year"),
                        "type": item.get("type"),
                        "url": item.get("url"),
                        "previewUrl": item.get("previewUrl"),
                        "reason": f"check failed: {type(exc).__name__}",
                        "checkedUrl": item.get("previewUrl") or item.get("url"),
                        "httpStatus": None,
                    }
                )

            if processed % 100 == 0:
                payload = {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "totalCandidates": len(flagged),
                    "processed": processed,
                    "items": flagged,
                }
                OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "totalCandidates": len(flagged),
        "processed": processed,
        "items": flagged,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(flagged)} trash review candidates to {OUTPUT_PATH} after checking {processed} items.")


if __name__ == "__main__":
    main()
