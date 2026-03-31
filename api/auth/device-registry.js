const {
  getDeviceRegistry,
  addDeviceRegistryEntry,
  removeDeviceRegistryEntry,
} = require("../_lib/supabase");
const { requireAdminPassword, requireAllowedUser, sendJson } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  requireAdminPassword(req, res);
  if (res.writableEnded) return;
  requireAllowedUser(req, res);
  if (res.writableEnded) return;

  if (req.method === "GET") {
    const data = await getDeviceRegistry().catch(() => ({ entries: [] }));
    return sendJson(res, 200, data);
  }

  if (req.method === "POST") {
    const { deviceId, label } = req.body || {};
    if (!deviceId) return sendJson(res, 400, { error: "deviceId is required." });
    const data = await addDeviceRegistryEntry(deviceId, label || "");
    return sendJson(res, 200, data);
  }

  if (req.method === "DELETE") {
    const { deviceId } = req.body || {};
    if (!deviceId) return sendJson(res, 400, { error: "deviceId is required." });
    const data = await removeDeviceRegistryEntry(deviceId);
    return sendJson(res, 200, data);
  }

  sendJson(res, 405, { error: "Method not allowed." });
};
