const { createSessionToken, handleCors, sendJson } = require("../_lib/access");
const { appendFailedAttempt, appendLoginActivity, getSecurityConfig } = require("../_lib/supabase");
const APP_PASSWORD = process.env.APP_PASSWORD || "Firepump1234";

function extractEmailFromIdToken(idToken) {
  try {
    const [, payload] = String(idToken || "").split(".");
    if (!payload) return "";
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.email || "";
  } catch {
    return "";
  }
}

function getClientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress || "";
}

async function verifyGoogleIdToken(idToken) {
  const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!resp.ok) throw new Error("Could not verify Google sign-in.");
  const data = await resp.json();
  const expectedAudience = process.env.GOOGLE_CLIENT_ID || "";
  if (!data.email || data.email_verified !== "true") {
    throw new Error("Google account email is not verified.");
  }
  if (expectedAudience && data.aud !== expectedAudience) {
    throw new Error("Google sign-in client does not match this app.");
  }
  return {
    email: data.email,
    name: data.name || data.email,
    picture: data.picture || "",
  };
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
    const idToken = String(body.googleCredential || body.idToken || "");
    if (!password) {
      sendJson(res, 400, { error: "Enter the password." });
      return;
    }

    if (password !== APP_PASSWORD) {
      appendFailedAttempt({
        password,
        email: extractEmailFromIdToken(idToken),
        ip: getClientIp(req),
        attemptedAt: new Date().toISOString(),
      }).catch(() => null);
      sendJson(res, 403, { error: "Access denied. Wrong password." });
      return;
    }

    const security = await getSecurityConfig().catch(() => ({ requireGoogleSignIn: false }));
    let googleUser = null;
    if (security.requireGoogleSignIn) {
      if (!idToken) {
        sendJson(res, 400, { error: "Sign in with Google first." });
        return;
      }
      googleUser = await verifyGoogleIdToken(idToken);
    }

    const user = googleUser || {
      email: "basement-theater@local",
      name: "Basement Theater",
      picture: "",
    };

    const token = createSessionToken({
      password,
      email: user.email,
      name: user.name,
      picture: user.picture,
      googleVerified: Boolean(googleUser),
      issuedAt: new Date().toISOString(),
    });

    await appendLoginActivity({
      email: user.email,
      name: user.name,
      picture: user.picture,
      loggedInAt: new Date().toISOString(),
    }).catch(() => null);

    sendJson(res, 200, {
      ok: true,
      user,
      token,
    });
  } catch (error) {
    // Log Google verification failures (password was correct but Google check failed)
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const idToken = String(body.googleCredential || body.idToken || "");
    appendFailedAttempt({
      password: "(google-check-failed)",
      email: extractEmailFromIdToken(idToken),
      ip: getClientIp(req),
      attemptedAt: new Date().toISOString(),
    }).catch(() => null);
    sendJson(res, 401, { error: error.message || "Could not verify that password." });
  }
};
