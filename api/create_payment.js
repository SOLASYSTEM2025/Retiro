import fs from 'fs';
import path from 'path';
import mercadopago from 'mercadopago';

mercadopago.configure({
  access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const dataDir = path.join(process.cwd(), 'data');
    const dataFile = path.join(dataDir, 'inscricoes.json');

    // Garante que o diretório de dados existe
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
    if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]');

    // Verifica limite de vagas
    const current = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    if (current.length >= 80) {
      return res.status(400).json({ error: 'Limite de 80 inscrições atingido.' });
    }

    const { nome, cpf, email, telefone, igreja, restricoes, responsavel, method, amount } = req.body;

    // Cria preferência de pagamento
    const preference = {
      items: [
        {
          title: 'Inscrição Retiro das Irmãs 2026',
          quantity: 1,
          currency_id: 'BRL',
          unit_price: parseFloat(amount)
        }
      ],
      payer: {
        name: nome,
        email: email,
        identification: {
          type: 'CPF',
          number: cpf.replace(/\D/g, '')
        }
      },
      notification_url: `${req.headers.origin}/api/payment_webhook`,
      metadata: { nome, email, telefone, igreja, restricoes, responsavel },
      payment_methods: {
        installments: 4,
        excluded_payment_types: method === 'pix' ? [{ id: 'credit_card' }] : []
      },
      back_urls: {
        success: `${req.headers.origin}/?status=success`,
        failure: `${req.headers.origin}/?status=failure`,
        pending: `${req.headers.origin}/?status=pending`
      },
      auto_return: 'approved'
    };

    const response = await mercadopago.preferences.create(preference);

    if (method === 'pix') {
      // Cria pagamento PIX direto
      const payment = await mercadopago.payment.create({
        transaction_amount: parseFloat(amount),
        description: 'Inscrição Retiro das Irmãs 2026',
        payment_method_id: 'pix',
        payer: {
          email,
          first_name: nome
        },
        notification_url: `${req.headers.origin}/api/payment_webhook`
      });

      return res.status(200).json({
        payment: payment.body,
        id: payment.body.id,
        init_point: response.body.init_point
      });
    } else {
      // Cartão de crédito: retorna init_point do checkout
      return res.status(200).json({
        preference_id: response.body.id,
        init_point: response.body.init_point
      });
    }

  } catch (error) {
    console.error('Erro ao criar pagamento:', error);
    res.status(500).json({ error: error.message });
  }
}
