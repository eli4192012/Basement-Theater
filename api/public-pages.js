const { readPrivateJson, requireAllowedUser, sendJson } = require("./_lib/access");

module.exports = async function handler(req, res) {
  try {
    await requireAllowedUser(req);
    const pages = await readPrivateJson("public-pages.json");
    sendJson(res, 200, pages);
  } catch (error) {
    sendJson(res, error.statusCode || 401, { error: error.message || "Unauthorized." });
  }
};
