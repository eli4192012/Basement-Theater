import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "api" / "_lib" / "private" / "catalog.json"


def normalize_text(value):
    value = value.lower()
    value = re.sub(r"[^a-z0-9\s&]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def map_category(item):
    category = item.get("category", "")
    title = item.get("title", "")
    combined = f"{category} {title}"
    normalized = normalize_text(combined)

    if any(token in normalized for token in ["christmas", "santa", "rudolph", "frosty", "holiday"]):
        return "Holiday"
    if any(token in normalized for token in ["anime", "jujutsu", "one piece", "demon slayer", "fate", "overlord", "pokemon tv", "baki", "witch watch", "arifureta", "re monster", "vtuber", "strike the blood", "magical index", "uwumaki", "nisekoi"]):
        return "Anime"
    if any(token in normalized for token in ["comic", "manga", "volume", "gocomics"]):
        return "Comics & Manga"
    if any(token in normalized for token in ["marvel", "spiderman", "batman", "gotham", "teen titans", "static shock", "superman", "invincible", "x men", "john wick"]):
        return "Superheroes"
    if any(token in normalized for token in ["star war", "transformers", "sci fi", "godzilla", "alien", "jurassic", "avatar"]):
        return "Sci-Fi & Fantasy"
    if any(token in normalized for token in ["horror", "ghost", "terrifier", "scream", "halloween", "annabelle", "chucky", "conjuring"]):
        return "Horror"
    if any(token in normalized for token in ["disney", "my little pony", "tmnt", "sonic", "dog man", "diary of a wimpy kid", "bluey", "spongebob", "kids", "family", "despicable me", "minions"]):
        return "Family & Animation"
    if any(token in normalized for token in ["breaking bad", "good doctor", "kim possible", "south park", "tv shows", "series", "season "]):
        return "TV Series"
    if any(token in normalized for token in ["comedy", "funny", "sussy", "skibidis"]):
        return "Comedy"
    if any(token in normalized for token in ["crime", "doctor", "drama", "abbott", "summer i turned pretty"]):
        return "Drama"
    if any(token in normalized for token in ["featured", "watch all nin ago", "by peter", "by chill sites", "work in progress", "placeholder"]):
        return "Featured"
    return "More to Explore"


def main():
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    for item in catalog["items"]:
        item["category"] = map_category(item)

    order = [
        "Featured",
        "Family & Animation",
        "Anime",
        "Superheroes",
        "Sci-Fi & Fantasy",
        "Horror",
        "Comedy",
        "Drama",
        "TV Series",
        "Holiday",
        "Comics & Manga",
        "More to Explore",
    ]

    seen = set()
    categories = []
    for category in order:
        if any(item["category"] == category for item in catalog["items"]):
            categories.append(category)
            seen.add(category)
    for item in catalog["items"]:
        if item["category"] not in seen:
            categories.append(item["category"])
            seen.add(item["category"])

    featured_priorities = {"Featured", "Family & Animation", "Superheroes", "Horror", "Sci-Fi & Fantasy"}
    featured = sorted(
        catalog["items"],
        key=lambda item: ((item["category"] not in featured_priorities), item["title"].lower()),
    )[:8]

    catalog["categories"] = categories
    catalog["featured"] = [item["title"] for item in featured]
    catalog["totalTitles"] = len(catalog["items"])
    CATALOG_PATH.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Normalized categories down to {len(categories)} groups.")


if __name__ == "__main__":
    main()

