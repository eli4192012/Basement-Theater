const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = process.cwd();
const PRIVATE_DIR = path.join(ROOT, "api", "_lib", "private");

async function readPrivateJson(fileName) {
  const fullPath = path.join(PRIVATE_DIR, fileName);
  const text = await fs.readFile(fullPath, "utf8");
  return JSON.parse(text);
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
    const error = new Error("Missing access token.");
    error.statusCode = 401;
    throw error;
  }

  const email = token.trim().toLowerCase();
  const allowed = await isAllowedEmail(email);
  if (!allowed) {
    const error = new Error("That email is not on the approved list.");
    error.statusCode = 403;
    throw error;
  }

  return {
    email,
    name: email,
    picture: "",
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
  isAllowedEmail,
};
