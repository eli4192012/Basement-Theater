const { handleCors, requireAdminPassword, requireAllowedUser, sendJson } = require("../_lib/access");
const { getSecurityConfig, setSecurityConfig } = require("../_lib/supabase");

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method === "GET") {
    try {
      await requireAllowedUser(req);
      const config = await getSecurityConfig();
      sendJson(res, 200, config);
    } catch (error) {
      sendJson(res, error.statusCode || 500, { error: error.message || "Could not load security settings." });
    }
    return;
  }

  if (req.method === "POST") {
    try {
      requireAdminPassword(req);
      await requireAllowedUser(req);
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const config = await setSecurityConfig({
        requireGoogleSignIn: Boolean(body.requireGoogleSignIn),
      });
      sendJson(res, 200, config);
    } catch (error) {
      sendJson(res, error.statusCode || 500, { error: error.message || "Could not save security settings." });
    }
    return;
  }

  sendJson(res, 405, { error: "Method not allowed." });
};
