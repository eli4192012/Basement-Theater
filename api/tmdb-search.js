const { handleCors, requireAdminPassword, sendJson } = require("./_lib/access");

const TMDB_KEY = process.env.TMDB_API_KEY;
const IMG    = "https://image.tmdb.org/t/p/w500";
const BACK   = "https://image.tmdb.org/t/p/w1280";

const GENRE_MAP = {
  28:"Action",12:"Adventure",16:"Animation",35:"Comedy",80:"Crime",
  99:"Documentary",18:"Drama",10751:"Family",14:"Fantasy",36:"History",
  27:"Horror",10402:"Music",9648:"Mystery",10749:"Romance",878:"Sci-Fi",
  53:"Thriller",10752:"War",37:"Western",10770:"TV Movie",
};

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    requireAdminPassword(req);
  } catch (e) {
    return sendJson(res, e.statusCode || 403, { error: e.message });
  }

  if (!TMDB_KEY) return sendJson(res, 500, { error: "TMDB_API_KEY not configured on server." });

  const q    = String(req.query?.q || "").trim();
  const type = req.query?.type === "series" ? "tv" : "movie";
  if (!q) return sendJson(res, 400, { error: "Missing query." });

  try {
    const url = `https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&page=1`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`TMDB returned ${resp.status}`);
    const data = await resp.json();

    const results = (data.results || []).slice(0, 7).map((r) => ({
      title:      r.title || r.name || "",
      year:       (r.release_date || r.first_air_date || "").slice(0, 4),
      overview:   r.overview || "",
      posterUrl:  r.poster_path   ? `${IMG}${r.poster_path}`  : null,
      backdropUrl:r.backdrop_path ? `${BACK}${r.backdrop_path}`: null,
      genres:     (r.genre_ids || []).map((id) => GENRE_MAP[id]).filter(Boolean),
      tmdbRating: r.vote_average  || null,
      tmdbId:     r.id,
    }));

    sendJson(res, 200, { results });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Search failed." });
  }
};
