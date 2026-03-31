const { handleCors, requireAdminPassword, requireAllowedUser, sendJson } = require("../_lib/access");
const {
  getDeviceRegistry,
  addDeviceRegistryEntry,
  removeDeviceRegistryEntry,
} = require("../_lib/supabase");

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  try {
    requireAdminPassword(req);
    await requireAllowedUser(req);

    if (req.method === "GET") {
      const data = await getDeviceRegistry();
      sendJson(res, 200, data);
      return;
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { deviceId, label } = body;
      if (!deviceId) { sendJson(res, 400, { error: "deviceId is required." }); return; }
      const data = await addDeviceRegistryEntry(String(deviceId).trim(), String(label || "").trim());
      sendJson(res, 200, data);
      return;
    }

    if (req.method === "DELETE") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { deviceId } = body;
      if (!deviceId) { sendJson(res, 400, { error: "deviceId is required." }); return; }
      const data = await removeDeviceRegistryEntry(String(deviceId).trim());
      sendJson(res, 200, data);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message || "Could not manage device registry." });
  }
};
