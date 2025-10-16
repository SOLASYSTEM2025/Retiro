import mercadopago from 'mercadopago';

mercadopago.configure({
  access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN
});

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Parâmetro "id" é obrigatório' });
  }

  try {
    const payment = await mercadopago.payment.findById(id);
    if (!payment || !payment.body) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }

    const body = payment.body;
    const result = {
      id: body.id,
      status: body.status,
      status_detail: body.status_detail,
      date_approved: body.date_approved,
      transaction_amount: body.transaction_amount,
      payer_email: body.payer?.email || null
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error('Erro ao consultar status:', error);
    return res.status(500).json({ error: error.message });
  }
}
