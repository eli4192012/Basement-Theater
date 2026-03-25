module.exports = async function handler(_req, res) {
  res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  });
};
