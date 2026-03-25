const { readPrivateJson, requireAllowedUser, sendJson } = require("./_lib/access");

module.exports = async function handler(req, res) {
  try {
    if (process.env.GOOGLE_CLIENT_ID) {
      await requireAllowedUser(req);
    }
    const trash = await readPrivateJson("trash-review.json");
    sendJson(res, 200, trash);
  } catch (error) {
    sendJson(res, error.statusCode || 401, { error: error.message || "Unauthorized." });
  }
};
