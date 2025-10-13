const fetch = require('node-fetch');

const MAX_SEATS = parseInt(process.env.MAX_SEATS || '120', 10);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const REPO_OWNER = process.env.REPO_OWNER || '';
const REPO_NAME = process.env.REPO_NAME || '';
const REG_PATH = process.env.REG_PATH || 'registrations.json';

module.exports = async (req, res) => {
  try {
    if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME)
      return res.json({ max: MAX_SEATS, taken: 0, available: MAX_SEATS });

    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(REG_PATH)}`;
    const r = await fetch(url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
    });
    const j = await r.json();
    const arr = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8') || '[]');
    res.json({ max: MAX_SEATS, taken: arr.length, available: MAX_SEATS - arr.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
