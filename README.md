# Basement Theater

Netflix-style streaming app generated from the links inside `The Basement Theater Sorter.docx`.

## Run it

1. Regenerate the private catalog after updating the Word doc:

```bash
python .\\scripts\\extract_catalog.py
python .\\scripts\\normalize_categories.py
python .\\scripts\\enrich_tmdb_posters.py
python .\\scripts\\fetch_wikipedia_review.py
python .\\scripts\\check_links_for_trash.py
```

2. Start a local web server from this folder for a static preview:

```bash
python -m http.server 4173
```

3. Open [http://localhost:4173](http://localhost:4173)

For the Google-locked version, run the app on Vercel so the `/api/*` routes are available.

## Notes

- The deployed app reads its protected catalog through Vercel API routes.
- Protected catalog data lives under `api/_lib/private/`.
- File links open directly in Google Drive.
- Folder links are treated like series or collections.
- Put your TMDB key in `.env` as `TMDB_API_KEY=...` before running poster enrichment.
- Set `GOOGLE_CLIENT_ID` in Vercel to enable Google sign-in gating.
- Set `ALLOWED_EMAILS` in Vercel as a comma-separated list of approved Google accounts.
