const { handleCors, requireAdminPassword, requireAllowedUser, sendJson } = require("../_lib/access");
const { getFailedAttempts } = require("../_lib/supabase");

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    requireAdminPassword(req);
    await requireAllowedUser(req);
    const data = await getFailedAttempts();
    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message || "Could not load failed attempts." });
  }
};
