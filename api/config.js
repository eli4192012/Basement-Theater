const { getSecurityConfig } = require("./_lib/supabase");

module.exports = async function handler(_req, res) {
  const security = await getSecurityConfig().catch(() => ({ requireGoogleSignIn: false }));
  res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    requireGoogleSignIn: Boolean(security.requireGoogleSignIn),
  });
};
