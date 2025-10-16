import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  try {
    const dataFile = path.join(process.cwd(), 'data', 'inscricoes.json');
    if (!fs.existsSync(dataFile)) return res.status(200).json({ total: 0, remaining: 80 });

    const inscricoes = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    const total = inscricoes.length;
    const remaining = Math.max(0, 80 - total);

    res.status(200).json({ total, remaining });
  } catch (error) {
    console.error('Erro seats:', error);
    res.status(500).json({ error: error.message });
  }
}
