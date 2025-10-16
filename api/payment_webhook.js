import fs from 'fs';
import path from 'path';
import mercadopago from 'mercadopago';

mercadopago.configure({
  access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN
});

export default async function handler(req, res) {
  try {
    const { query } = req;
    const topic = query.topic || query.type;
    const id = query['data.id'] || query.id;

    if (topic !== 'payment' && topic !== 'merchant_order') {
      return res.status(200).json({ received: true });
    }

    const payment = await mercadopago.payment.findById(id);
    if (!payment || !payment.body) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }

    const status = payment.body.status;
    const metadata = payment.body.metadata || {};

    if (status === 'approved') {
      const dataDir = path.join(process.cwd(), 'data');
      const dataFile = path.join(dataDir, 'inscricoes.json');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
      if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]');

      const inscricoes = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
      const exists = inscricoes.find(i => i.cpf === metadata.cpf);

      if (!exists) {
        inscricoes.push({
          id: payment.body.id,
          nome: metadata.nome || payment.body.payer.first_name,
          email: metadata.email || payment.body.payer.email,
          telefone: metadata.telefone || '',
          igreja: metadata.igreja || '',
          restricoes: metadata.restricoes || '',
          responsavel: metadata.responsavel || '',
          valor: payment.body.transaction_amount,
          status: 'confirmado',
          data: new Date().toISOString()
        });
        fs.writeFileSync(dataFile, JSON.stringify(inscricoes, null, 2));
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ error: error.message });
  }
}
