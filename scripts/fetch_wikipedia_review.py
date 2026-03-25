import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "catalog.json"
OUTPUT_PATH = ROOT / "data" / "wikipedia-review.json"
USER_AGENT = "BasementTheaterWikipediaReview/1.0"

SKIP_PATTERNS = [
    r"\bseason\s+\d+\b",
    r"\bs\d+e\d+\b",
    r"\bepisode\b",
    r"\bmanga\b",
    r"\bcomic\b",
    r"\bvolume\b",
    r"^\d+p$",
    r"^box\s*\d+$",
]


def load_catalog():
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def normalize_text(value):
    value = value.lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def should_skip(title):
    text = title.strip().lower()
    if len(text) < 4:
        return True
    return any(re.search(pattern, text, re.IGNORECASE) for pattern in SKIP_PATTERNS)


def review_query(item):
    title = item["title"]
    title = re.sub(r"\b(19\d{2}|20\d{2})\b", "", title)
    title = re.sub(r"\b(full|movie|series|complete|theatrical|dvdrip|camhd|web dl|amzn|hmax|nf)\b", "", title, flags=re.IGNORECASE)
    title = re.sub(r"[^A-Za-z0-9\s:&'-]", " ", title)
    title = re.sub(r"\s+", " ", title).strip()
    return title


def fetch_json(base_url, params):
    url = f"{base_url}?{urlencode(params)}"
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def candidate_score(item, page):
    item_norm = normalize_text(item["title"])
    page_norm = normalize_text(page.get("title", ""))
    score = 0
    if page_norm == item_norm:
        score += 100
    elif page_norm.startswith(item_norm) or item_norm.startswith(page_norm):
        score += 70
    else:
        score += len(set(item_norm.split()) & set(page_norm.split())) * 10

    year = item.get("year")
    if year and str(year) in page.get("title", ""):
        score += 12
    if "thumbnail" in page:
        score += 8
    return score


def find_wikipedia_candidate(item):
    query = review_query(item)
    if not query or should_skip(query):
        return None

    payload = fetch_json(
        "https://en.wikipedia.org/w/api.php",
        {
            "action": "query",
            "format": "json",
            "prop": "pageimages|info",
            "generator": "search",
            "gsrsearch": query,
            "gsrlimit": 5,
            "piprop": "thumbnail",
            "pithumbsize": 800,
            "inprop": "url",
        },
    )

    pages = list(payload.get("query", {}).get("pages", {}).values())
    if not pages:
        return None

    pages = [page for page in pages if page.get("thumbnail", {}).get("source")]
    if not pages:
        return None

    best = max(pages, key=lambda page: candidate_score(item, page))
    if candidate_score(item, best) < 40:
        return None

    return {
        "title": item["title"],
        "category": item["category"],
        "year": item.get("year"),
        "type": item.get("type"),
        "posterUrl": best["thumbnail"]["source"],
        "source": "wikipedia",
        "wikipediaTitle": best.get("title"),
        "wikipediaUrl": best.get("fullurl"),
        "score": candidate_score(item, best),
    }


def main():
    catalog = load_catalog()
    missing = [item for item in catalog["items"] if not item.get("posterUrl")]
    candidates = []

    for item in missing:
        try:
            candidate = find_wikipedia_candidate(item)
            if candidate:
                candidates.append(candidate)
        except Exception:
            pass
        time.sleep(0.05)

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "totalCandidates": len(candidates),
        "items": candidates,
    }
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(candidates)} Wikipedia review candidates to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
