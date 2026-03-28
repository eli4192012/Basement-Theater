const { handleCors, requireAdminPassword, sendJson } = require("./_lib/access");
const { getDeviceLabels, setDeviceLabels } = require("./_lib/supabase");

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  try {
    requireAdminPassword(req);
  } catch (e) {
    return sendJson(res, e.statusCode || 403, { error: e.message });
  }

  if (req.method === "GET") {
    const labels = await getDeviceLabels();
    return sendJson(res, 200, { labels });
  }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const labels = body.labels || {};
    // Sanitize — only allow string keys and string values, max 64 chars each
    const clean = {};
    for (const [k, v] of Object.entries(labels)) {
      if (typeof k === "string" && typeof v === "string" && k.length <= 64) {
        clean[k.slice(0, 64)] = String(v).slice(0, 64);
      }
    }
    await setDeviceLabels(clean);
    return sendJson(res, 200, { ok: true, labels: clean });
  }

  sendJson(res, 405, { error: "Method not allowed." });
};
