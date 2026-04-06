const { createSessionToken, handleCors, sendJson } = require("../_lib/access");
const { appendFailedAttempt, appendLoginActivity, getBannedDevices } = require("../_lib/supabase");

const APP_PASSWORD = process.env.APP_PASSWORD || "colors1234";

const ALLOWED_EMAILS = [
  "elithomas0419@gmail.com",
  "elong091@rsdmo.org",
  "emasterson059@rsdmo.org",
  "knolley062@rsdmo.org",
  "spillay084@rsdmo.org",
  "blansing045@rsdmo.org",
  "dlombardo162@rsdmo.org",
  "cweiss074@rsdmo.org",
  "bsornat025@rsdmo.org"
];

function getClientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress || "";
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
    const deviceId = String(body.deviceId || "").trim();
    const ip = getClientIp(req);
    const loggedInAt = new Date().toISOString();

    if (!email) {
      sendJson(res, 403, { error: "Please enter your email." });
      return;
    }

    if (deviceId) {
      const bannedData = await getBannedDevices().catch(() => ({ banned: [] }));
      const isBanned = (bannedData.banned || []).some((b) => {
        if (b.deviceId !== deviceId) return false;
        if (b.expiresAt && new Date(b.expiresAt) < new Date()) return false; // expired
        return true;
      });
      if (isBanned) {
        appendLoginActivity({ email, password, status: "denied", reason: "Device banned", ip, deviceId, loggedInAt }).catch(() => null);
        sendJson(res, 403, { error: "Access denied from this device." });
        return;
      }
    }

    if (!ALLOWED_EMAILS.includes(email)) {
      appendFailedAttempt({ password, email, ip, attemptedAt: loggedInAt }).catch(() => null);
      appendLoginActivity({ email, password, status: "denied", reason: "Email not on access list", ip, loggedInAt }).catch(() => null);
      sendJson(res, 403, { error: "That email isn't on the access list." });
      return;
    }

    if (!password || password !== APP_PASSWORD) {
      appendFailedAttempt({ password, email, ip, attemptedAt: loggedInAt }).catch(() => null);
      appendLoginActivity({ email, password, status: "denied", reason: "Wrong password", ip, loggedInAt }).catch(() => null);
      sendJson(res, 403, { error: "Access denied. Wrong password." });
      return;
    }

    const user = { email, name: email, picture: "" };

    const token = createSessionToken({
      password,
      email: user.email,
      name: user.name,
      picture: user.picture,
      googleVerified: true,
      issuedAt: loggedInAt,
    });

    await appendLoginActivity({
      email: user.email,
      password,
      status: "accepted",
      reason: "",
      ip,
      deviceId,
      loggedInAt,
    }).catch(() => null);

    sendJson(res, 200, { ok: true, user, token });
  } catch (error) {
    sendJson(res, 401, { error: error.message || "Could not verify access." });
  }
};
