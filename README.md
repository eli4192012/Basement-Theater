# Basement Theater

Netflix-style static app generated from the links inside `The Basement Theater Sorter.docx`.

## Run it

1. Regenerate the catalog after updating the Word doc:

```bash
python .\\scripts\\extract_catalog.py
python .\\scripts\\normalize_categories.py
python .\\scripts\\enrich_tmdb_posters.py
python .\\scripts\\fetch_wikipedia_review.py
python .\\scripts\\check_links_for_trash.py
```

2. Start a local web server from this folder:

```bash
python -m http.server 4173
```

3. Open [http://localhost:4173](http://localhost:4173)

## Notes

- The app reads `data/catalog.json`.
- File links open directly in Google Drive.
- Folder links are treated like series or collections.
- Put your TMDB key in `.env` as `TMDB_API_KEY=...` before running poster enrichment.
