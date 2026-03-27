const { createSessionToken, handleCors, sendJson } = require("../_lib/access");
const { appendLoginActivity, getSecurityConfig } = require("../_lib/supabase");
const APP_PASSWORD = process.env.APP_PASSWORD || "Firepump1234";

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
      sendJson(res, 403, { error: "Access denied. Wrong password." });
      return;
    }

    // Verify Google token if provided; fall back to manual email for local HTML file usage.
    let googleUser = null;
    if (idToken) {
      googleUser = await verifyGoogleIdToken(idToken);
    }

    const manualEmail = String(body.manualEmail || "").trim().toLowerCase();
    if (!googleUser && !manualEmail) {
      sendJson(res, 403, { error: "Sign in with Google or enter your school email first." });
      return;
    }
    if (!googleUser && manualEmail && !manualEmail.endsWith("@rsdmo.org")) {
      sendJson(res, 403, { error: "Please use your @rsdmo.org school email." });
      return;
    }

    const user = googleUser || {
      email: manualEmail,
      name: manualEmail,
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
    sendJson(res, 401, { error: error.message || "Could not verify that password." });
  }
};
