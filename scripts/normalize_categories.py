import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "api" / "_lib" / "private" / "catalog.json"


def normalize_text(value):
    value = value.lower()
    value = re.sub(r"[^a-z0-9\s&]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def has_any(text, tokens):
    return any(token in text for token in tokens)


def should_drop(item):
    title_text = normalize_text(item.get("title", ""))
    raw_text = normalize_text(item.get("rawTitle", ""))
    combined_text = normalize_text(f"{item.get('title', '')} {item.get('rawTitle', '')}")
    if not combined_text:
        return True
    if title_text in {"ts", "mp4", "mkv", "avi", "mov", "the video link"}:
        return True
    if re.fullmatch(r"\d+p(\s*(ts|mp4|mkv|avi|mov))?", title_text):
        return True
    if re.fullmatch(r"\d+p\s+ts", title_text):
        return True
    if re.fullmatch(r"group \d+", title_text):
        return True
    if re.fullmatch(r"[a-z]{1,3}\d{1,2}", title_text):
        return True
    if title_text in {"anix", "kaido", "moopa"}:
        return True
    if has_any(
        combined_text,
        [
            "movies and shows from the",
            "watch all nin ago",
            "by peter",
            "by chill sites",
            "work in progress",
            "placeholder",
        ],
    ):
        return True
    return False


def map_category(item):
    normalized = normalize_text(f"{item.get('title', '')} {item.get('rawTitle', '')}")
    item_type = item.get("type", "")

    if has_any(normalized, ["christmas", "xmas", "santa", "rudolph", "frosty", "grinch", "holiday special", "new year"]):
        return "Holiday"

    if has_any(
        normalized,
        [
            "anime",
            "jujutsu",
            "one piece",
            "demon slayer",
            "fate",
            "overlord",
            "baki",
            "witch watch",
            "arifureta",
            "re monster",
            "vtuber",
            "strike the blood",
            "magical index",
            "uwumaki",
            "nisekoi",
            "pokemon",
            "digimon",
            "dragon ball",
            "naruto",
            "bleach",
            "attack on titan",
            "black clover",
            "chainsaw man",
            "death note",
            "berserk",
            "solo leveling",
            "sailor moon",
            "my hero academia",
            "mob psycho",
            "spy x family",
            "fullmetal",
            "tokyo ghoul",
        ],
    ):
        return "Anime"

    if has_any(normalized, ["comic", "manga", "volume", "gocomics", "graphic novel", "webtoon"]):
        return "Comics & Manga"

    if has_any(
        normalized,
        [
            "marvel",
            "spider man",
            "spiderman",
            "spider verse",
            "batman",
            "gotham",
            "teen titans",
            "static shock",
            "superman",
            "invincible",
            "x men",
            "avengers",
            "captain america",
            "iron man",
            "thor",
            "hulk",
            "ant man",
            "deadpool",
            "wolverine",
            "moon knight",
            "guardians of the galaxy",
            "doctor strange",
            "shazam",
            "flash",
            "aquaman",
            "justice league",
        ],
    ):
        return "Superheroes"

    if has_any(
        normalized,
        [
            "star war",
            "transformers",
            "sci fi",
            "godzilla",
            "alien",
            "jurassic",
            "avatar",
            "harry potter",
            "fantastic beasts",
            "lord of the rings",
            "hobbit",
            "pirates of the caribbean",
            "pirates of the carribean",
            "planet of the apes",
            "dune",
            "matrix",
            "tron",
            "ready player one",
            "ghostbusters",
            "back to the future",
        ],
    ):
        return "Sci-Fi & Fantasy"

    if has_any(
        normalized,
        [
            "horror",
            "ghost",
            "terrifier",
            "scream",
            "halloween",
            "annabelle",
            "chucky",
            "conjuring",
            "exorcist",
            "nun",
            "texas chainsaw",
            "evil dead",
            "salem",
            "pet sematary",
            "insidious",
            "saw",
            "jigsaw",
            "freddy",
            "elm street",
            "friday the 13th",
        ],
    ):
        return "Horror"

    if has_any(
        normalized,
        [
            "disney",
            "pixar",
            "dreamworks",
            "my little pony",
            "tmnt",
            "teenage mutant ninja turtles",
            "sonic",
            "dog man",
            "diary of a wimpy kid",
            "bluey",
            "spongebob",
            "kids",
            "family",
            "despicable me",
            "minions",
            "bee movie",
            "inside out",
            "lorax",
            "recess",
            "shrek",
            "frozen",
            "encanto",
            "incredibles",
            "mulan",
            "luca",
            "peter pan",
            "good dinosaur",
            "little mermaid",
            "lion king",
            "toy story",
            "wall e",
            "walle",
            "kung fu panda",
            "how to train your dragon",
            "moana",
            "wonka",
            "barbie",
            "super mario",
        ],
    ):
        return "Family & Animation"

    if has_any(
        normalized,
        [
            "breaking bad",
            "good doctor",
            "kim possible",
            "south park",
            "adventure time",
            "boondocks",
            "euphoria",
            "the chi",
            "harvey birdman",
            "fionna and cake",
            "gravity falls",
            "regular show",
            "ben 10",
            "steven universe",
            "gumball",
            "simpson",
            "complete seasons",
            "season ",
            "s01",
            "s02",
            "s03",
            "s04",
            "e1",
            "e2",
            "e3",
            "e4",
        ],
    ):
        return "TV Series"

    if has_any(normalized, ["comedy", "funny", "sussy", "skibidis", "mask", "underdoggs", "white chicks", "step brothers"]):
        return "Comedy"

    if has_any(
        normalized,
        [
            "crime",
            "doctor",
            "drama",
            "abbott",
            "summer i turned pretty",
            "oppenheimer",
            "gladiator",
            "8 mile",
            "top gun",
            "good will hunting",
            "pursuit of happyness",
            "hidden figures",
            "social network",
        ],
    ):
        return "Drama"

    if item_type == "series":
        return "TV Series"

    return "More to Explore"


def main():
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    catalog["items"] = [item for item in catalog["items"] if not should_drop(item)]

    for item in catalog["items"]:
        item["category"] = map_category(item)

    order = [
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

    featured_priorities = {"Family & Animation", "Superheroes", "Horror", "Sci-Fi & Fantasy", "Drama", "Comedy"}
    covered_items = [item for item in catalog["items"] if item.get("posterUrl") or item.get("backdropUrl")]
    featured = sorted(
        covered_items,
        key=lambda item: ((item["category"] not in featured_priorities), item["title"].lower()),
    )[:8]

    catalog["categories"] = categories
    catalog["featured"] = [item["title"] for item in featured]
    catalog["totalTitles"] = len(catalog["items"])
    CATALOG_PATH.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Normalized categories down to {len(categories)} groups and kept {len(catalog['items'])} titles.")


if __name__ == "__main__":
    main()
