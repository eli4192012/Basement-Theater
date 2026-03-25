const { isAllowedEmail, sendJson } = require("../_lib/access");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) {
      sendJson(res, 400, { error: "Enter an email address." });
      return;
    }

    const allowed = await isAllowedEmail(email);
    if (!allowed) {
      sendJson(res, 403, { error: "Access denied. That email is not approved for Basement Theater." });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      user: {
        email,
        name: email,
        picture: "",
      },
      token: email,
    });
  } catch (error) {
    sendJson(res, 401, { error: error.message || "Could not verify that email." });
  }
};
