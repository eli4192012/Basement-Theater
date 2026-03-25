const { isAllowedEmail, sendJson, verifyGoogleToken } = require("../_lib/access");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    sendJson(res, 503, { error: "Google sign-in is not configured yet." });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const credential = body.credential;
    if (!credential) {
      sendJson(res, 400, { error: "Missing Google credential." });
      return;
    }

    const payload = await verifyGoogleToken(credential);
    const allowed = await isAllowedEmail(payload.email);
    if (!allowed) {
      sendJson(res, 403, { error: "This account is not approved for Basement Theater." });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      user: {
        email: payload.email,
        name: payload.name || payload.email,
        picture: payload.picture || "",
      },
    });
  } catch (error) {
    sendJson(res, 401, { error: error.message || "Google sign-in failed." });
  }
};
