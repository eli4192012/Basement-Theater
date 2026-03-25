import json
import os
import re
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "api" / "_lib" / "private" / "catalog.json"
ENV_PATH = ROOT / ".env"
MANUAL_POSTERS_PATH = ROOT / "data" / "manual-posters.json"
USER_AGENT = "BasementTheaterTMDB/1.0"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"
TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w780"

STOP_WORDS = {
    "full",
    "movie",
    "movies",
    "series",
    "complete",
    "season",
    "seasons",
    "episodes",
    "episode",
    "dvdripped",
    "bluray",
    "webrip",
    "hdrip",
    "netflix",
    "ripped",
    "theatrical",
    "theatricaldvdrip",
    "cam",
    "hd",
    "english",
}


def load_env():
    if not ENV_PATH.exists():
        return
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def load_catalog():
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def load_manual_config():
    if not MANUAL_POSTERS_PATH.exists():
        return {"aliases": {}, "skipTitles": []}
    return json.loads(MANUAL_POSTERS_PATH.read_text(encoding="utf-8"))


def save_catalog(catalog):
    CATALOG_PATH.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")


def normalize(text):
    text = text.lower()
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    words = [word for word in text.split() if word and word not in STOP_WORDS]
    return " ".join(words)


def search_title(item, aliases):
    text = aliases.get(item["title"], item["title"])
    text = text.replace("&", " and ")
    text = re.sub(r"\b(19\d{2}|20\d{2})\b", "", text)
    text = re.sub(r"\b(s\d+e\d+|part\s+\w+)\b", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\b(complete|theatrical|dvdrip|camhd|web dl|hmax|amzn|nf|pilot|weekly)\b", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bseason\s+\w+\b.*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bs\d+\b.*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\+\s.*$", "", text)
    text = re.sub(r"\(.*?\)", " ", text)
    text = re.sub(r"[^A-Za-z0-9\s&'-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def fetch_json(url, params):
    full_url = f"{url}?{urlencode(params)}"
    request = Request(full_url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_details(endpoint, tmdb_id, api_key):
    return fetch_json(
        f"https://api.themoviedb.org/3/{endpoint}/{tmdb_id}",
        {
            "api_key": api_key,
            "append_to_response": "credits,content_ratings,release_dates",
        },
    )


def score_result(item, result):
    title_key = "title" if item["type"] == "movie" else "name"
    candidate_name = result.get(title_key) or result.get("name") or result.get("title") or ""
    item_norm = normalize(item["title"])
    candidate_norm = normalize(candidate_name)
    score = 0

    if candidate_norm == item_norm:
        score += 100
    elif candidate_norm.startswith(item_norm) or item_norm.startswith(candidate_norm):
        score += 70
    else:
        score += len(set(item_norm.split()) & set(candidate_norm.split())) * 10

    item_year = item.get("year")
    date_key = "release_date" if item["type"] == "movie" else "first_air_date"
    candidate_year = None
    raw_date = result.get(date_key, "")
    if raw_date[:4].isdigit():
        candidate_year = int(raw_date[:4])
    if item_year and candidate_year:
        score += max(0, 18 - abs(item_year - candidate_year) * 6)

    if result.get("poster_path"):
        score += 8
    if result.get("backdrop_path"):
        score += 4

    return score


def enrich_item(item, api_key, aliases, skip_titles):
    if item.get("posterUrl"):
        return False

    if item["title"] in skip_titles:
        return False

    if re.search(r"\b(manga|comic|volume)\b", item["title"], re.IGNORECASE):
        return False
    if re.search(r"\bseason\s+\d+\b", item["title"], re.IGNORECASE) and item["title"].strip().lower().startswith("season"):
        return False
    if re.search(r"\bs\d+e\d+\b", item["title"], re.IGNORECASE):
        return False
    if re.search(r"\bepisode\b", item["title"], re.IGNORECASE):
        return False
    if re.search(r"\b\d+p\b", item["title"], re.IGNORECASE) and len(item["title"].strip()) <= 10:
        return False

    endpoint = "movie" if item["type"] == "movie" else "tv"
    query = search_title(item, aliases)
    if not query:
        return False

    payload = fetch_json(
        f"https://api.themoviedb.org/3/search/{endpoint}",
        {
            "api_key": api_key,
            "query": query,
            "include_adult": "false",
        },
    )
    results = payload.get("results", [])
    if not results and endpoint == "movie":
        payload = fetch_json(
            "https://api.themoviedb.org/3/search/tv",
            {
                "api_key": api_key,
                "query": query,
                "include_adult": "false",
            },
        )
        results = payload.get("results", [])
    elif not results and endpoint == "tv":
        payload = fetch_json(
            "https://api.themoviedb.org/3/search/movie",
            {
                "api_key": api_key,
                "query": query,
                "include_adult": "false",
            },
        )
        results = payload.get("results", [])

    if not results:
        return False

    best = max(results, key=lambda result: score_result(item, result))
    poster_path = best.get("poster_path")
    backdrop_path = best.get("backdrop_path")
    if not poster_path and not backdrop_path:
        return False

    item["posterUrl"] = f"{TMDB_IMAGE_BASE}{poster_path}" if poster_path else None
    item["backdropUrl"] = f"{TMDB_BACKDROP_BASE}{backdrop_path}" if backdrop_path else item["posterUrl"]
    item["imageSource"] = "tmdb"
    item["tmdbId"] = best.get("id")
    item["tmdbType"] = endpoint

    try:
        details = fetch_details(endpoint, best.get("id"), api_key)
        item["overview"] = details.get("overview") or item.get("overview")
        runtime = details.get("runtime") or (details.get("episode_run_time") or [None])[0]
        item["runtime"] = runtime
        item["tmdbRating"] = details.get("vote_average")
        cast = [person.get("name") for person in details.get("credits", {}).get("cast", [])[:5] if person.get("name")]
        item["cast"] = cast
    except Exception:
        pass
    return True


def main():
    load_env()
    api_key = os.environ.get("TMDB_API_KEY")
    if not api_key:
        raise SystemExit("Missing TMDB_API_KEY in .env")

    catalog = load_catalog()
    manual_config = load_manual_config()
    aliases = manual_config.get("aliases", {})
    skip_titles = set(manual_config.get("skipTitles", []))
    added = 0

    for item in catalog["items"]:
        try:
            if enrich_item(item, api_key, aliases, skip_titles):
                added += 1
        except Exception:
            pass
        time.sleep(0.05)

    save_catalog(catalog)
    total = len(catalog["items"])
    with_posters = sum(1 for item in catalog["items"] if item.get("posterUrl"))
    print(f"Added posters to {with_posters}/{total} titles ({added} new this run).")


if __name__ == "__main__":
    main()

