async function submitInscricao(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Processando...';

  try {
    const nome = document.getElementById('nome').value.trim();
    const cpf = document.getElementById('cpf').value.trim();
    const email = document.getElementById('email').value.trim();
    const telefone = document.getElementById('telefone').value.trim();
    const igreja = document.getElementById('igreja').value.trim();
    const restricoes = document.getElementById('restricoes').value.trim();
    const method = document.querySelector('input[name="method"]:checked')?.value || 'pix';

    const payload = { nome, cpf, email, telefone, igreja, restricoes, method };
    const resp = await fetch('/api/create_payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Erro ao criar pagamento');

    if (method === 'card') {
      window.location.href = data.init_point;
    } else {
      const pay = data.payment;
      const info = pay?.point_of_interaction?.transaction_data;
      const qrBase64 = info?.qr_code_base64;
      const qrString = info?.qr_code;
      const area = document.getElementById('pix-area') || (() => {
        const div = document.createElement('div');
        div.id = 'pix-area';
        form.appendChild(div);
        return div;
      })();
      area.innerHTML = '';
      if (qrBase64) {
        const img = document.createElement('img');
        img.src = 'data:image/png;base64,' + qrBase64;
        img.style.maxWidth = '320px';
        area.appendChild(img);
      }
      if (qrString) {
        const pre = document.createElement('pre');
        pre.textContent = qrString;
        pre.style.background = '#f7f7f7';
        pre.style.padding = '8px';
        pre.style.borderRadius = '6px';
        area.appendChild(pre);

        const btnCopy = document.createElement('button');
        btnCopy.innerText = 'Copiar código PIX';
        btnCopy.onclick = () => {
          navigator.clipboard.writeText(qrString);
          alert('Código PIX copiado!');
        };
        area.appendChild(btnCopy);
      }
    }
  } catch (err) {
    alert('Erro: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('inscricaoForm');
  if (form) form.addEventListener('submit', submitInscricao);
});
