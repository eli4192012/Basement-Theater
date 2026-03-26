const { getSecurityConfig } = require("./_lib/supabase");
const { handleCors } = require("./_lib/access");

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  const security = await getSecurityConfig().catch(() => ({ requireGoogleSignIn: false }));
  res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    requireGoogleSignIn: Boolean(security.requireGoogleSignIn),
  });
};
