const { sendJson } = require("../_lib/access");
const APP_PASSWORD = process.env.APP_PASSWORD || "Firepump1234";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const password = String(body.password || "");
    if (!password) {
      sendJson(res, 400, { error: "Enter the password." });
      return;
    }

    if (password !== APP_PASSWORD) {
      sendJson(res, 403, { error: "Access denied. Wrong password." });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      user: {
        email: "basement-theater@local",
        name: "Basement Theater",
        picture: "",
      },
      token: password,
    });
  } catch (error) {
    sendJson(res, 401, { error: error.message || "Could not verify that password." });
  }
};
