const { createSessionToken, handleCors, sendJson } = require("../_lib/access");
const { appendLoginActivity } = require("../_lib/supabase");
const path = require("path");
const fs = require("fs");

const APP_PASSWORD = process.env.APP_PASSWORD || "Firepump1234";

function getAllowedEmails() {
  try {
    const filePath = path.join(__dirname, "../../allowed-emails.json");
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw).map((e) => String(e).trim().toLowerCase());
  } catch {
    return [];
  }
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const password = String(body.password || "");
    const email = String(body.manualEmail || "").trim().toLowerCase();

    if (!password) {
      sendJson(res, 400, { error: "Enter the password." });
      return;
    }

    if (!email) {
      sendJson(res, 403, { error: "Please enter your email." });
      return;
    }

    const allowedEmails = getAllowedEmails();
    if (!allowedEmails.includes(email)) {
      sendJson(res, 403, { error: "That email isn't on the access list." });
      return;
    }

    if (password !== APP_PASSWORD) {
      sendJson(res, 403, { error: "Access denied. Wrong password." });
      return;
    }

    const user = { email, name: email, picture: "" };

    const token = createSessionToken({
      password,
      email: user.email,
      name: user.name,
      picture: user.picture,
      issuedAt: new Date().toISOString(),
    });

    await appendLoginActivity({
      email: user.email,
      name: user.name,
      picture: user.picture,
      loggedInAt: new Date().toISOString(),
    }).catch(() => null);

    sendJson(res, 200, { ok: true, user, token });
  } catch (error) {
    sendJson(res, 401, { error: error.message || "Could not verify access." });
  }
};
