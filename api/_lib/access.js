const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = process.cwd();
const PRIVATE_DIR = path.join(ROOT, "api", "_lib", "private");

async function readPrivateJson(fileName) {
  const fullPath = path.join(PRIVATE_DIR, fileName);
  const text = await fs.readFile(fullPath, "utf8");
  return JSON.parse(text);
}

async function verifyGoogleToken(idToken) {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || "Google verification failed.");
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured.");
  }

  if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
    throw new Error("This Google login does not match the configured app.");
  }

  if (payload.email_verified !== "true") {
    throw new Error("Google says this email is not verified.");
  }

  return payload;
}

async function isAllowedEmail(email) {
  const allowedEmails = String(process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const allowedSet = new Set(allowedEmails.map((entry) => String(entry).trim().toLowerCase()));
  return allowedSet.has(String(email).trim().toLowerCase());
}

async function requireAllowedUser(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    const error = new Error("Missing sign-in token.");
    error.statusCode = 401;
    throw error;
  }

  const payload = await verifyGoogleToken(token);
  const allowed = await isAllowedEmail(payload.email);
  if (!allowed) {
    const error = new Error("That Google account is not on the approved list.");
    error.statusCode = 403;
    throw error;
  }

  return {
    email: payload.email,
    name: payload.name || payload.email,
    picture: payload.picture || "",
  };
}

function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

module.exports = {
  PRIVATE_DIR,
  readPrivateJson,
  requireAllowedUser,
  sendJson,
  verifyGoogleToken,
  isAllowedEmail,
};
