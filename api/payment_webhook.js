const mercadopago = require('mercadopago');
const fetch = require('node-fetch');

mercadopago.configure({ access_token: process.env.MERCADOPAGO_ACCESS_TOKEN });
const PRICE = parseFloat(process.env.PRICE || '250.00');
const MAX_SEATS = parseInt(process.env.MAX_SEATS || '120', 10);

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const REPO_OWNER = process.env.REPO_OWNER || '';
const REPO_NAME = process.env.REPO_NAME || '';
const REG_PATH = process.env.REG_PATH || 'registrations.json';

async function githubRead() {
  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) return [];
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(REG_PATH)}`;
  const r = await fetch(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (r.status === 404) return [];
  const j = await r.json();
  return JSON.parse(Buffer.from(j.content, 'base64').toString('utf8') || '[]');
}
async function githubWrite(arr) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(REG_PATH)}`;
  const get = await fetch(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
  });
  const sha = get.ok ? (await get.json()).sha : null;
  await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'Update registrations.json (webhook)',
      content: Buffer.from(JSON.stringify(arr, null, 2)).toString('base64'),
      sha
    })
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('ok');
  try {
    const id = req.body?.data?.id || req.query?.id;
    if (!id) return res.status(200).send('no id');

    const p = (await mercadopago.payment.findById(id)).body;
    if (p.status === 'approved' && parseFloat(p.transaction_amount) === PRICE) {
      const regs = await githubRead();
      if (regs.length < MAX_SEATS) {
        regs.push({
          name: p.payer?.first_name || p.payer?.name,
          email: p.payer?.email,
          phone: p.payer?.phone?.number,
          method: p.payment_method_id,
          payment_id: p.id,
          created_at: new Date().toISOString()
        });
        await githubWrite(regs);
      }
    }
    res.status(200).send('ok');
  } catch (e) {
    console.error('webhook error:', e);
    res.status(500).send('erro');
  }
};
