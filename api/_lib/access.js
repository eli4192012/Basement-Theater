const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = process.cwd();
const PRIVATE_DIR = path.join(ROOT, "api", "_lib", "private");
const APP_PASSWORD = process.env.APP_PASSWORD || "Firepump1234";
const SESSION_SECRET = process.env.SESSION_SECRET || APP_PASSWORD;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "html1234";

async function readPrivateJson(fileName) {
  const fullPath = path.join(PRIVATE_DIR, fileName);
  const text = await fs.readFile(fullPath, "utf8");
  return JSON.parse(text);
}

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function createSessionToken(payload) {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = toBase64Url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifySessionToken(token) {
  const [header, body, signature] = String(token || "").split(".");
  if (!header || !body || !signature) {
    const error = new Error("Missing access token.");
    error.statusCode = 401;
    throw error;
  }

  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(`${header}.${body}`).digest("base64url");
  if (signature !== expected) {
    const error = new Error("Invalid session token.");
    error.statusCode = 401;
    throw error;
  }

  return JSON.parse(fromBase64Url(body));
}

async function requireAllowedUser(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const payload = verifySessionToken(token);

  if (payload.password !== APP_PASSWORD) {
    const error = new Error("Access denied. Wrong password.");
    error.statusCode = 403;
    throw error;
  }

  return {
    email: payload.email || "basement-theater@local",
    name: payload.name || "Basement Theater",
    picture: payload.picture || "",
  };
}

function requireAdminPassword(req) {
  const adminPassword = req.headers["x-admin-password"] || "";
  if (String(adminPassword) !== ADMIN_PASSWORD) {
    const error = new Error("Admin password required.");
    error.statusCode = 403;
    throw error;
  }
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Password");
}

function handleCors(req, res) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  res.status(statusCode).json(payload);
}

module.exports = {
  PRIVATE_DIR,
  ADMIN_PASSWORD,
  createSessionToken,
  handleCors,
  readPrivateJson,
  requireAdminPassword,
  requireAllowedUser,
  sendJson,
  verifySessionToken,
};
