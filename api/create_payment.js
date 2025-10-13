const mercadopago = require('mercadopago');
const fetch = require('node-fetch');

mercadopago.configure({
  access_token: process.env.MERCADOPAGO_ACCESS_TOKEN
});

const PRICE = parseFloat(process.env.PRICE || '250.00');
const CURRENCY = process.env.CURRENCY || 'BRL';
const MAX_SEATS = parseInt(process.env.MAX_SEATS || '120', 10);

// Config GitHub (para salvar JSON no próprio repo, opcional)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const REPO_OWNER = process.env.REPO_OWNER || '';
const REPO_NAME = process.env.REPO_NAME || '';
const REG_PATH = process.env.REG_PATH || 'registrations.json';

async function githubReadRegistrations() {
  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) return null;
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(REG_PATH)}`;
  const resp = await fetch(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (resp.status === 404) return [];
  const body = await resp.json();
  const content = Buffer.from(body.content, 'base64').toString('utf8');
  return JSON.parse(content || '[]');
}

async function githubWriteRegistrations(arr) {
  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) return null;
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(REG_PATH)}`;
  const getResp = await fetch(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
  });
  let sha = null;
  if (getResp.ok) sha = (await getResp.json()).sha;
  await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json'
    },
    body: JSON.stringify({
      message: 'Update registrations.json',
      content: Buffer.from(JSON.stringify(arr, null, 2)).toString('base64'),
      sha
    })
  });
}

let inMemoryRegs = [];

async function readRegistrations() {
  if (GITHUB_TOKEN && REPO_OWNER && REPO_NAME) return githubReadRegistrations();
  return inMemoryRegs;
}
async function writeRegistrations(arr) {
  if (GITHUB_TOKEN && REPO_OWNER && REPO_NAME) return githubWriteRegistrations(arr);
  inMemoryRegs = arr;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { nome, cpf, email, telefone, igreja, restricoes, method } = req.body;

    if (!nome || !cpf || !email || !method)
      return res.status(400).json({ error: 'Campos obrigatórios ausentes' });

    const regs = await readRegistrations();
    if (Array.isArray(regs) && regs.length >= MAX_SEATS)
      return res.status(400).json({ error: 'Vagas esgotadas' });

    if (method === 'card') {
      const preference = {
        items: [{
          id: cpf,
          title: 'Inscrição - Retiro das Irmãs 2026',
          quantity: 1,
          unit_price: PRICE,
          currency_id: CURRENCY
        }],
        payer: { name: nome, email },
        payment_methods: { installments: 4 },
        external_reference: JSON.stringify({ cpf, nome, email }),
        notification_url: `${process.env.BASE_URL}/api/webhook`
      };
      const mpRes = await mercadopago.preferences.create(preference);
      return res.json({ init_point: mpRes.body.init_point });
    }

    if (method === 'pix') {
      const payment_data = {
        transaction_amount: PRICE,
        description: 'Inscrição - Retiro das Irmãs 2026',
        payment_method_id: 'pix',
        payer: { email, first_name: nome }
      };
      const payment = await mercadopago.payment.create(payment_data);
      return res.json({ payment: payment.body });
    }

    res.status(400).json({ error: 'Método inválido' });
  } catch (err) {
    console.error('create_payment:', err.message);
    res.status(500).json({ error: 'Erro interno', detail: err.message });
  }
};
