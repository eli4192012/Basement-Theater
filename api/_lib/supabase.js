const STORAGE_BUCKET = "basement-theater-meta";
const DEFAULT_SECURITY_CONFIG = {
  requireGoogleSignIn: true,
};

function getSupabaseEnv() {
  return {
    url: process.env.SUPABASE_URL || "https://lwltqetwruxryugpgxgy.supabase.co",
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

function getHeaders(contentType) {
  const { key } = getSupabaseEnv();
  if (!key) {
    const error = new Error("Missing Supabase service role key.");
    error.statusCode = 500;
    throw error;
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };

  if (contentType) headers["Content-Type"] = contentType;
  return headers;
}

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const { url } = getSupabaseEnv();
  const resp = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: getHeaders("application/json"),
    body: JSON.stringify({
      id: STORAGE_BUCKET,
      name: STORAGE_BUCKET,
      public: false,
    }),
  });

  if (resp.ok || resp.status === 409 || resp.status === 400) {
    bucketReady = true;
    return;
  }
  const text = await resp.text().catch(() => "");
  throw new Error(`Could not ensure Supabase bucket (${resp.status}): ${text}`);
}

async function readJsonObject(path, fallback) {
  const { url } = getSupabaseEnv();
  await ensureBucket();
  const resp = await fetch(`${url}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
    headers: getHeaders(),
  });

  if (resp.status === 404) return fallback;
  if (resp.status === 400) {
    const text = await resp.text().catch(() => "");
    if (/not[_ -]?found/i.test(text)) return fallback;
    throw new Error(`Could not read Supabase object (${resp.status}): ${text}`);
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Could not read Supabase object (${resp.status}): ${text}`);
  }

  const text = await resp.text();
  return text ? JSON.parse(text) : fallback;
}

async function writeJsonObject(path, value) {
  const { url } = getSupabaseEnv();
  await ensureBucket();
  const resp = await fetch(`${url}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      ...getHeaders("application/json"),
      "x-upsert": "true",
    },
    body: JSON.stringify(value, null, 2),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Could not write Supabase object (${resp.status}): ${text}`);
  }

  return resp.json().catch(() => ({}));
}

async function getSecurityConfig() {
  return readJsonObject("security-config.json", DEFAULT_SECURITY_CONFIG);
}

async function setSecurityConfig(config) {
  const next = {
    ...DEFAULT_SECURITY_CONFIG,
    ...(config || {}),
    updatedAt: new Date().toISOString(),
  };
  await writeJsonObject("security-config.json", next);
  return next;
}

async function appendLoginActivity(entry) {
  const existing = await readJsonObject("login-activity.json", { logins: [] });
  const next = {
    logins: [
      {
        email: entry.email,
        name: entry.name || "",
        picture: entry.picture || "",
        loggedInAt: entry.loggedInAt || new Date().toISOString(),
      },
      ...(existing.logins || []),
    ].slice(0, 500),
    updatedAt: new Date().toISOString(),
  };
  await writeJsonObject("login-activity.json", next);
  return next;
}

async function getLoginActivity() {
  return readJsonObject("login-activity.json", { logins: [] });
}

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

async function appendFailedAttempt(entry) {
  const existing = await readJsonObject("failed-attempts.json", { attempts: [] });
  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS).toISOString();
  const next = {
    attempts: [
      {
        password: entry.password || "",
        email: entry.email || "",
        ip: entry.ip || "",
        attemptedAt: entry.attemptedAt || new Date().toISOString(),
      },
      ...(existing.attempts || []).filter((a) => (a.attemptedAt || "") >= cutoff),
    ].slice(0, 200),
    updatedAt: new Date().toISOString(),
  };
  await writeJsonObject("failed-attempts.json", next);
  return next;
}

async function getFailedAttempts() {
  const data = await readJsonObject("failed-attempts.json", { attempts: [] });
  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS).toISOString();
  return {
    attempts: (data.attempts || []).filter((a) => (a.attemptedAt || "") >= cutoff),
  };
}

module.exports = {
  DEFAULT_SECURITY_CONFIG,
  appendFailedAttempt,
  appendLoginActivity,
  getFailedAttempts,
  getLoginActivity,
  getSecurityConfig,
  setSecurityConfig,
};
