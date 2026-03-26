const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = process.cwd();
const PRIVATE_DIR = path.join(ROOT, "api", "_lib", "private");
const APP_PASSWORD = process.env.APP_PASSWORD || "Firepump1234";

async function readPrivateJson(fileName) {
  const fullPath = path.join(PRIVATE_DIR, fileName);
  const text = await fs.readFile(fullPath, "utf8");
  return JSON.parse(text);
}

async function requireAllowedUser(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    const error = new Error("Missing access token.");
    error.statusCode = 401;
    throw error;
  }

  const password = token.trim();
  if (password !== APP_PASSWORD) {
    const error = new Error("Access denied. Wrong password.");
    error.statusCode = 403;
    throw error;
  }

  return {
    email: "basement-theater@local",
    name: "Basement Theater",
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
};
