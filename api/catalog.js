const { readPrivateJson, requireAllowedUser, sendJson } = require("./_lib/access");

module.exports = async function handler(req, res) {
  try {
    await requireAllowedUser(req);
    const catalog = await readPrivateJson("catalog.json");
    sendJson(res, 200, catalog);
  } catch (error) {
    sendJson(res, error.statusCode || 401, { error: error.message || "Unauthorized." });
  }
};
